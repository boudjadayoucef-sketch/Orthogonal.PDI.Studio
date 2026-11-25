#!/usr/bin/env npx tsx
/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — ADDENDUM MIG-04-AUTH-01-FIX-02
 * Script administratif ponctuel : correction de l'adresse email Super Admin
 * (`orthognaleng@gmail.com` -> `orthogonaleng@gmail.com`)
 * ============================================================================
 *
 * Garanties de sécurité strictes :
 * 1. Utilise exclusivement le client serveur sécurisé `src/server/supabaseAdmin.ts`.
 * 2. Utilise exclusivement l'API Supabase Auth Admin `auth.admin.updateUserById`.
 *    Ne crée JAMAIS de 2e utilisateur, ne supprime JAMAIS le compte existant,
 *    et n'exécute JAMAIS de SQL direct sur `auth.users`.
 * 3. Lit les secrets uniquement depuis les variables d'environnement serveur
 *    (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`). N'expose jamais `service_role` ni `sb_secret_`.
 * 4. Mode `DRY_RUN` actif par défaut : aucune modification de données sans `--execute`
 *    ET confirmation explicite (`--confirm` ou `CONFIRM_SUPER_ADMIN_EMAIL_UPDATE`).
 * 5. Vérifie que `orthognaleng@gmail.com` existe et que `orthogonaleng@gmail.com`
 *    n'est pas déjà attribuée à un autre utilisateur.
 * 6. Inspecte `profiles` et `user_identity_mappings` dynamiquement sans supposer leur schéma.
 * 7. Préserve strictement l'UUID, `role = 'super_admin'`, `status = 'active'` et les logs d'audit.
 * 8. Effectue une vérification post-modification complète et retourne un rapport sans secret.
 *
 * Usage (côté serveur uniquement — ne jamais exécuter dans le navigateur) :
 *   # 1. Mode DRY_RUN (défaut — lecture seule, zéro modification) :
 *   SUPABASE_URL="https://<ref>.supabase.co" \
 *   SUPABASE_SECRET_KEY="<secret_serveur>" \
 *   npx tsx scripts/updateSupabaseSuperAdminEmail.ts --dry-run
 *
 *   # 2. Exécution réelle avec confirmation explicite :
 *   SUPABASE_URL="https://<ref>.supabase.co" \
 *   SUPABASE_SECRET_KEY="<secret_serveur>" \
 *   npx tsx scripts/updateSupabaseSuperAdminEmail.ts \
 *     --execute \
 *     --confirm CONFIRM_UPDATE_ORTHOGONALENG_SUPER_ADMIN_EMAIL \
 *     --operator "<identifiant_operateur>"
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isStagingSandboxMode } from "../src/lib/stagingSandbox.ts";
import {
  createSupabaseAdminClient,
  redactSupabaseSecret,
  sanitizeSupabaseAdminError,
  SupabaseAdminConfigError,
  type SupabaseAdminKeyFormat,
} from "../src/server/supabaseAdmin.ts";

export const SOURCE_SUPER_ADMIN_EMAIL = "orthognaleng@gmail.com" as const;
export const TARGET_SUPER_ADMIN_EMAIL = "orthogonaleng@gmail.com" as const;
export const EXPLICIT_CONFIRMATION_TOKEN =
  "CONFIRM_UPDATE_ORTHOGONALENG_SUPER_ADMIN_EMAIL" as const;

export type UpdateSuperAdminEmailErrorCode =
  | "BROWSER_CONTEXT_FORBIDDEN"
  | "SANDBOX_FORBIDDEN"
  | "INVALID_CLI_ARGS"
  | "DRY_RUN_WRITE_FORBIDDEN"
  | "CONFIRMATION_REQUIRED"
  | "SOURCE_USER_NOT_FOUND"
  | "MULTIPLE_SOURCE_USERS_FOUND"
  | "TARGET_EMAIL_ALREADY_IN_USE"
  | "PROFILE_NOT_FOUND"
  | "NOT_VERIFIED_SUPER_ADMIN"
  | "UUID_MISMATCH"
  | "POST_VERIFICATION_FAILED"
  | "SUPABASE_ADMIN_ERROR";

export class UpdateSuperAdminEmailError extends Error {
  public readonly code: UpdateSuperAdminEmailErrorCode;

  constructor(code: UpdateSuperAdminEmailErrorCode, message: string) {
    super(redactSupabaseSecret(message));
    this.name = "UpdateSuperAdminEmailError";
    this.code = code;
  }
}

export interface ParsedUpdateEmailCliArgs {
  dryRun: boolean;
  confirmToken: string | null;
  operatorId: string;
}

export interface SchemaInspectionSummary {
  tableExists: boolean;
  inspectedColumns: string[];
  matchedRowCount: number;
  updatedRowCount: number;
  emailColumnsDetected: string[];
  notes: string[];
}

export interface AuditLogsSummary {
  tableExists: boolean;
  countBefore: number | null;
  countAfter: number | null;
  preserved: boolean;
  auditEntryAppended: boolean;
}

export interface PostModificationVerificationSummary {
  performed: boolean;
  authUserUuidMatch: boolean;
  authUserEmailMatch: boolean;
  authUserEmailConfirmed: boolean;
  profileUuidMatch: boolean;
  profileEmailMatch: boolean;
  profileRolePreserved: boolean;
  profileStatusPreserved: boolean;
  identityMappingsClean: boolean;
  auditLogsPreserved: boolean;
}

export interface UpdateSupabaseSuperAdminEmailReport {
  ok: true;
  mode: "DRY_RUN" | "EXECUTED";
  executed: boolean;
  changesApplied: boolean;
  ticket: "MIG-04-AUTH-01-FIX-02";
  operatorId: string;
  supabaseOrigin: string | null;
  keyFormat: SupabaseAdminKeyFormat | "injected_client";
  sourceEmail: typeof SOURCE_SUPER_ADMIN_EMAIL;
  targetEmail: typeof TARGET_SUPER_ADMIN_EMAIL;
  userId: string;
  uuidBefore: string;
  uuidAfter: string;
  uuidPreserved: boolean;
  roleBefore: string | null;
  roleAfter: string | null;
  statusBefore: string | null;
  statusAfter: string | null;
  emailConfirmedBefore: boolean;
  emailConfirmedAfter: boolean;
  profilesInspection: SchemaInspectionSummary;
  identityMappingsInspection: SchemaInspectionSummary;
  auditLogs: AuditLogsSummary;
  postVerification: PostModificationVerificationSummary;
  plannedActions: string[];
  message: string;
}

export interface ExecuteUpdateSuperAdminEmailOptions {
  env?: Record<string, string | undefined>;
  dryRun?: boolean;
  confirmToken?: string | null;
  operatorId?: string;
  /** Optionnel (tests de simulation uniquement) : client Supabase Admin injecté */
  client?: SupabaseClient;
  /** Optionnel (tests uniquement) : URL affichée dans le rapport lorsque le client est injecté */
  supabaseOrigin?: string | null;
  /** Optionnel (tests uniquement) : simule un runtime navigateur */
  isBrowserRuntime?: boolean;
}

interface AuthUserSnapshot {
  id: string;
  email: string;
  email_confirmed_at: string | null;
}

type DynamicRow = Record<string, unknown>;

const KNOWN_LOCATOR_KEYS = [
  "id",
  "supabase_user_id",
  "user_id",
  "auth_user_id",
  "profile_id",
  "firebase_uid",
] as const;

const KNOWN_USER_UUID_KEYS = [
  "supabase_user_id",
  "user_id",
  "auth_user_id",
  "profile_id",
  "id",
] as const;

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isEmailConfirmedValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isMissingTableOrSchemaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as Record<string, unknown>;
  const code = typeof record.code === "string" ? record.code : "";
  const message = typeof record.message === "string" ? record.message : "";
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    /does not exist|could not find the table|relation .* does not exist|schema cache/i.test(message)
  );
}

function assertServerRuntimeOnly(override?: boolean): void {
  const isBrowser =
    typeof override === "boolean"
      ? override
      : typeof globalThis.window !== "undefined" || typeof globalThis.document !== "undefined";
  if (isBrowser) {
    throw new UpdateSuperAdminEmailError(
      "BROWSER_CONTEXT_FORBIDDEN",
      "Ce script administratif est strictement réservé à un environnement serveur (interdit dans le navigateur)."
    );
  }
}

export function parseUpdateSuperAdminEmailArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env
): ParsedUpdateEmailCliArgs {
  let explicitDryRun = false;
  let explicitExecute = false;
  let confirmToken: string | null =
    typeof env.CONFIRM_SUPER_ADMIN_EMAIL_UPDATE === "string" &&
    env.CONFIRM_SUPER_ADMIN_EMAIL_UPDATE.trim().length > 0
      ? env.CONFIRM_SUPER_ADMIN_EMAIL_UPDATE.trim()
      : null;
  let operatorId = "server-cli";

  const envDryRunRaw = typeof env.DRY_RUN === "string" ? env.DRY_RUN.trim().toLowerCase() : "";
  const envForcesDryRun = envDryRunRaw === "true" || envDryRunRaw === "1";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      explicitDryRun = true;
    } else if (arg === "--execute") {
      explicitExecute = true;
    } else if (arg === "--confirm") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new UpdateSuperAdminEmailError(
          "INVALID_CLI_ARGS",
          "L'option --confirm requiert le jeton explicite de confirmation."
        );
      }
      confirmToken = next.trim();
      i += 1;
    } else if (arg === "--operator") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new UpdateSuperAdminEmailError(
          "INVALID_CLI_ARGS",
          "L'option --operator requiert un identifiant opérateur."
        );
      }
      operatorId = next.trim();
      i += 1;
    } else {
      throw new UpdateSuperAdminEmailError(
        "INVALID_CLI_ARGS",
        `Argument CLI non autorisé ou inconnu : ${arg}`
      );
    }
  }

  if (explicitDryRun && explicitExecute) {
    throw new UpdateSuperAdminEmailError(
      "DRY_RUN_WRITE_FORBIDDEN",
      "Les options --dry-run et --execute sont mutuellement exclusives : aucune écriture n'est autorisée en mode DRY_RUN."
    );
  }

  if (envForcesDryRun && explicitExecute) {
    throw new UpdateSuperAdminEmailError(
      "DRY_RUN_WRITE_FORBIDDEN",
      "DRY_RUN=true est actif dans l'environnement : toute exécution réelle (--execute) est refusée."
    );
  }

  const dryRun = explicitDryRun || envForcesDryRun || !explicitExecute;

  return {
    dryRun,
    confirmToken,
    operatorId: operatorId || "server-cli",
  };
}

async function listAllAuthUsers(client: SupabaseClient): Promise<AuthUserSnapshot[]> {
  const allUsers: AuthUserSnapshot[] = [];
  let page = 1;
  const perPage = 200;

  while (page <= 50) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new UpdateSuperAdminEmailError(
        "SUPABASE_ADMIN_ERROR",
        `Échec auth.admin.listUsers : ${sanitizeSupabaseAdminError(error)}`
      );
    }
    const users = data?.users ?? [];
    for (const u of users) {
      allUsers.push({
        id: u.id,
        email: normalizeEmail(u.email),
        email_confirmed_at: u.email_confirmed_at ?? null,
      });
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return allUsers;
}

function detectEmailColumnsWithValue(row: DynamicRow, expectedEmail: string): string[] {
  const normalizedTarget = normalizeEmail(expectedEmail);
  const cols: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "string" && normalizeEmail(value) === normalizedTarget) {
      cols.push(key);
    }
  }
  return cols;
}

function detectRowLocator(row: DynamicRow): { column: string; value: string } | null {
  for (const key of KNOWN_LOCATOR_KEYS) {
    const val = row[key];
    if (typeof val === "string" && val.trim().length > 0) {
      return { column: key, value: val };
    }
  }
  return null;
}

function isRowLinkedToUserId(row: DynamicRow, userId: string): boolean {
  for (const key of KNOWN_USER_UUID_KEYS) {
    if (typeof row[key] === "string" && row[key] === userId) {
      return true;
    }
  }
  for (const value of Object.values(row)) {
    if (typeof value === "string" && value === userId) {
      return true;
    }
  }
  return false;
}

function extractOtherLinkedUuid(row: DynamicRow, expectedUserId: string): string | null {
  for (const key of KNOWN_USER_UUID_KEYS) {
    if (key === "id") continue;
    const val = row[key];
    if (typeof val === "string" && val.trim().length > 0 && val !== expectedUserId) {
      return val;
    }
  }
  return null;
}

async function readProfileByIdDynamic(
  client: SupabaseClient,
  userId: string
): Promise<{ tableExists: boolean; row: DynamicRow | null }> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return { tableExists: false, row: null };
    }
    throw new UpdateSuperAdminEmailError(
      "SUPABASE_ADMIN_ERROR",
      `Échec lecture public.profiles : ${sanitizeSupabaseAdminError(error)}`
    );
  }

  return {
    tableExists: true,
    row: (data as DynamicRow | null) ?? null,
  };
}

async function checkProfileEmailConflictDynamic(
  client: SupabaseClient,
  userId: string,
  targetEmail: string
): Promise<string | null> {
  const { data, error } = await client.from("profiles").select("*").limit(500);
  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return null;
    }
    throw new UpdateSuperAdminEmailError(
      "SUPABASE_ADMIN_ERROR",
      `Échec contrôle d'unicité sur public.profiles : ${sanitizeSupabaseAdminError(error)}`
    );
  }

  const rows = (data as DynamicRow[] | null) ?? [];
  for (const row of rows) {
    const emailMatches = detectEmailColumnsWithValue(row, targetEmail);
    if (emailMatches.length > 0) {
      const rowId = typeof row.id === "string" ? row.id : "unknown";
      if (rowId !== userId) {
        return rowId;
      }
    }
  }
  return null;
}

