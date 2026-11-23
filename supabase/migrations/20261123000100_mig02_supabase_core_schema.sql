-- =============================================================================
-- ORTHOGONAL PD&I STUDIO — MIG-02 (01/02)
-- Migration SQL versionnée : Schéma PostgreSQL cible compatible Supabase
--
-- Objectif :
--   Créer l'architecture relationnelle cible pour la migration progressive
--   Firebase -> Supabase sans modifier Firebase ni déplacer les données prod.
--
-- Principes :
--   - Reproductible sur un projet Supabase vierge (PostgreSQL 15+).
--   - Non destructif (aucun DROP TABLE / TRUNCATE).
--   - Zéro mot de passe, zéro secret API, zéro clé privée dans les tables métier.
--   - Compatibilité transitionnelle avec les UID Firebase et IDs hérités.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. FONCTION UTILITAIRE DE MISE À JOUR AUTOMATIQUE `updated_at`
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. IDENTITÉ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 public.profiles
-- Source d'audit : Firestore `profiles/{uid}` (`PdiUserProfile`) + PostgreSQL `users`
-- `id` référence strictement `auth.users(id)` (UUID Supabase Auth).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  firebase_uid text UNIQUE CHECK (firebase_uid IS NULL OR char_length(btrim(firebase_uid)) BETWEEN 1 AND 128),
  email text NOT NULL CHECK (char_length(btrim(email)) BETWEEN 3 AND 320),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  display_name text CHECK (display_name IS NULL OR char_length(display_name) <= 120),
  photo_url text CHECK (photo_url IS NULL OR char_length(photo_url) <= 2048),
  company text CHECK (company IS NULL OR char_length(company) <= 150),
  country text CHECK (country IS NULL OR char_length(country) <= 100),
  country_code char(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  city text CHECK (city IS NULL OR char_length(city) <= 100),
  payment_gateway text CHECK (payment_gateway IS NULL OR char_length(payment_gateway) <= 60),
  currency text CHECK (currency IS NULL OR currency IN ('DZD', 'EUR', 'USD')),
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('super_admin', 'admin', 'client', 'guest', 'demo')),
  account_type text NOT NULL DEFAULT 'basic' CHECK (account_type IN ('basic', 'pro', 'team', 'enterprise')),
  subscription_plan text NOT NULL DEFAULT 'monthly' CHECK (subscription_plan IN ('monthly', 'yearly', 'trial', 'lifetime')),
  status text NOT NULL DEFAULT 'pending_activation' CHECK (status IN ('active', 'suspended', 'pending_activation', 'revoked', 'disabled')),
  login_count integer NOT NULL DEFAULT 0 CHECK (login_count >= 0),
  projects_count integer NOT NULL DEFAULT 0 CHECK (projects_count >= 0),
  storage_used_kb integer NOT NULL DEFAULT 0 CHECK (storage_used_kb >= 0),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_lower_unique
  ON public.profiles (lower(email));

CREATE INDEX IF NOT EXISTS idx_profiles_role_status
  ON public.profiles (role, status);

CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at
  ON public.profiles (last_login_at DESC);

DROP TRIGGER IF EXISTS trg_profiles_set_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 1.2 public.user_identity_mappings
-- Table dédiée de correspondance bijective Firebase UID <-> Supabase Auth UUID
-- Permet une migration progressive et traçable sans remplacer les UID existants.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_identity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  firebase_uid text NOT NULL UNIQUE CHECK (char_length(btrim(firebase_uid)) BETWEEN 1 AND 128),
  firebase_email text NOT NULL CHECK (char_length(btrim(firebase_email)) BETWEEN 3 AND 320),
  migration_status text NOT NULL DEFAULT 'pending' CHECK (migration_status IN ('pending', 'verified', 'migrated', 'revoked')),
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_identity_mappings_email_lower
  ON public.user_identity_mappings (lower(firebase_email));

CREATE INDEX IF NOT EXISTS idx_user_identity_mappings_status
  ON public.user_identity_mappings (migration_status);

