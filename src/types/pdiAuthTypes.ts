/**
 * ORTHOGONAL PD&I STUDIO — MIG-05-FIX-01
 * Types et erreurs d'authentification neutres (0 dépendance Firebase / Firestore / SDK).
 *
 * Ce module permet aux composants de démarrage (`PdiUnifiedApp`, `supabaseAuth`,
 * `pdiPaymentGateway`, `PdiAuthPage`, `PdiFeedbackModal`, etc.) de partager les
 * contrats de types d'identité sans jamais importer `src/lib/firebase.ts` au runtime.
 */

export type PdiUserRole = "super_admin" | "admin" | "client" | "guest" | "demo";
export type PdiAccountType = "basic" | "pro" | "enterprise" | "team";
export type PdiSubscriptionPlan = "monthly" | "yearly" | "trial" | "lifetime";

export interface PdiUserProfile {
  uid: string;
  email: string;
  name: string;
  company?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  paymentGateway?: string;
  currency?: string;
  role: PdiUserRole;
  accountType: PdiAccountType;
  subscriptionPlan: PdiSubscriptionPlan;
  status: "active" | "suspended" | "pending_activation" | "revoked" | "disabled";
  createdAt: string;
  lastLoginAt?: string;
  loginCount?: number;
  projectsCount?: number;
  storageUsedKb?: number;
}

export interface PdiConnectionLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  accountType?: string;
  ip?: string;
  userAgent?: string;
  device?: string;
  timestamp: string;
  status: "success" | "failed";
}

export interface PdiCommercialVisit {
  id: string;
  path: string;
  referrer?: string;
  section?: string;
  action?: string;
  device?: string;
  timestamp: string;
}

export interface PdiUserFeedback {
  id: string;
  userId?: string;
  userEmail: string;
  userName?: string;
  category: "feature_request" | "bug_report" | "general_feedback" | "satisfaction";
  rating: number; // 1 to 5
  title: string;
  message: string;
  status: "new" | "reviewed" | "in_progress" | "resolved";
  createdAt: string;
  adminNotes?: string;
}

export interface PdiSubscriberUsage {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  module: string;
  details?: string;
  timestamp: string;
}

export interface PdiLicenseKey {
  id: string;
  code: string;
  type: string; // e.g., 'TRIAL_7', 'TRIAL_30', 'PRO_YEAR', 'TEAM_YEAR', 'ENTERPRISE'
  plan: string; // 'BASIC', 'PRO', 'TEAM', 'ENTERPRISE'
  status: "generated" | "active" | "revoked" | "expired";
  assignedTo?: string; // email
  activatedBy?: string; // email who used it
  activatedAt?: string;
  createdAt: string;
  expiresAt: string;
  maxUsers?: number;
}

export type PdiAuthDenialReason =
  | "profile_not_found"
  | "pending_activation"
  | "suspended"
  | "revoked"
  | "disabled"
  | "inactive_status"
  | "permission_denied"
  | "network_error"
  | "token_error"
  | "invalid_claims"
  | "unexpected_error"
  | "signout_failed";

export class PdiAuthAccessError extends Error {
  readonly reason: PdiAuthDenialReason;
  readonly code?: string;
  readonly transient: boolean;
  readonly sessionTerminated: boolean;
  readonly pendingProfile?: PdiUserProfile;

  constructor(options: {
    message: string;
    reason: PdiAuthDenialReason;
    code?: string;
    transient?: boolean;
    sessionTerminated?: boolean;
    pendingProfile?: PdiUserProfile;
  }) {
    super(options.message);
    this.name = "PdiAuthAccessError";
    this.reason = options.reason;
    this.code = options.code;
    this.transient = Boolean(options.transient);
    this.sessionTerminated = Boolean(options.sessionTerminated);
    this.pendingProfile = options.pendingProfile;
    Object.setPrototypeOf(this, PdiAuthAccessError.prototype);
  }
}

export interface WorkspaceSessionResolution {
  status: "unauthenticated" | "active" | "pending_activation" | "denied" | "error";
  canAccessWorkspace: boolean;
  canAccessActivation: boolean;
  isSuperAdmin: boolean;
  authMode: "guest" | "pending_email" | "client" | "super_admin";
  profile: PdiUserProfile | null;
  reason?: PdiAuthDenialReason;
  transient?: boolean;
  errorMessage?: string;
}