interface PlannedMappingUpdate {
  locatorColumn: string;
  locatorValue: string;
  patch: Record<string, string>;
}

async function inspectIdentityMappingsDynamic(
  client: SupabaseClient,
  userId: string,
  sourceEmail: string,
  targetEmail: string
): Promise<{
  summary: SchemaInspectionSummary;
  plannedUpdates: PlannedMappingUpdate[];
}> {
  const { data, error } = await client
    .from("user_identity_mappings")
    .select("*")
    .limit(500);

  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return {
        summary: {
          tableExists: false,
          inspectedColumns: [],
          matchedRowCount: 0,
          updatedRowCount: 0,
          emailColumnsDetected: [],
          notes: [
            "Table user_identity_mappings absente ou non exposée sur ce schéma : ignorée sans erreur.",
          ],
        },
        plannedUpdates: [],
      };
    }
    throw new UpdateSuperAdminEmailError(
      "SUPABASE_ADMIN_ERROR",
      `Échec inspection user_identity_mappings : ${sanitizeSupabaseAdminError(error)}`
    );
  }

  const rows = (data as DynamicRow[] | null) ?? [];
  const columnSet = new Set<string>();
  const detectedEmailCols = new Set<string>();
  const plannedUpdates: PlannedMappingUpdate[] = [];
  const notes: string[] = [];
  let matchedRowCount = 0;

  for (const row of rows) {
    for (const k of Object.keys(row)) columnSet.add(k);

    const linkedToUser = isRowLinkedToUserId(row, userId);
    const colsWithTarget = detectEmailColumnsWithValue(row, targetEmail);
    const colsWithSource = detectEmailColumnsWithValue(row, sourceEmail);

    // Conflit : une ligne pointe déjà sur targetEmail pour un AUTRE utilisateur
    if (colsWithTarget.length > 0 && !linkedToUser) {
      const conflictingUuid = extractOtherLinkedUuid(row, userId) ?? "unknown";
      throw new UpdateSuperAdminEmailError(
        "TARGET_EMAIL_ALREADY_IN_USE",
        `L'adresse cible ${targetEmail} est déjà référencée dans user_identity_mappings pour un autre utilisateur (${conflictingUuid}).`
      );
    }

    if (linkedToUser || colsWithSource.length > 0) {
      matchedRowCount += 1;
      for (const col of colsWithSource) detectedEmailCols.add(col);

      if (colsWithSource.length > 0) {
        const locator = detectRowLocator(row);
        if (locator) {
          const patch: Record<string, string> = {};
          for (const col of colsWithSource) {
            patch[col] = targetEmail;
          }
          plannedUpdates.push({
            locatorColumn: locator.column,
            locatorValue: locator.value,
            patch,
          });
        } else {
          notes.push(
            "Ligne user_identity_mappings correspondante détectée sans clé primaire identifiable ; mise à jour manuelle recommandée."
          );
        }
      }
    }
  }

  if (matchedRowCount === 0) {
    notes.push("Aucune référence liée à cet utilisateur dans user_identity_mappings.");
  }

  return {
    summary: {
      tableExists: true,
      inspectedColumns: Array.from(columnSet).sort(),
      matchedRowCount,
      updatedRowCount: 0,
      emailColumnsDetected: Array.from(detectedEmailCols).sort(),
      notes,
    },
    plannedUpdates,
  };
}

