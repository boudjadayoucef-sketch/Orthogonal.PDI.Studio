/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * MIG-02 — SCHÉMA CIBLE SUPABASE POSTGRESQL (DRIZZLE ORM + MAPPERS DE COMPATIBILITÉ)
 *
 * Ce module définit le schéma relationnel cible compatible Supabase (`public.*` + référence
 * `auth.users`) en miroir strict des migrations SQL versionnées de `supabase/migrations/`.
 *
 * Invariants MIG-02 :
 * - Ne modifie pas `src/db/schema.ts` (compatibilité 100 % Firebase / PostgreSQL transitoire).
 * - Aucun appel réseau, aucune clé secrète, aucun mot de passe dans les tables métier.
 */

import {
  bigint,
  boolean,
  char,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const MIG02_MIGRATION_FILES = [
  "supabase/migrations/20261123000100_mig02_supabase_core_schema.sql",
  "supabase/migrations/20261123000200_mig02_supabase_rls_and_security.sql",
] as const;

export const MIG02_SUPABASE_TABLES = [
  "profiles",
  "user_identity_mappings",
  "projects",
  "project_members",
  "project_files",
  "license_keys",
  "subscriptions",
  "payments",
  "connection_logs",
  "subscriber_usage",
  "audit_logs",
  "feedback",
] as const;

export const MIG02_RLS_PROTECTED_TABLES = MIG02_SUPABASE_TABLES;

export type Mig02SupabaseTableName = (typeof MIG02_SUPABASE_TABLES)[number];

export const SUPABASE_ROLES = ["super_admin", "admin", "client", "guest", "demo"] as const;
export const SUPABASE_ACCOUNT_TYPES = ["basic", "pro", "team", "enterprise"] as const;
export const SUPABASE_BILLING_CYCLES = ["monthly", "yearly", "trial", "lifetime"] as const;
export const SUPABASE_PROFILE_STATUSES = [
  "active",
  "suspended",
  "pending_activation",
  "revoked",
  "disabled",
] as const;
export const SUPABASE_PROJECT_STATUSES = [
  "draft",
  "in_progress",
  "approved",
  "as_built",
  "archived",
  "published",
] as const;
export const SUPABASE_PROJECT_MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
export const SUPABASE_PAYMENT_PROVIDERS = ["paddle", "slickpay_baridimob"] as const;
export const SUPABASE_CURRENCIES = ["DZD", "EUR", "USD"] as const;

// Référence externe au schéma géré par Supabase Auth (`auth.users`)
const authSchema = pgSchema("auth");

export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  emailConfirmedAt: timestamp("email_confirmed_at", { withTimezone: true }),
});

