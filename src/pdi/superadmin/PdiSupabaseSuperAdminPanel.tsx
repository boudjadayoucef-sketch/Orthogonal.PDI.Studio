import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ShieldCheck,
  RefreshCw,
  Users,
  UserCheck,
  Shield,
  FolderKanban,
  KeyRound,
  FileClock,
  AlertTriangle,
  Lock,
  WifiOff,
  Loader2,
} from "lucide-react";
import {
  fetchSupabaseSuperAdminOverview,
  PdiSupabaseAuthError,
  type SupabaseAdminOverviewData,
} from "../../lib/supabaseAuth";

export interface PdiSupabaseSuperAdminPanelProps {
  currentUserEmail?: string;
  onSwitchModule?: (mod: string) => void;
  fetchOverview?: () => Promise<SupabaseAdminOverviewData>;
}

export type SupabaseSuperAdminPanelErrorKind =
  | "unauthorized"
  | "forbidden"
  | "network"
  | "unknown";

export interface SupabaseSuperAdminPanelError {
  kind: SupabaseSuperAdminPanelErrorKind;
  status: number | null;
  code: string | null;
  title: string;
  message: string;
}

export interface SupabaseSuperAdminPanelState {
  loading: boolean;
  overview: SupabaseAdminOverviewData | null;
  error: SupabaseSuperAdminPanelError | null;
}

export interface PdiSupabaseSuperAdminPanelViewProps {
  state: SupabaseSuperAdminPanelState;
  currentUserEmail?: string;
  onRefresh: () => void;
  onSwitchModule?: (mod: string) => void;
}

function isValidOverviewPayload(data: unknown): data is SupabaseAdminOverviewData {
  if (!data || typeof data !== "object") {
    return false;
  }
  const candidate = data as Partial<SupabaseAdminOverviewData>;
  return Boolean(
    candidate.verifiedSuperAdmin &&
      typeof candidate.verifiedSuperAdmin.email === "string" &&
      typeof candidate.verifiedSuperAdmin.userId === "string" &&
      candidate.counts &&
      typeof candidate.counts.profiles === "number" &&
      typeof candidate.counts.activeProfiles === "number" &&
      typeof candidate.counts.superAdmins === "number" &&
      typeof candidate.counts.projects === "number" &&
      typeof candidate.counts.licenseKeys === "number" &&
      typeof candidate.counts.auditLogs === "number" &&
      Array.isArray(candidate.profiles) &&
      Array.isArray(candidate.recentAuditLogs) &&
      Array.isArray(candidate.legacyFirestoreModulesPendingMigration)
  );
}

/**
 * Classifie les erreurs serveur/réseau sans jamais inventer de données administratives.
 */
export function classifySuperAdminPanelError(err: unknown): SupabaseSuperAdminPanelError {
  const status =
    err instanceof PdiSupabaseAuthError
      ? err.status
      : typeof (err as { status?: unknown })?.status === "number"
        ? ((err as { status: number }).status)
        : null;

  const code =
    err instanceof PdiSupabaseAuthError
      ? err.code
      : typeof (err as { code?: unknown })?.code === "string"
        ? ((err as { code: string }).code)
        : null;

  const rawMessage =
    err instanceof Error && typeof err.message === "string" && err.message.trim().length > 0
      ? err.message.trim()
      : null;

  if (status === 401) {
    return {
      kind: "unauthorized",
      status: 401,
      code: code ?? "auth/unauthorized",
      title: "Session expirée ou non authentifiée (HTTP 401)",
      message:
        rawMessage ||
        "Votre session Supabase n'est plus valide ou a expiré. Veuillez vous reconnecter.",
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      status: 403,
      code: code ?? "auth/forbidden-super-admin",
      title: "Accès Super Administrateur refusé (HTTP 403)",
      message:
        rawMessage ||
        "Le serveur a refusé l'accès à la console Super Administrateur pour ce compte.",
    };
  }

  const isNetworkFailure =
    status === 503 ||
    code === "server/network-error" ||
    err instanceof TypeError ||
    (rawMessage !== null && /failed to fetch|network|econnrefused|timeout|offline/i.test(rawMessage));

  if (isNetworkFailure) {
    return {
      kind: "network",
      status,
      code: code ?? "server/network-error",
      title: "Erreur réseau ou service indisponible",
      message:
        rawMessage ||
        "Impossible de joindre le serveur d'administration Supabase. Vérifiez votre connexion et réessayez.",
    };
  }

  return {
    kind: "unknown",
    status,
    code,
    title: "Erreur lors du chargement des données serveur",
    message:
      rawMessage ||
      "Impossible de charger la vue d'administration Supabase vérifiée par le serveur.",
  };
}