async function readAuditLogsCountDynamic(
  client: SupabaseClient
): Promise<{ tableExists: boolean; count: number | null }> {
  const { count, error } = await client
    .from("audit_logs")
    .select("*", { count: "exact", head: true });

  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return { tableExists: false, count: null };
    }
    throw new UpdateSuperAdminEmailError(
      "SUPABASE_ADMIN_ERROR",
      `Échec comptage public.audit_logs : ${sanitizeSupabaseAdminError(error)}`
    );
  }

  return {
    tableExists: true,
    count: typeof count === "number" ? count : 0,
  };
}

async function appendAuditLogSafely(
  client: SupabaseClient,
  params: {
    userId: string;
    operatorId: string;
    updatedProfileCols: string[];
    updatedMappingRows: number;
  }
): Promise<boolean> {
  const { error } = await client.from("audit_logs").insert({
    actor_user_id: params.userId,
    target_user_id: params.userId,
    event_type: "super_admin.identity_email.updated",
    resource_type: "profiles",
    resource_id: params.userId,
    severity: "critical",
    metadata: {
      ticket: "MIG-04-AUTH-01-FIX-02",
      operator_id: params.operatorId,
      previous_email: SOURCE_SUPER_ADMIN_EMAIL,
      updated_email: TARGET_SUPER_ADMIN_EMAIL,
      uuid_preserved: true,
      updated_profile_columns: params.updatedProfileCols,
      updated_identity_mapping_rows: params.updatedMappingRows,
    },
  });

  if (error) {
    if (isMissingTableOrSchemaError(error)) {
      return false;
    }
    // Ne pas corrompre une mise à jour déjà réussie mais signaler l'absence d'écriture audit
    return false;
  }
  return true;
}