// 1.1 public.profiles
export const supabaseProfiles = pgTable("profiles", {
  id: uuid("id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  firebaseUid: text("firebase_uid").unique(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  photoUrl: text("photo_url"),
  company: text("company"),
  country: text("country"),
  countryCode: char("country_code", { length: 2 }),
  city: text("city"),
  paymentGateway: text("payment_gateway"),
  currency: text("currency"),
  role: text("role").notNull().default("client"),
  accountType: text("account_type").notNull().default("basic"),
  subscriptionPlan: text("subscription_plan").notNull().default("monthly"),
  status: text("status").notNull().default("pending_activation"),
  loginCount: integer("login_count").notNull().default(0),
  projectsCount: integer("projects_count").notNull().default(0),
  storageUsedKb: integer("storage_used_kb").notNull().default(0),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 1.2 public.user_identity_mappings
export const userIdentityMappings = pgTable("user_identity_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),
  supabaseUserId: uuid("supabase_user_id")
    .notNull()
    .unique()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  firebaseUid: text("firebase_uid").notNull().unique(),
  firebaseEmail: text("firebase_email").notNull(),
  migrationStatus: text("migration_status").notNull().default("pending"),
  migratedAt: timestamp("migrated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2.1 public.projects
export const supabaseProjects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  legacyPgId: integer("legacy_pg_id").unique(),
  legacyFirestoreId: text("legacy_firestore_id").unique(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  legacyFirebaseUid: text("legacy_firebase_uid"),
  tenantId: text("tenant_id"),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  module: text("module").notNull().default("isometric"),
  status: text("status").notNull().default("draft"),
  driveFileId: text("drive_file_id"),
  driveFolderId: text("drive_folder_id"),
  driveWebViewLink: text("drive_web_view_link"),
  data: jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2.2 public.project_members
export const projectMembers = pgTable(
  "project_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => supabaseProjects.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
    memberRole: text("member_role").notNull().default("viewer"),
    invitedBy: uuid("invited_by").references(() => supabaseProfiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("uq_project_members_project_user").on(table.projectId, table.userId)]
);

// 2.3 public.project_files
export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => supabaseProjects.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  legacyDriveRecordId: integer("legacy_drive_record_id").unique(),
  legacyIsometricId: text("legacy_isometric_id"),
  fileKind: text("file_kind").notNull().default("drive_file"),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull().default("application/json"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  sizeLabel: text("size_label"),
  driveFileId: text("drive_file_id"),
  webViewLink: text("web_view_link"),
  iconLink: text("icon_link"),
  thumbnailLink: text("thumbnail_link"),
  isPdiProject: boolean("is_pdi_project").notNull().default(false),
  drawingNumber: text("drawing_number"),
  linePid: text("line_pid"),
  fluidCode: text("fluid_code"),
  status: text("status").notNull().default("draft"),
  dataJson: jsonb("data_json"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3.1 public.license_keys
export const licenseKeys = pgTable("license_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  legacyFirestoreId: text("legacy_firestore_id").unique(),
  code: text("code").notNull().unique(),
  type: text("type").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("generated"),
  assignedToEmail: text("assigned_to_email"),
  assignedUserId: uuid("assigned_user_id").references(() => supabaseProfiles.id, {
    onDelete: "set null",
  }),
  activatedByEmail: text("activated_by_email"),
  activatedByUserId: uuid("activated_by_user_id").references(() => supabaseProfiles.id, {
    onDelete: "set null",
  }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  maxUsers: integer("max_users").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3.2 public.subscriptions
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("basic"),
  billingCycle: text("billing_cycle").notNull().default("monthly"),
  status: text("status").notNull().default("pending_activation"),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  licenseKeyId: uuid("license_key_id").references(() => licenseKeys.id, {
    onDelete: "set null",
  }),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  canceledAt: timestamp("canceled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3.3 public.payments
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: text("order_id").notNull().unique(),
  userId: uuid("user_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "restrict" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
    onDelete: "set null",
  }),
  legacyFirebaseUid: text("legacy_firebase_uid"),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  company: text("company"),
  country: text("country"),
  countryCode: char("country_code", { length: 2 }),
  city: text("city"),
  plan: text("plan").notNull(),
  billingCycle: text("billing_cycle").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: text("currency").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull().default("pending"),
  associationStatus: text("association_status").notNull().default("unassociated"),
  providerTransactionId: text("provider_transaction_id"),
  lastEventId: text("last_event_id"),
  lastEventType: text("last_event_type"),
  associatedAt: timestamp("associated_at", { withTimezone: true }),
  providerMetadata: jsonb("provider_metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4.1 public.connection_logs
export const connectionLogs = pgTable("connection_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  userRole: text("user_role"),
  accountType: text("account_type"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  device: text("device"),
  status: text("status").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4.2 public.subscriber_usage
export const subscriberUsage = pgTable("subscriber_usage", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull(),
  action: text("action").notNull(),
  module: text("module").notNull(),
  details: text("details"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 4.3 public.audit_logs
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => supabaseProfiles.id, {
    onDelete: "set null",
  }),
  targetUserId: uuid("target_user_id").references(() => supabaseProfiles.id, {
    onDelete: "set null",
  }),
  eventType: text("event_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  severity: text("severity").notNull().default("info"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5.1 public.feedback
export const feedback = pgTable("feedback", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => supabaseProfiles.id, { onDelete: "cascade" }),
  userEmail: text("user_email").notNull(),
  userName: text("user_name"),
  category: text("category").notNull(),
  rating: smallint("rating").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// =============================================================================
// RELATIONS DRIZZLE
// =============================================================================

export const supabaseProfilesRelations = relations(supabaseProfiles, ({ one, many }) => ({
  identityMapping: one(userIdentityMappings, {
    fields: [supabaseProfiles.id],
    references: [userIdentityMappings.supabaseUserId],
  }),
  projects: many(supabaseProjects),
  projectMemberships: many(projectMembers),
  projectFiles: many(projectFiles),
  subscriptions: many(subscriptions),
  payments: many(payments),
  connectionLogs: many(connectionLogs),
  subscriberUsage: many(subscriberUsage),
  feedback: many(feedback),
}));

export const supabaseProjectsRelations = relations(supabaseProjects, ({ one, many }) => ({
  owner: one(supabaseProfiles, {
    fields: [supabaseProjects.ownerId],
    references: [supabaseProfiles.id],
  }),
  members: many(projectMembers),
  files: many(projectFiles),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(supabaseProjects, {
    fields: [projectMembers.projectId],
    references: [supabaseProjects.id],
  }),
  user: one(supabaseProfiles, {
    fields: [projectMembers.userId],
    references: [supabaseProfiles.id],
  }),
}));

export const projectFilesRelations = relations(projectFiles, ({ one }) => ({
  project: one(supabaseProjects, {
    fields: [projectFiles.projectId],
    references: [supabaseProjects.id],
  }),
  owner: one(supabaseProfiles, {
    fields: [projectFiles.ownerId],
    references: [supabaseProfiles.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(supabaseProfiles, {
    fields: [subscriptions.userId],
    references: [supabaseProfiles.id],
  }),
  licenseKey: one(licenseKeys, {
    fields: [subscriptions.licenseKeyId],
    references: [licenseKeys.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(supabaseProfiles, {
    fields: [payments.userId],
    references: [supabaseProfiles.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

// =============================================================================
// MAPPERS DE COMPATIBILITÉ TRANSITOIRE (FIRESTORE / POSTGRESQL LEGACY -> SUPABASE)
// =============================================================================

export interface LegacyFirestoreProfileInput {
  uid: string;
  email: string;
  name: string;
  company?: string;
  country?: string;
  countryCode?: string;
  city?: string;
  paymentGateway?: string;
  currency?: string;
  role?: string;
  accountType?: string;
  subscriptionPlan?: string;
  status?: string;
  loginCount?: number;
  projectsCount?: number;
  storageUsedKb?: number;
  lastLoginAt?: string | null;
}

export interface LegacyPostgresProjectInput {
  id: number;
  uid: string;
  name: string;
  description?: string | null;
  module?: string | null;
  status?: string | null;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  driveWebViewLink?: string | null;
  data?: Record<string, unknown> | null;
}

const VALID_ROLES = new Set<string>(SUPABASE_ROLES);
const VALID_ACCOUNT_TYPES = new Set<string>(SUPABASE_ACCOUNT_TYPES);
const VALID_BILLING_CYCLES = new Set<string>(SUPABASE_BILLING_CYCLES);
const VALID_PROFILE_STATUSES = new Set<string>(SUPABASE_PROFILE_STATUSES);
const VALID_PROJECT_STATUSES = new Set<string>(SUPABASE_PROJECT_STATUSES);
const VALID_CURRENCIES = new Set<string>(SUPABASE_CURRENCIES);

export function mapLegacyFirestoreProfileToSupabaseRecord(
  supabaseUserId: string,
  legacyProfile: LegacyFirestoreProfileInput,
  legacyPgUser?: { displayName?: string | null; photoUrl?: string | null }
) {
  const normalizedCountryCode = legacyProfile.countryCode
    ? legacyProfile.countryCode.trim().toUpperCase().slice(0, 2)
    : null;
  const normalizedCurrency = legacyProfile.currency
    ? legacyProfile.currency.trim().toUpperCase()
    : null;

  return {
    id: supabaseUserId,
    firebase_uid: legacyProfile.uid.trim(),
    email: legacyProfile.email.trim().toLowerCase(),
    name: legacyProfile.name.trim() || "Utilisateur",
    display_name: legacyPgUser?.displayName ?? legacyProfile.name.trim(),
    photo_url: legacyPgUser?.photoUrl ?? null,
    company: legacyProfile.company?.trim() || null,
    country: legacyProfile.country?.trim() || null,
    country_code:
      normalizedCountryCode && /^[A-Z]{2}$/.test(normalizedCountryCode)
        ? normalizedCountryCode
        : null,
    city: legacyProfile.city?.trim() || null,
    payment_gateway: legacyProfile.paymentGateway?.trim() || null,
    currency:
      normalizedCurrency && VALID_CURRENCIES.has(normalizedCurrency)
        ? normalizedCurrency
        : null,
    role:
      legacyProfile.role && VALID_ROLES.has(legacyProfile.role)
        ? legacyProfile.role
        : "client",
    account_type:
      legacyProfile.accountType && VALID_ACCOUNT_TYPES.has(legacyProfile.accountType)
        ? legacyProfile.accountType
        : "basic",
    subscription_plan:
      legacyProfile.subscriptionPlan &&
      VALID_BILLING_CYCLES.has(legacyProfile.subscriptionPlan)
        ? legacyProfile.subscriptionPlan
        : "monthly",
    status:
      legacyProfile.status && VALID_PROFILE_STATUSES.has(legacyProfile.status)
        ? legacyProfile.status
        : "pending_activation",
    login_count: Math.max(0, Math.floor(legacyProfile.loginCount ?? 0)),
    projects_count: Math.max(0, Math.floor(legacyProfile.projectsCount ?? 0)),
    storage_used_kb: Math.max(0, Math.floor(legacyProfile.storageUsedKb ?? 0)),
    last_login_at: legacyProfile.lastLoginAt ?? null,
  };
}

export function mapLegacyPostgresProjectToSupabaseRecord(
  ownerSupabaseUserId: string,
  legacyProject: LegacyPostgresProjectInput
) {
  const normalizedStatus = legacyProject.status?.trim() ?? "draft";
  return {
    legacy_pg_id: legacyProject.id,
    owner_id: ownerSupabaseUserId,
    legacy_firebase_uid: legacyProject.uid.trim(),
    tenant_id: legacyProject.uid.trim(),
    name: legacyProject.name.trim() || "Projet sans titre",
    description: legacyProject.description ?? null,
    module: legacyProject.module?.trim() || "isometric",
    status: VALID_PROJECT_STATUSES.has(normalizedStatus) ? normalizedStatus : "draft",
    drive_file_id: legacyProject.driveFileId ?? null,
    drive_folder_id: legacyProject.driveFolderId ?? null,
    drive_web_view_link: legacyProject.driveWebViewLink ?? null,
    data: legacyProject.data ?? {},
  };
}