DROP TRIGGER IF EXISTS trg_user_identity_mappings_set_updated_at ON public.user_identity_mappings;
CREATE TRIGGER trg_user_identity_mappings_set_updated_at
  BEFORE UPDATE ON public.user_identity_mappings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- =============================================================================
-- 2. PROJETS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 public.projects
-- Source d'audit : PostgreSQL `projects` (`src/db/schema.ts`) + Firestore `projects/{id}` (`PdiSaasProject`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_pg_id integer UNIQUE CHECK (legacy_pg_id IS NULL OR legacy_pg_id > 0),
  legacy_firestore_id text UNIQUE CHECK (legacy_firestore_id IS NULL OR char_length(btrim(legacy_firestore_id)) BETWEEN 1 AND 128),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legacy_firebase_uid text CHECK (legacy_firebase_uid IS NULL OR char_length(btrim(legacy_firebase_uid)) BETWEEN 1 AND 128),
  tenant_id text CHECK (tenant_id IS NULL OR char_length(btrim(tenant_id)) BETWEEN 1 AND 128),
  code text CHECK (code IS NULL OR char_length(code) <= 100),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  description text,
  module text NOT NULL DEFAULT 'isometric' CHECK (char_length(btrim(module)) BETWEEN 1 AND 64),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'approved', 'as_built', 'archived', 'published')),
  drive_file_id text,
  drive_folder_id text,
  drive_web_view_link text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_updated
  ON public.projects (owner_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_tenant_id
  ON public.projects (tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_legacy_firebase_uid
  ON public.projects (legacy_firebase_uid)
  WHERE legacy_firebase_uid IS NOT NULL;

DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON public.projects;
CREATE TRIGGER trg_projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 2.2 public.project_members
-- Contrôle d'accès collaboratif par projet (`owner`, `editor`, `viewer`).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'viewer' CHECK (member_role IN ('owner', 'editor', 'viewer')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_members_project_user UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user_id
  ON public.project_members (user_id);

CREATE INDEX IF NOT EXISTS idx_project_members_project_role
  ON public.project_members (project_id, member_role);

DROP TRIGGER IF EXISTS trg_project_members_set_updated_at ON public.project_members;
CREATE TRIGGER trg_project_members_set_updated_at
  BEFORE UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 2.3 public.project_files
-- Source d'audit : PostgreSQL `drive_files` + Firestore `projects/{id}/isometrics/{isoId}` (`PdiSaasIsometric`)
-- Unifie les fichiers Google Drive et les plans isométriques rattachés à un projet.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  legacy_drive_record_id integer UNIQUE CHECK (legacy_drive_record_id IS NULL OR legacy_drive_record_id > 0),
  legacy_isometric_id text CHECK (legacy_isometric_id IS NULL OR char_length(btrim(legacy_isometric_id)) BETWEEN 1 AND 128),
  file_kind text NOT NULL DEFAULT 'drive_file' CHECK (file_kind IN ('drive_file', 'isometric', 'cad_export', 'attachment')),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 255),
  mime_type text NOT NULL DEFAULT 'application/json' CHECK (char_length(btrim(mime_type)) BETWEEN 1 AND 150),
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  size_label text CHECK (size_label IS NULL OR char_length(size_label) <= 64),
  drive_file_id text,
  web_view_link text,
  icon_link text,
  thumbnail_link text,
  is_pdi_project boolean NOT NULL DEFAULT false,
  drawing_number text CHECK (drawing_number IS NULL OR char_length(drawing_number) <= 100),
  line_pid text CHECK (line_pid IS NULL OR char_length(line_pid) <= 100),
  fluid_code text CHECK (fluid_code IS NULL OR char_length(fluid_code) <= 50),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'as_built', 'archived')),
  data_json jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_files_project_legacy_iso_unique
  ON public.project_files (project_id, legacy_isometric_id)
  WHERE legacy_isometric_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_files_project_id
  ON public.project_files (project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_files_owner_id
  ON public.project_files (owner_id);

CREATE INDEX IF NOT EXISTS idx_project_files_drive_file_id
  ON public.project_files (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_project_files_set_updated_at ON public.project_files;
CREATE TRIGGER trg_project_files_set_updated_at
  BEFORE UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- =============================================================================
-- 3. LICENCES ET ABONNEMENTS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3.1 public.license_keys
-- Source d'audit : Firestore `license_keys/{keyId}` (`PdiLicenseKey`)
-- Gestion exclusivement serveur (`service_role`).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_firestore_id text UNIQUE CHECK (legacy_firestore_id IS NULL OR char_length(btrim(legacy_firestore_id)) BETWEEN 1 AND 128),
  code text NOT NULL UNIQUE CHECK (char_length(btrim(code)) BETWEEN 4 AND 128),
  type text NOT NULL CHECK (char_length(btrim(type)) BETWEEN 1 AND 64),
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'team', 'enterprise')),
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated', 'active', 'revoked', 'expired')),
  assigned_to_email text CHECK (assigned_to_email IS NULL OR char_length(btrim(assigned_to_email)) BETWEEN 3 AND 320),
  assigned_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_by_email text CHECK (activated_by_email IS NULL OR char_length(btrim(activated_by_email)) BETWEEN 3 AND 320),
  activated_by_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  activated_at timestamptz,
  expires_at timestamptz NOT NULL,
  max_users integer NOT NULL DEFAULT 1 CHECK (max_users >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_keys_assigned_user_id
  ON public.license_keys (assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_license_keys_activated_by_user_id
  ON public.license_keys (activated_by_user_id)
  WHERE activated_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_license_keys_status_expires
  ON public.license_keys (status, expires_at);

DROP TRIGGER IF EXISTS trg_license_keys_set_updated_at ON public.license_keys;
CREATE TRIGGER trg_license_keys_set_updated_at
  BEFORE UPDATE ON public.license_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 3.2 public.subscriptions
-- Source d'audit : `profiles.accountType/subscriptionPlan/status`, `paddleDetails.subscriptionId`, `license_keys`
-- Sépare l'état d'abonnement autoritatif du profil utilisateur (écriture serveur uniquement).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic', 'pro', 'team', 'enterprise')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'trial', 'lifetime')),
  status text NOT NULL DEFAULT 'pending_activation' CHECK (status IN ('active', 'pending_activation', 'past_due', 'canceled', 'suspended', 'expired', 'revoked')),
  provider text CHECK (provider IS NULL OR provider IN ('paddle', 'slickpay_baridimob', 'license_key', 'manual_admin')),
  provider_subscription_id text UNIQUE CHECK (provider_subscription_id IS NULL OR char_length(btrim(provider_subscription_id)) BETWEEN 1 AND 128),
  license_key_id uuid REFERENCES public.license_keys(id) ON DELETE SET NULL,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_subscriptions_period_order CHECK (
    current_period_start IS NULL OR current_period_end IS NULL OR current_period_end >= current_period_start
  )
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

CREATE INDEX IF NOT EXISTS idx_subscriptions_license_key_id
  ON public.subscriptions (license_key_id)
  WHERE license_key_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER trg_subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- -----------------------------------------------------------------------------
-- 3.3 public.payments
-- Source d'audit : Firestore `payment_transactions` (`AuthoritativePendingOrder` / `PdiPaymentTransaction`)
-- Écriture strictement réservée au serveur (`service_role`). Zéro secret webhook stocké.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL UNIQUE CHECK (order_id ~ '^ORD_(PADDLE|SLICKPAY)_[A-Za-z0-9_-]{1,110}$'),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  legacy_firebase_uid text CHECK (legacy_firebase_uid IS NULL OR char_length(btrim(legacy_firebase_uid)) BETWEEN 1 AND 128),
  user_email text NOT NULL CHECK (char_length(btrim(user_email)) BETWEEN 3 AND 320),
  user_name text CHECK (user_name IS NULL OR char_length(user_name) <= 120),
  company text CHECK (company IS NULL OR char_length(company) <= 150),
  country text CHECK (country IS NULL OR char_length(country) <= 100),
  country_code char(2) CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  city text CHECK (city IS NULL OR char_length(city) <= 100),
  plan text NOT NULL CHECK (plan IN ('basic', 'pro', 'team', 'enterprise')),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'trial', 'lifetime')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency IN ('DZD', 'EUR', 'USD')),
  provider text NOT NULL CHECK (provider IN ('paddle', 'slickpay_baridimob')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  association_status text NOT NULL DEFAULT 'unassociated' CHECK (association_status IN ('unassociated', 'associated')),
  provider_transaction_id text CHECK (provider_transaction_id IS NULL OR char_length(btrim(provider_transaction_id)) BETWEEN 1 AND 128),
  last_event_id text CHECK (last_event_id IS NULL OR char_length(btrim(last_event_id)) BETWEEN 1 AND 128),
  last_event_type text CHECK (last_event_type IS NULL OR char_length(btrim(last_event_type)) BETWEEN 1 AND 128),
  associated_at timestamptz,
  provider_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_tx_unique
  ON public.payments (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_status
  ON public.payments (status, association_status);

DROP TRIGGER IF EXISTS trg_payments_set_updated_at ON public.payments;
CREATE TRIGGER trg_payments_set_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- =============================================================================
-- 4. SÉCURITÉ ET TRAÇABILITÉ
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 4.1 public.connection_logs
-- Source d'audit : Firestore `connection_logs` (`PdiConnectionLog`)
-- Journal immuable côté client (écriture serveur uniquement).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL CHECK (char_length(btrim(user_email)) BETWEEN 3 AND 320),
  user_name text CHECK (user_name IS NULL OR char_length(user_name) <= 100),
  user_role text CHECK (user_role IS NULL OR user_role IN ('super_admin', 'admin', 'client', 'guest', 'demo')),
  account_type text CHECK (account_type IS NULL OR account_type IN ('basic', 'pro', 'team', 'enterprise')),
  ip_address text CHECK (ip_address IS NULL OR char_length(ip_address) <= 64),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  device text CHECK (device IS NULL OR char_length(device) <= 100),
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connection_logs_user_occurred
  ON public.connection_logs (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_connection_logs_occurred
  ON public.connection_logs (occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 4.2 public.subscriber_usage
-- Source d'audit : Firestore `subscriber_usage` (`PdiSubscriberUsage`)
-- Append-only côté client pour l'utilisateur authentifié ; aucune modification/suppression.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriber_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL CHECK (char_length(btrim(user_email)) BETWEEN 3 AND 320),
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 1 AND 128),
  module text NOT NULL CHECK (char_length(btrim(module)) BETWEEN 1 AND 64),
  details text CHECK (details IS NULL OR char_length(details) <= 1000),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriber_usage_user_occurred
  ON public.subscriber_usage (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriber_usage_module
  ON public.subscriber_usage (module, occurred_at DESC);

-- -----------------------------------------------------------------------------
-- 4.3 public.audit_logs
-- Journal d'audit serveur autoritatif (rôles, paiements, webhooks, activations, admin).
-- Écriture exclusivement `service_role`, lecture `super_admin` vérifié ou `service_role`.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (char_length(btrim(event_type)) BETWEEN 1 AND 128),
  resource_type text NOT NULL CHECK (char_length(btrim(resource_type)) BETWEEN 1 AND 64),
  resource_id text CHECK (resource_id IS NULL OR char_length(resource_id) <= 128),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_target
  ON public.audit_logs (actor_user_id, target_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type
  ON public.audit_logs (event_type, created_at DESC);

-- =============================================================================
-- 5. SUPPORT
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 public.feedback
-- Source d'audit : Firestore `user_feedbacks` / `feedbacks` (`PdiUserFeedback`)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_email text NOT NULL CHECK (char_length(btrim(user_email)) BETWEEN 3 AND 320),
  user_name text CHECK (user_name IS NULL OR char_length(user_name) <= 100),
  category text NOT NULL CHECK (category IN ('feature_request', 'bug_report', 'general_feedback', 'satisfaction')),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'in_progress', 'resolved')),
  admin_notes text CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_created
  ON public.feedback (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created
  ON public.feedback (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_feedback_set_updated_at ON public.feedback;
CREATE TRIGGER trg_feedback_set_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.set_current_timestamp_updated_at();