export function sanitizeReportForOutput(
  report: UpdateSupabaseSuperAdminEmailReport
): UpdateSupabaseSuperAdminEmailReport {
  const json = JSON.stringify(report);
  const redacted = redactSupabaseSecret(json);
  return JSON.parse(redacted) as UpdateSupabaseSuperAdminEmailReport;
}

/**
 * Exécute la procédure contrôlée de correction d'email Super Admin Supabase.
 * - En mode DRY_RUN (défaut) : lecture seule stricte, ZÉRO écriture.
 * - En mode EXECUTED : exige explicitement `dryRun: false` ET `confirmToken === EXPLICIT_CONFIRMATION_TOKEN`.
 */
export async function executeUpdateSupabaseSuperAdminEmail(
  options: ExecuteUpdateSuperAdminEmailOptions = {}
): Promise<UpdateSupabaseSuperAdminEmailReport> {
  assertServerRuntimeOnly(options.isBrowserRuntime);

  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});
  if (isStagingSandboxMode(env)) {
    throw new UpdateSuperAdminEmailError(
      "SANDBOX_FORBIDDEN",
      "La modification administrative d'identité Supabase est strictement interdite en mode Sandbox."
    );
  }

  const dryRun = options.dryRun !== false;
  const operatorId = (options.operatorId ?? "server-cli").trim() || "server-cli";

  // 7. Confirmation explicite obligatoire avant toute modification réelle
  if (!dryRun) {
    const provided = (options.confirmToken ?? "").trim();
    if (provided !== EXPLICIT_CONFIRMATION_TOKEN) {
      throw new UpdateSuperAdminEmailError(
        "CONFIRMATION_REQUIRED",
        `Confirmation explicite requise avant toute modification réelle. Fournissez --confirm ${EXPLICIT_CONFIRMATION_TOKEN} (ou CONFIRM_SUPER_ADMIN_EMAIL_UPDATE).`
      );
    }
  }

  // 1 & 3. Client serveur sécurisé existant (src/server/supabaseAdmin.ts)
  let client: SupabaseClient;
  let supabaseOrigin: string | null = options.supabaseOrigin ?? null;
  let keyFormat: SupabaseAdminKeyFormat | "injected_client" = "injected_client";

  if (options.client) {
    client = options.client;
  } else {
    const handle = createSupabaseAdminClient(env);
    client = handle.client;
    supabaseOrigin = handle.url;
    keyFormat = handle.keyFormat;
  }

  // 4 & 5. Recherche de l'utilisateur source et vérification que l'adresse cible n'est pas déjà attribuée
  const allUsers = await listAllAuthUsers(client);
  const sourceMatches = allUsers.filter((u) => u.email === SOURCE_SUPER_ADMIN_EMAIL);
  const targetMatches = allUsers.filter((u) => u.email === TARGET_SUPER_ADMIN_EMAIL);

  if (targetMatches.length > 0) {
    throw new UpdateSuperAdminEmailError(
      "TARGET_EMAIL_ALREADY_IN_USE",
      `Refus : l'adresse cible ${TARGET_SUPER_ADMIN_EMAIL} est déjà attribuée à un utilisateur existant (UUID=${targetMatches[0].id}). Aucune création, suppression ou fusion automatique n'est autorisée.`
    );
  }

  if (sourceMatches.length === 0) {
    throw new UpdateSuperAdminEmailError(
      "SOURCE_USER_NOT_FOUND",
      `Utilisateur source introuvable dans Supabase Auth pour l'adresse ${SOURCE_SUPER_ADMIN_EMAIL}.`
    );
  }

  if (sourceMatches.length > 1) {
    throw new UpdateSuperAdminEmailError(
      "MULTIPLE_SOURCE_USERS_FOUND",
      `Plusieurs utilisateurs trouvés pour ${SOURCE_SUPER_ADMIN_EMAIL} (${sourceMatches.length}). Opération bloquée par sécurité.`
    );
  }

  const sourceUser = sourceMatches[0];
  const uuidBefore = sourceUser.id;
  const emailConfirmedBefore = isEmailConfirmedValue(sourceUser.email_confirmed_at);

  // 9 & 10. Inspection dynamique de `profiles` (sans supposer son schéma) et contrôle super_admin / active
  const profileRead = await readProfileByIdDynamic(client, uuidBefore);
  if (!profileRead.tableExists || !profileRead.row) {
    throw new UpdateSuperAdminEmailError(
      "PROFILE_NOT_FOUND",
      `Profil public.profiles introuvable pour l'UUID ${uuidBefore}.`
    );
  }

  const profileRow = profileRead.row;
  const profileColumns = Object.keys(profileRow).sort();
  const roleBefore = typeof profileRow.role === "string" ? profileRow.role : null;
  const statusBefore = typeof profileRow.status === "string" ? profileRow.status : null;

  if (roleBefore !== "super_admin" || statusBefore !== "active") {
    throw new UpdateSuperAdminEmailError(
      "NOT_VERIFIED_SUPER_ADMIN",
      `Le compte ${SOURCE_SUPER_ADMIN_EMAIL} (UUID=${uuidBefore}) n'est pas un Super Admin actif (role=${String(roleBefore)}, status=${String(statusBefore)}).`
    );
  }

  // Vérification d'unicité supplémentaire sur `profiles`
  const conflictingProfileId = await checkProfileEmailConflictDynamic(
    client,
    uuidBefore,
    TARGET_SUPER_ADMIN_EMAIL
  );
  if (conflictingProfileId) {
    throw new UpdateSuperAdminEmailError(
      "TARGET_EMAIL_ALREADY_IN_USE",
      `Refus : l'adresse cible ${TARGET_SUPER_ADMIN_EMAIL} est déjà présente dans public.profiles pour un autre UUID (${conflictingProfileId}).`
    );
  }

  const profileEmailColsToUpdate = detectEmailColumnsWithValue(
    profileRow,
    SOURCE_SUPER_ADMIN_EMAIL
  );
  const profilesInspection: SchemaInspectionSummary = {
    tableExists: true,
    inspectedColumns: profileColumns,
    matchedRowCount: 1,
    updatedRowCount: 0,
    emailColumnsDetected: profileEmailColsToUpdate,
    notes:
      profileEmailColsToUpdate.length > 0
        ? [
            `Colonnes email à synchroniser sur profiles (id=${uuidBefore}) : ${profileEmailColsToUpdate.join(", ")} (sans modifier id, role ni status).`,
          ]
        : [
            "Aucune colonne contenant l'ancienne adresse email trouvée sur profiles : aucune écriture profiles nécessaire.",
          ],
  };

  // 9. Inspection dynamique de `user_identity_mappings` (sans supposer son schéma)
  const mappingsPlan = await inspectIdentityMappingsDynamic(
    client,
    uuidBefore,
    SOURCE_SUPER_ADMIN_EMAIL,
    TARGET_SUPER_ADMIN_EMAIL
  );

  // 10. Comptage initial des journaux d'audit (pour garantir la préservation)
  const auditBefore = await readAuditLogsCountDynamic(client);

  const plannedActions: string[] = [
    `auth.admin.updateUserById(${uuidBefore}, { email: "${TARGET_SUPER_ADMIN_EMAIL}", email_confirm: true }) [UUID conservé]`,
  ];
  if (profileEmailColsToUpdate.length > 0) {
    plannedActions.push(
      `profiles.update({ ${profileEmailColsToUpdate.map((c) => `${c}: "${TARGET_SUPER_ADMIN_EMAIL}"`).join(", ")} }).eq("id", "${uuidBefore}") [role=super_admin et status=active conservés]`
    );
  }
  for (const m of mappingsPlan.plannedUpdates) {
    plannedActions.push(
      `user_identity_mappings.update(${JSON.stringify(m.patch)}).eq("${m.locatorColumn}", "${m.locatorValue}")`
    );
  }
  if (auditBefore.tableExists) {
    plannedActions.push(
      `audit_logs.insert(event_type="super_admin.identity_email.updated") [journaux existants préservés]`
    );
  }

  // 6. Mode DRY_RUN : lecture seule stricte, ZÉRO écriture
  if (dryRun) {
    return sanitizeReportForOutput({
      ok: true,
      mode: "DRY_RUN",
      executed: false,
      changesApplied: false,
      ticket: "MIG-04-AUTH-01-FIX-02",
      operatorId,
      supabaseOrigin,
      keyFormat,
      sourceEmail: SOURCE_SUPER_ADMIN_EMAIL,
      targetEmail: TARGET_SUPER_ADMIN_EMAIL,
      userId: uuidBefore,
      uuidBefore,
      uuidAfter: uuidBefore,
      uuidPreserved: true,
      roleBefore,
      roleAfter: roleBefore,
      statusBefore,
      statusAfter: statusBefore,
      emailConfirmedBefore,
      emailConfirmedAfter: emailConfirmedBefore,
      profilesInspection,
      identityMappingsInspection: mappingsPlan.summary,
      auditLogs: {
        tableExists: auditBefore.tableExists,
        countBefore: auditBefore.count,
        countAfter: auditBefore.count,
        preserved: true,
        auditEntryAppended: false,
      },
      postVerification: {
        performed: false,
        authUserUuidMatch: true,
        authUserEmailMatch: false,
        authUserEmailConfirmed: emailConfirmedBefore,
        profileUuidMatch: true,
        profileEmailMatch: false,
        profileRolePreserved: roleBefore === "super_admin",
        profileStatusPreserved: statusBefore === "active",
        identityMappingsClean: mappingsPlan.plannedUpdates.length === 0,
        auditLogsPreserved: true,
      },
      plannedActions,
      message: `DRY_RUN : aucune donnée modifiée. L'utilisateur ${SOURCE_SUPER_ADMIN_EMAIL} (UUID=${uuidBefore}) est éligible à une mise à jour sécurisée vers ${TARGET_SUPER_ADMIN_EMAIL}. Pour exécuter réellement : relancer avec --execute --confirm ${EXPLICIT_CONFIRMATION_TOKEN}.`,
    });
  }

  // 2 & 8. Exécution réelle via l'API Supabase Auth Admin `updateUserById` exclusivement
  const { data: updateAuthData, error: updateAuthError } =
    await client.auth.admin.updateUserById(uuidBefore, {
      email: TARGET_SUPER_ADMIN_EMAIL,
      email_confirm: true,
    });

  if (updateAuthError || !updateAuthData?.user) {
    throw new UpdateSuperAdminEmailError(
      "SUPABASE_ADMIN_ERROR",
      `Échec auth.admin.updateUserById : ${sanitizeSupabaseAdminError(updateAuthError)}`
    );
  }

  if (updateAuthData.user.id !== uuidBefore) {
    throw new UpdateSuperAdminEmailError(
      "UUID_MISMATCH",
      `Anomalie critique : l'UUID retourné (${updateAuthData.user.id}) ne correspond pas à l'UUID source (${uuidBefore}).`
    );
  }

  // 9 & 10. Synchronisation de `profiles` sur les seules colonnes email détectées (id, role, status inchangés)
  if (profileEmailColsToUpdate.length > 0) {
    const profilePatch: Record<string, string> = {};
    for (const col of profileEmailColsToUpdate) {
      profilePatch[col] = TARGET_SUPER_ADMIN_EMAIL;
    }

    const { error: profileUpdateErr } = await client
      .from("profiles")
      .update(profilePatch)
      .eq("id", uuidBefore);

    if (profileUpdateErr) {
      // Rollback compensatoire sur auth.users via updateUserById
      try {
        await client.auth.admin.updateUserById(uuidBefore, {
          email: SOURCE_SUPER_ADMIN_EMAIL,
          email_confirm: emailConfirmedBefore,
        });
      } catch {
        // Ignore secondary rollback failure
      }
      throw new UpdateSuperAdminEmailError(
        "SUPABASE_ADMIN_ERROR",
        `Échec mise à jour public.profiles (rollback Auth tenté) : ${sanitizeSupabaseAdminError(profileUpdateErr)}`
      );
    }
    profilesInspection.updatedRowCount = 1;
  }

  // 9. Mise à jour dynamique des éventuelles références `user_identity_mappings`
  let updatedMappingRows = 0;
  for (const plan of mappingsPlan.plannedUpdates) {
    const { error: mapUpdateErr } = await client
      .from("user_identity_mappings")
      .update(plan.patch)
      .eq(plan.locatorColumn, plan.locatorValue);

    if (mapUpdateErr) {
      throw new UpdateSuperAdminEmailError(
        "SUPABASE_ADMIN_ERROR",
        `Échec mise à jour user_identity_mappings (${plan.locatorColumn}=${plan.locatorValue}) : ${sanitizeSupabaseAdminError(mapUpdateErr)}`
      );
    }
    updatedMappingRows += 1;
  }
  mappingsPlan.summary.updatedRowCount = updatedMappingRows;

  // 10. Ajout d'une trace d'audit immuable (sans jamais altérer les journaux existants)
  const auditEntryAppended = auditBefore.tableExists
    ? await appendAuditLogSafely(client, {
        userId: uuidBefore,
        operatorId,
        updatedProfileCols: profileEmailColsToUpdate,
        updatedMappingRows,
      })
    : false;

  // 11. Vérification complète après modification
  const { data: verifiedAuthData, error: verifiedAuthErr } =
    await client.auth.admin.getUserById(uuidBefore);
  if (verifiedAuthErr || !verifiedAuthData?.user) {
    throw new UpdateSuperAdminEmailError(
      "POST_VERIFICATION_FAILED",
      `Vérification post-modification impossible via auth.admin.getUserById : ${sanitizeSupabaseAdminError(verifiedAuthErr)}`
    );
  }

  const verifiedAuthUser = verifiedAuthData.user;
  const uuidAfter = verifiedAuthUser.id;
  const authEmailAfter = normalizeEmail(verifiedAuthUser.email);
  const emailConfirmedAfter = isEmailConfirmedValue(verifiedAuthUser.email_confirmed_at);

  const verifiedProfileRead = await readProfileByIdDynamic(client, uuidBefore);
  const verifiedProfile = verifiedProfileRead.row;
  const roleAfter = typeof verifiedProfile?.role === "string" ? verifiedProfile.role : null;
  const statusAfter = typeof verifiedProfile?.status === "string" ? verifiedProfile.status : null;
  const profileEmailAfter =
    profileEmailColsToUpdate.length > 0 && verifiedProfile
      ? profileEmailColsToUpdate.every(
          (col) => normalizeEmail(verifiedProfile[col]) === TARGET_SUPER_ADMIN_EMAIL
        )
      : true;

  const postMappingsCheck = await inspectIdentityMappingsDynamic(
    client,
    uuidBefore,
    SOURCE_SUPER_ADMIN_EMAIL,
    TARGET_SUPER_ADMIN_EMAIL
  );
  const auditAfter = await readAuditLogsCountDynamic(client);

  const auditLogsPreserved =
    !auditBefore.tableExists ||
    (auditAfter.count !== null &&
      auditBefore.count !== null &&
      auditAfter.count >= auditBefore.count);

  const postVerification: PostModificationVerificationSummary = {
    performed: true,
    authUserUuidMatch: uuidAfter === uuidBefore,
    authUserEmailMatch: authEmailAfter === TARGET_SUPER_ADMIN_EMAIL,
    authUserEmailConfirmed: emailConfirmedAfter,
    profileUuidMatch: verifiedProfile?.id === uuidBefore,
    profileEmailMatch: profileEmailAfter,
    profileRolePreserved: roleAfter === "super_admin",
    profileStatusPreserved: statusAfter === "active",
    identityMappingsClean: postMappingsCheck.plannedUpdates.length === 0,
    auditLogsPreserved,
  };

  if (
    !postVerification.authUserUuidMatch ||
    !postVerification.authUserEmailMatch ||
    !postVerification.profileUuidMatch ||
    !postVerification.profileEmailMatch ||
    !postVerification.profileRolePreserved ||
    !postVerification.profileStatusPreserved ||
    !postVerification.identityMappingsClean ||
    !postVerification.auditLogsPreserved
  ) {
    throw new UpdateSuperAdminEmailError(
      "POST_VERIFICATION_FAILED",
      `Vérification post-modification incomplète : ${JSON.stringify(postVerification)}`
    );
  }

  return sanitizeReportForOutput({
    ok: true,
    mode: "EXECUTED",
    executed: true,
    changesApplied: true,
    ticket: "MIG-04-AUTH-01-FIX-02",
    operatorId,
    supabaseOrigin,
    keyFormat,
    sourceEmail: SOURCE_SUPER_ADMIN_EMAIL,
    targetEmail: TARGET_SUPER_ADMIN_EMAIL,
    userId: uuidBefore,
    uuidBefore,
    uuidAfter,
    uuidPreserved: uuidAfter === uuidBefore,
    roleBefore,
    roleAfter,
    statusBefore,
    statusAfter,
    emailConfirmedBefore,
    emailConfirmedAfter,
    profilesInspection,
    identityMappingsInspection: mappingsPlan.summary,
    auditLogs: {
      tableExists: auditBefore.tableExists,
      countBefore: auditBefore.count,
      countAfter: auditAfter.count,
      preserved: auditLogsPreserved,
      auditEntryAppended,
    },
    postVerification,
    plannedActions,
    message: `Modification effectuée et vérifiée : ${SOURCE_SUPER_ADMIN_EMAIL} -> ${TARGET_SUPER_ADMIN_EMAIL} (UUID conservé : ${uuidBefore}, role=${roleAfter}, status=${statusAfter}).`,
  });
}

