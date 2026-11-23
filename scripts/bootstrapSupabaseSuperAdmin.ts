#!/usr/bin/env npx tsx
/**
 * ============================================================================
 * ORTHOGONAL PD&I STUDIO — MIG-03-BOOTSTRAP-01
 * Script serveur CLI : création sécurisée du premier super_admin Supabase
 * ============================================================================
 *
 * Compte unique autorisé : orthognaleng@gmail.com
 *
 * Usage :
 *   # 1. Simulation sans écriture (défaut) :
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=<secret_serveur> \
 *   SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=true \
 *   npx tsx scripts/bootstrapSupabaseSuperAdmin.ts --dry-run
 *
 *   # 2. Phase 1 (invitation email) puis Phase 2 (activation après confirmation email) :
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SECRET_KEY=<secret_serveur> \
 *   SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=true \
 *   npx tsx scripts/bootstrapSupabaseSuperAdmin.ts --execute
 *
 *   # 3. Désactiver immédiatement après activation :
 *   SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false
 */

import {
  createSupabaseAdminClient,
  sanitizeSupabaseAdminError,
  SupabaseAdminConfigError,
} from "../src/server/supabaseAdmin.ts";
import {
  AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL,
  bootstrapSupabaseSuperAdmin,
  createSupabaseAdminBootstrapGateway,
  SupabaseBootstrapError,
} from "../src/server/supabaseSuperAdminBootstrap.ts";

export interface ParsedBootstrapCliArgs {
  dryRun: boolean;
  targetEmail: string;
  operatorId: string;
  redirectTo?: string;
}

export function parseBootstrapCliArgs(argv: string[]): ParsedBootstrapCliArgs {
  let dryRun = true;
  let explicitDryRun = false;
  let explicitExecute = false;
  let targetEmail: string = AUTHORIZED_SUPABASE_SUPER_ADMIN_EMAIL;
  let operatorId = "server-cli";
  let redirectTo: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      explicitDryRun = true;
      dryRun = true;
    } else if (arg === "--execute") {
      explicitExecute = true;
      dryRun = false;
    } else if (arg === "--email") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("L'option --email requiert une adresse email.");
      }
      targetEmail = next;
      i += 1;
    } else if (arg === "--operator") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("L'option --operator requiert un identifiant opérateur.");
      }
      operatorId = next;
      i += 1;
    } else if (arg === "--redirect-to") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("L'option --redirect-to requiert une URL HTTPS.");
      }
      redirectTo = next;
      i += 1;
    } else {
      throw new Error(`Argument CLI non autorisé ou inconnu : ${arg}`);
    }
  }

  if (explicitDryRun && explicitExecute) {
    throw new Error("Les options --dry-run et --execute sont mutuellement exclusives.");
  }

  return {
    dryRun,
    targetEmail,
    operatorId,
    redirectTo,
  };
}

export async function runBootstrapCli(
  argv: string[] = process.argv.slice(2),
  env: Record<string, string | undefined> = process.env
): Promise<number> {
  try {
    const parsed = parseBootstrapCliArgs(argv);
    const { client, url, keyFormat } = createSupabaseAdminClient(env);
    const gateway = createSupabaseAdminBootstrapGateway(client);

    const result = await bootstrapSupabaseSuperAdmin({
      gateway,
      env,
      targetEmail: parsed.targetEmail,
      dryRun: parsed.dryRun,
      operatorId: parsed.operatorId,
      redirectTo: parsed.redirectTo,
      requestContext: {
        source: "server_cli",
      },
    });

    console.log(
      JSON.stringify(
        {
          status: "ok",
          supabaseOrigin: url,
          keyFormat,
          ...result,
        },
        null,
        2
      )
    );
    return 0;
  } catch (err) {
    if (err instanceof SupabaseAdminConfigError || err instanceof SupabaseBootstrapError) {
      console.error(
        JSON.stringify(
          {
            status: "error",
            code: err.code,
            message: sanitizeSupabaseAdminError(err),
          },
          null,
          2
        )
      );
      return 1;
    }

    console.error(
      JSON.stringify(
        {
          status: "error",
          code: "UNEXPECTED_CLI_ERROR",
          message: sanitizeSupabaseAdminError(err),
        },
        null,
        2
      )
    );
    return 1;
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === "string" &&
  process.argv[1].endsWith("bootstrapSupabaseSuperAdmin.ts");

if (isDirectExecution) {
  runBootstrapCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