/**
 * Exécute le chargement fail-closed de la vue Super Admin depuis `GET /api/admin/supabase/overview`.
 * En cas d'erreur (réseau, 401, 403 ou réponse invalide), retourne strictement `overview: null`.
 */
export async function loadSupabaseSuperAdminPanelState(
  fetchOverviewFn: () => Promise<SupabaseAdminOverviewData> = fetchSupabaseSuperAdminOverview
): Promise<SupabaseSuperAdminPanelState> {
  try {
    const data = await fetchOverviewFn();
    if (!isValidOverviewPayload(data)) {
      return {
        loading: false,
        overview: null,
        error: {
          kind: "unknown",
          status: null,
          code: "server/invalid-overview-payload",
          title: "Réponse serveur invalide",
          message:
            "Les données administratives retournées par le serveur sont incomplètes ou invalides.",
        },
      };
    }

    return {
      loading: false,
      overview: data,
      error: null,
    };
  } catch (err) {
    return {
      loading: false,
      overview: null,
      error: classifySuperAdminPanelError(err),
    };
  }
}

function formatIsoDateFr(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("fr-FR");
}

export const PdiSupabaseSuperAdminPanelView: React.FC<PdiSupabaseSuperAdminPanelViewProps> = ({
  state,
  currentUserEmail,
  onRefresh,
  onSwitchModule,
}) => {
  const { loading, overview, error } = state;

  return (
    <div
      data-testid="pdi-supabase-super-admin-panel"
      style={{
        padding: "24px",
        color: "#E5EDF8",
        fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        maxWidth: 1240,
        margin: "0 auto",
      }}
    >
      {/* En-tête autoritaire Super Admin Supabase */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 20px",
          borderRadius: 16,
          background:
            "linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(15, 23, 42, 0.96))",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: error
                ? "rgba(239, 68, 68, 0.16)"
                : "rgba(16, 185, 129, 0.16)",
              border: error
                ? "1px solid rgba(239, 68, 68, 0.4)"
                : "1px solid rgba(16, 185, 129, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: error ? "#FCA5A5" : "#34D399",
            }}
          >
            {error ? <Lock size={22} /> : <ShieldCheck size={22} />}
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: error ? "#FCA5A5" : "#34D399",
              }}
            >
              Supabase Auth · Autorisation vérifiée côté serveur (JWT + public.profiles)
            </div>
            <h1 style={{ margin: "4px 0 2px", fontSize: 20, fontWeight: 900, color: "#F8FAFC" }}>
              Console Super Administrateur Supabase
            </h1>
            {overview && !error ? (
              <div
                data-testid="supabase-admin-identity"
                style={{ fontSize: 12, color: "#94A3B8" }}
              >
                Super Admin vérifié :{" "}
                <strong style={{ color: "#E2E8F0" }}>
                  {overview.verifiedSuperAdmin.email}
                </strong>{" "}
                · ID : <code style={{ color: "#CBD5E1" }}>{overview.verifiedSuperAdmin.userId}</code>
                {overview.verifiedSuperAdmin.emailConfirmedAt ? (
                  <span>
                    {" "}
                    · Email confirmé le{" "}
                    {formatIsoDateFr(overview.verifiedSuperAdmin.emailConfirmedAt)}
                  </span>
                ) : null}
              </div>
            ) : loading ? (
              <div style={{ fontSize: 12, color: "#94A3B8" }}>
                Vérification de l&apos;identité serveur en cours
                {currentUserEmail ? ` (${currentUserEmail})` : ""}...
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#FCA5A5" }}>
                Identité Super Administrateur non confirmée par le serveur.
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {onSwitchModule ? (
            <button
              type="button"
              data-testid="supabase-admin-switch-module"
              onClick={() => onSwitchModule("isometric")}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "1px solid rgba(148, 163, 184, 0.3)",
                background: "rgba(15, 23, 42, 0.85)",
                color: "#E2E8F0",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Ouvrir Éditeur ISO
            </button>
          ) : null}
          <button
            type="button"
            data-testid="supabase-admin-refresh"
            onClick={onRefresh}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid rgba(56, 189, 248, 0.45)",
              background: "rgba(2, 132, 199, 0.2)",
              color: "#7DD3FC",
              fontSize: 12,
              fontWeight: 800,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={14} />
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>
      </div>

      {/* État de chargement initial */}
      {loading && !overview ? (
        <div
          data-testid="supabase-admin-loading"
          role="status"
          aria-live="polite"
          style={{
            padding: "32px 24px",
            borderRadius: 14,
            background: "rgba(15, 23, 42, 0.9)",
            border: "1px solid rgba(56, 189, 248, 0.28)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            textAlign: "center",
          }}
        >
          <Loader2 size={24} color="#38BDF8" />
          <div style={{ fontSize: 14, fontWeight: 800, color: "#F8FAFC" }}>
            Chargement des données Super Administrateur Supabase...
          </div>
          <div style={{ fontSize: 12, color: "#94A3B8" }}>
            Interrogation sécurisée de GET /api/admin/supabase/overview en cours.
          </div>
        </div>
      ) : null}

      {/* État d'erreur / refus d'accès (fail-closed : zéro donnée administrative affichée) */}
      {error ? (
        <div
          data-testid="supabase-admin-error"
          data-error-kind={error.kind}
          data-error-status={error.status !== null ? String(error.status) : error.kind}
          role="alert"
          style={{
            padding: "20px 22px",
            borderRadius: 14,
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.45)",
            color: "#FCA5A5",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            {error.kind === "network" ? (
              <WifiOff size={20} color="#FCA5A5" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <Lock size={20} color="#FCA5A5" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#FEE2E2", marginBottom: 6 }}>
                {error.title}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: "#FECACA" }}>
                {error.message}
              </div>
              {error.code ? (
                <div style={{ fontSize: 11, color: "#F87171", marginTop: 8 }}>
                  Code serveur : <code>{error.code}</code>
                </div>
              ) : null}
              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(248, 113, 113, 0.55)",
                    background: "rgba(127, 29, 29, 0.35)",
                    color: "#FEE2E2",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Données administratives réelles (uniquement après confirmation serveur sans erreur) */}
      {overview && !error ? (
        <div data-testid="supabase-admin-data">
          {/* Compteurs réels PostgreSQL Supabase */}
          <div
            data-testid="supabase-admin-counts"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
              gap: 14,
              marginBottom: 20,
            }}
          >
            {[
              {
                key: "profiles",
                label: "Nombre de profils",
                value: String(overview.counts.profiles),
                sub: "Table public.profiles",
                icon: <Users size={18} color="#38BDF8" />,
              },
              {
                key: "activeProfiles",
                label: "Profils actifs",
                value: String(overview.counts.activeProfiles),
                sub: "Statut active",
                icon: <UserCheck size={18} color="#34D399" />,
              },
              {
                key: "superAdmins",
                label: "Super Admin",
                value: String(overview.counts.superAdmins),
                sub: "Rôle super_admin actif",
                icon: <Shield size={18} color="#10B981" />,
              },
              {
                key: "projects",
                label: "Projets",
                value: String(overview.counts.projects),
                sub: "Table public.projects (RLS)",
                icon: <FolderKanban size={18} color="#60A5FA" />,
              },
              {
                key: "licenseKeys",
                label: "Clés de licence",
                value: String(overview.counts.licenseKeys),
                sub: "Table public.license_keys",
                icon: <KeyRound size={18} color="#FBBF24" />,
              },
              {
                key: "auditLogs",
                label: "Journaux d'audit",
                value: String(overview.counts.auditLogs),
                sub: "Table public.audit_logs",
                icon: <FileClock size={18} color="#C084FC" />,
              },
            ].map((card) => (
              <div
                key={card.key}
                data-testid={`supabase-admin-count-${card.key}`}
                style={{
                  padding: "16px 18px",
                  borderRadius: 14,
                  background: "rgba(15, 23, 42, 0.9)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: "#94A3B8",
                      textTransform: "uppercase",
                    }}
                  >
                    {card.label}
                  </span>
                  {card.icon}
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#F8FAFC" }}>
                  {card.value}
                </div>
                <div style={{ fontSize: 11.5, color: "#64748B", marginTop: 4 }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Modules Firestore restant à migrer (données réelles retournées par l'API) */}
          <section
            data-testid="supabase-admin-legacy-modules"
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              marginBottom: 20,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <AlertTriangle size={18} color="#FBBF24" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, color: "#FDE68A", lineHeight: 1.5, flex: 1 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                Modules Firestore restant à migrer (non interrogés avec un JWT Supabase) :
              </div>
              {overview.legacyFirestoreModulesPendingMigration.length === 0 ? (
                <div>Aucun module Firestore en attente de migration.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {overview.legacyFirestoreModulesPendingMigration.map((mod) => (
                    <li key={mod} style={{ marginBottom: 2 }}>
                      {mod}
                    </li>
                  ))}
                </ul>
              )}
              <div style={{ fontSize: 11, color: "#FCD34D", marginTop: 6, opacity: 0.85 }}>
                Dernière synchronisation serveur : {formatIsoDateFr(overview.generatedAt)}
              </div>
            </div>
          </section>

          {/* Tables réelles : public.profiles & public.audit_logs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 16,
            }}
          >
            <section
              data-testid="supabase-admin-profiles"
              style={{
                padding: 18,
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 900, color: "#F8FAFC" }}>
                Utilisateurs Supabase (public.profiles)
              </h2>
              {overview.profiles.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94A3B8" }}>Aucun profil trouvé.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr
                        style={{
                          textAlign: "left",
                          color: "#94A3B8",
                          borderBottom: "1px solid rgba(148,163,184,0.2)",
                        }}
                      >
                        <th style={{ padding: "8px 6px" }}>Email</th>
                        <th style={{ padding: "8px 6px" }}>Rôle</th>
                        <th style={{ padding: "8px 6px" }}>Statut</th>
                        <th style={{ padding: "8px 6px" }}>Offre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.profiles.map((p) => (
                        <tr
                          key={p.id}
                          style={{ borderBottom: "1px solid rgba(148,163,184,0.1)" }}
                        >
                          <td style={{ padding: "8px 6px", color: "#F8FAFC", fontWeight: 700 }}>
                            {p.email}
                          </td>
                          <td
                            style={{
                              padding: "8px 6px",
                              color: p.role === "super_admin" ? "#34D399" : "#CBD5E1",
                              fontWeight: 800,
                            }}
                          >
                            {p.role}
                          </td>
                          <td
                            style={{
                              padding: "8px 6px",
                              color: p.status === "active" ? "#86EFAC" : "#FCA5A5",
                            }}
                          >
                            {p.status}
                          </td>
                          <td style={{ padding: "8px 6px", color: "#94A3B8" }}>
                            {p.accountType}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section
              data-testid="supabase-admin-audit-logs"
              style={{
                padding: 18,
                borderRadius: 14,
                background: "rgba(15, 23, 42, 0.9)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
              }}
            >
              <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 900, color: "#F8FAFC" }}>
                Journaux d&apos;audit récents (public.audit_logs)
              </h2>
              {overview.recentAuditLogs.length === 0 ? (
                <p style={{ fontSize: 12, color: "#94A3B8" }}>
                  Aucun événement d&apos;audit enregistré.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {overview.recentAuditLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(2, 6, 23, 0.6)",
                        border: "1px solid rgba(148, 163, 184, 0.14)",
                        fontSize: 11.5,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ color: "#E2E8F0" }}>{log.eventType}</strong>
                        <span
                          style={{
                            color:
                              log.severity === "critical"
                                ? "#FCA5A5"
                                : log.severity === "warning"
                                  ? "#FDE68A"
                                  : "#7DD3FC",
                            fontWeight: 800,
                            textTransform: "uppercase",
                            fontSize: 10,
                          }}
                        >
                          {log.severity}
                        </span>
                      </div>
                      <div style={{ color: "#64748B", marginTop: 4 }}>
                        {log.resourceType}
                        {log.resourceId ? ` (${log.resourceId})` : ""}
                        {log.createdAt ? ` · ${formatIsoDateFr(log.createdAt)}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export const PdiSupabaseSuperAdminPanel: React.FC<PdiSupabaseSuperAdminPanelProps> = ({
  currentUserEmail,
  onSwitchModule,
  fetchOverview = fetchSupabaseSuperAdminOverview,
}) => {
  const [state, setState] = useState<SupabaseSuperAdminPanelState>({
    loading: true,
    overview: null,
    error: null,
  });
  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadOverview = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    const nextState = await loadSupabaseSuperAdminPanelState(fetchOverview);
    if (!isMountedRef.current || seq !== requestSeqRef.current) {
      return;
    }
    setState(nextState);
  }, [fetchOverview]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <PdiSupabaseSuperAdminPanelView
      state={state}
      currentUserEmail={currentUserEmail}
      onRefresh={() => void loadOverview()}
      onSwitchModule={onSwitchModule}
    />
  );
};