export async function runUpdateSuperAdminEmailCli(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env,
  deps: {
    client?: SupabaseClient;
    supabaseOrigin?: string | null;
    stdout?: (line: string) => void;
    stderr?: (line: string) => void;
  } = {}
): Promise<number> {
  const out = deps.stdout ?? ((line: string) => console.log(line));
  const errOut = deps.stderr ?? ((line: string) => console.error(line));

  try {
    const parsed = parseUpdateSuperAdminEmailArgs(argv, env);
    const report = await executeUpdateSupabaseSuperAdminEmail({
      env,
      dryRun: parsed.dryRun,
      confirmToken: parsed.confirmToken,
      operatorId: parsed.operatorId,
      client: deps.client,
      supabaseOrigin: deps.supabaseOrigin,
    });
    out(redactSupabaseSecret(JSON.stringify(report, null, 2)));
    return 0;
  } catch (err) {
    const code =
      err instanceof SupabaseAdminConfigError || err instanceof UpdateSuperAdminEmailError
        ? err.code
        : "UNEXPECTED_CLI_ERROR";
    const message = sanitizeSupabaseAdminError(err);
    errOut(
      redactSupabaseSecret(
        JSON.stringify(
          {
            ok: false,
            code,
            message,
          },
          null,
          2
        )
      )
    );
    return 1;
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  process.argv[1].endsWith("updateSupabaseSuperAdminEmail.ts");

if (isDirectExecution) {
  runUpdateSuperAdminEmailCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
