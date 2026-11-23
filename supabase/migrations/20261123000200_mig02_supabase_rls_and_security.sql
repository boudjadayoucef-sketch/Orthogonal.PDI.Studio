-- =============================================================================
-- ORTHOGONAL PD&I STUDIO — MIG-02 (02/02)
-- Migration SQL versionnée : Row Level Security (RLS), Privilèges & Triggers Zero-Trust
--
-- Principes de sécurité appliqués :
--   1. Deny-by-default : `REVOKE ALL` pour `PUBLIC` et `anon` sur toutes les tables.
--   2. RLS activé ET forcé (`ENABLE` + `FORCE ROW LEVEL SECURITY`) sur les 12 tables.
--   3. Aucune confiance dans les métadonnées JWT modifiables par le navigateur.
--   4. Le rôle `super_admin` est vérifié côté serveur dans `public.profiles` + `auth.users.email_confirmed_at`.
--   5. Aucune requête cliente ne peut attribuer ou modifier un rôle, un statut d'activation,
--      un abonnement, une licence, un paiement, un mapping UID ou un journal d'audit.
--   6. Défense en profondeur : triggers `BEFORE INSERT/UPDATE` en complément des politiques RLS.
-- =============================================================================

-- =============================================================================
-- 1. FONCTIONS D'AUTORISATION SERVEUR (SECURITY DEFINER, SEARCH_PATH VERROUILLÉ)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public, auth
AS $$
  SELECT current_user IN ('service_role', 'postgres', 'supabase_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_auth_email_matches(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM auth.users u
       WHERE u.id = auth.uid()
         AND lower(u.email) = lower(p_email)
     );
$$;

-- Autorité serveur uniquement : vérifie le rôle dans public.profiles + email vérifié dans auth.users.
-- Ne lit JAMAIS `user_metadata` ni un champ de rôle envoyé par le navigateur.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       JOIN auth.users u ON u.id = p.id
       WHERE p.id = auth.uid()
         AND p.role = 'super_admin'
         AND p.status = 'active'
         AND u.email_confirmed_at IS NOT NULL
     );
$$;

CREATE OR REPLACE FUNCTION public.is_project_owner(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.projects pr
       WHERE pr.id = p_project_id
         AND pr.owner_id = auth.uid()
     );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       EXISTS (
         SELECT 1
         FROM public.projects pr
         WHERE pr.id = p_project_id
           AND pr.owner_id = auth.uid()
       )
       OR EXISTS (
         SELECT 1
         FROM public.project_members pm
         WHERE pm.project_id = p_project_id
           AND pm.user_id = auth.uid()
       )
     );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND (
       EXISTS (
         SELECT 1
         FROM public.projects pr
         WHERE pr.id = p_project_id
           AND pr.owner_id = auth.uid()
       )
       OR EXISTS (
         SELECT 1
         FROM public.project_members pm
         WHERE pm.project_id = p_project_id
           AND pm.user_id = auth.uid()
           AND pm.member_role IN ('owner', 'editor')
       )
     );
$$;

CREATE OR REPLACE FUNCTION public.current_user_matches_profile_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(p.email) = lower(p_email)
     );
$$;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_auth_email_matches(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_project_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_project_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_edit_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_user_matches_profile_email(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_auth_email_matches(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_edit_project(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_matches_profile_email(text) TO authenticated, service_role;

-- =============================================================================
-- 2. TRIGGERS DE DÉFENSE EN PROFONDEUR (PROTECTION COLONNES PRIVILÉGIÉES)
-- =============================================================================

-- 2.1 Profiles : interdit toute auto-attribution ou modification de rôle, statut,
-- abonnement, compteurs serveur ou identité par une requête cliente.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT public.current_auth_email_matches(NEW.email) THEN
      RAISE EXCEPTION 'Forbidden: profile email must match authenticated auth.users email.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM 'client' THEN
      RAISE EXCEPTION 'Forbidden: client requests cannot assign privileged or non-client role (%).', NEW.role
        USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM 'pending_activation' THEN
      RAISE EXCEPTION 'Forbidden: client-created profiles must start with pending_activation status.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.account_type IS DISTINCT FROM 'basic' OR NEW.subscription_plan IS DISTINCT FROM 'monthly' THEN
      RAISE EXCEPTION 'Forbidden: client-created profiles cannot set paid plan or billing cycle.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.firebase_uid IS NOT NULL OR NEW.payment_gateway IS NOT NULL THEN
      RAISE EXCEPTION 'Forbidden: firebase_uid and payment_gateway are reserved to server authority.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.login_count <> 0 OR NEW.projects_count <> 0 OR NEW.storage_used_kb <> 0 OR NEW.last_login_at IS NOT NULL THEN
      RAISE EXCEPTION 'Forbidden: server telemetry counters cannot be initialized by client.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.firebase_uid IS DISTINCT FROM OLD.firebase_uid
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.account_type IS DISTINCT FROM OLD.account_type
       OR NEW.subscription_plan IS DISTINCT FROM OLD.subscription_plan
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.payment_gateway IS DISTINCT FROM OLD.payment_gateway
       OR NEW.currency IS DISTINCT FROM OLD.currency
       OR NEW.login_count IS DISTINCT FROM OLD.login_count
       OR NEW.projects_count IS DISTINCT FROM OLD.projects_count
       OR NEW.storage_used_kb IS DISTINCT FROM OLD.storage_used_kb
       OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Forbidden: privileged or server-managed profile fields cannot be modified from client requests.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_guard_privileged_fields ON public.profiles;
CREATE TRIGGER trg_profiles_guard_privileged_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- 2.2 Projects : immuabilité de owner_id, tenant_id et identifiants hérités côté client.
CREATE OR REPLACE FUNCTION public.guard_project_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.legacy_pg_id IS NOT NULL
       OR NEW.legacy_firestore_id IS NOT NULL
       OR NEW.legacy_firebase_uid IS NOT NULL
    THEN
      RAISE EXCEPTION 'Forbidden: legacy migration identifiers on projects are reserved to server authority.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.legacy_pg_id IS DISTINCT FROM OLD.legacy_pg_id
       OR NEW.legacy_firestore_id IS DISTINCT FROM OLD.legacy_firestore_id
       OR NEW.legacy_firebase_uid IS DISTINCT FROM OLD.legacy_firebase_uid
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Forbidden: project ownership and legacy identifiers are immutable for client requests.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_guard_immutability ON public.projects;
CREATE TRIGGER trg_projects_guard_immutability
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_immutability();

-- 2.3 Project members : empêche d'attribuer le rôle 'owner' à un tiers non propriétaire du projet.
CREATE OR REPLACE FUNCTION public.guard_project_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_project_owner uuid;
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_project_owner
  FROM public.projects
  WHERE id = NEW.project_id;

  IF NEW.member_role = 'owner' AND (v_project_owner IS NULL OR NEW.user_id IS DISTINCT FROM v_project_owner) THEN
    RAISE EXCEPTION 'Forbidden: cannot assign project owner role to another user via project_members.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (NEW.project_id IS DISTINCT FROM OLD.project_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Forbidden: project_id and user_id cannot be reassigned on project_members.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_members_guard_role ON public.project_members;
CREATE TRIGGER trg_project_members_guard_role
  BEFORE INSERT OR UPDATE ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_member_role();

-- 2.4 Project files : immuabilité de project_id, owner_id, identifiants hérités et created_at côté client.
CREATE OR REPLACE FUNCTION public.guard_project_file_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.legacy_drive_record_id IS NOT NULL
       OR NEW.legacy_isometric_id IS NOT NULL
    THEN
      RAISE EXCEPTION 'Forbidden: legacy migration identifiers on project_files are reserved to server authority.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.project_id IS DISTINCT FROM OLD.project_id
       OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
       OR NEW.legacy_drive_record_id IS DISTINCT FROM OLD.legacy_drive_record_id
       OR NEW.legacy_isometric_id IS DISTINCT FROM OLD.legacy_isometric_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Forbidden: project_file ownership and project linkage are immutable.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_files_guard_immutability ON public.project_files;
CREATE TRIGGER trg_project_files_guard_immutability
  BEFORE INSERT OR UPDATE ON public.project_files
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_project_file_immutability();

-- 2.5 Feedback : à la création, statut figé à 'new' et admin_notes NULL ;
-- à la mise à jour (super_admin vérifié uniquement), seuls status et admin_notes sont modifiables.
CREATE OR REPLACE FUNCTION public.guard_feedback_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'new' OR NEW.admin_notes IS NOT NULL THEN
      RAISE EXCEPTION 'Forbidden: client-submitted feedback must use status=new and null admin_notes.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.user_email IS DISTINCT FROM OLD.user_email
       OR NEW.user_name IS DISTINCT FROM OLD.user_name
       OR NEW.category IS DISTINCT FROM OLD.category
       OR NEW.rating IS DISTINCT FROM OLD.rating
       OR NEW.title IS DISTINCT FROM OLD.title
       OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Forbidden: only status and admin_notes may be updated on feedback.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_guard_fields ON public.feedback;
CREATE TRIGGER trg_feedback_guard_fields
  BEFORE INSERT OR UPDATE ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_feedback_fields();

-- =============================================================================
-- 3. RÉVOCATION EXPLICITE DES PRIVILÈGES PAR DÉFAUT (ZERO-TRUST / DENY ANON)
-- =============================================================================

REVOKE ALL ON TABLE
  public.profiles,
  public.user_identity_mappings,
  public.projects,
  public.project_members,
  public.project_files,
  public.license_keys,
  public.subscriptions,
  public.payments,
  public.connection_logs,
  public.subscriber_usage,
  public.audit_logs,
  public.feedback
FROM PUBLIC, anon, authenticated;

-- Privilèges minimaux stricts pour `authenticated` (les écritures sensibles restent révoquées)
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.user_identity_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.project_files TO authenticated;
GRANT SELECT ON TABLE public.license_keys TO authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.connection_logs TO authenticated;
GRANT SELECT, INSERT ON TABLE public.subscriber_usage TO authenticated;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.feedback TO authenticated;

-- Privilèges complets réservés à l'autorité serveur `service_role`
GRANT ALL ON TABLE
  public.profiles,
  public.user_identity_mappings,
  public.projects,
  public.project_members,
  public.project_files,
  public.license_keys,
  public.subscriptions,
  public.payments,
  public.connection_logs,
  public.subscriber_usage,
  public.audit_logs,
  public.feedback
TO service_role;

-- =============================================================================
-- 4. ACTIVATION ET FORÇAGE DE ROW LEVEL SECURITY SUR LES 12 TABLES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_identity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_identity_mappings FORCE ROW LEVEL SECURITY;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files FORCE ROW LEVEL SECURITY;

ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.connection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.subscriber_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriber_usage FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback FORCE ROW LEVEL SECURITY;

-- =============================================================================
-- 5. POLITIQUES ROW LEVEL SECURITY (RESTRICTIVES PAR DÉFAUT)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 5.1 public.profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_service_role_all ON public.profiles;
CREATE POLICY profiles_service_role_all
  ON public.profiles FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS profiles_select_self_or_super_admin ON public.profiles;
CREATE POLICY profiles_select_self_or_super_admin
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS profiles_insert_self_client_only ON public.profiles;
CREATE POLICY profiles_insert_self_client_only
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND role = 'client'
    AND status = 'pending_activation'
    AND account_type = 'basic'
    AND subscription_plan = 'monthly'
    AND firebase_uid IS NULL
  );

DROP POLICY IF EXISTS profiles_update_self_presentation_only ON public.profiles;
CREATE POLICY profiles_update_self_presentation_only
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 5.2 public.user_identity_mappings (lecture propre/super_admin, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS identity_mappings_service_role_all ON public.user_identity_mappings;
CREATE POLICY identity_mappings_service_role_all
  ON public.user_identity_mappings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS identity_mappings_select_self_or_super_admin ON public.user_identity_mappings;
CREATE POLICY identity_mappings_select_self_or_super_admin
  ON public.user_identity_mappings FOR SELECT TO authenticated
  USING (supabase_user_id = auth.uid() OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.3 public.projects
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_service_role_all ON public.projects;
CREATE POLICY projects_service_role_all
  ON public.projects FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS projects_select_member_or_super_admin ON public.projects;
CREATE POLICY projects_select_member_or_super_admin
  ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(id) OR public.is_super_admin());

DROP POLICY IF EXISTS projects_insert_owner_only ON public.projects;
CREATE POLICY projects_insert_owner_only
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND owner_id = auth.uid());

DROP POLICY IF EXISTS projects_update_authorized_member ON public.projects;
CREATE POLICY projects_update_authorized_member
  ON public.projects FOR UPDATE TO authenticated
  USING (public.can_edit_project(id))
  WITH CHECK (public.can_edit_project(id));

DROP POLICY IF EXISTS projects_delete_owner_or_super_admin ON public.projects;
CREATE POLICY projects_delete_owner_or_super_admin
  ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.4 public.project_members
-- Un utilisateur ne peut jamais s'auto-attribuer l'accès au projet d'autrui.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS project_members_service_role_all ON public.project_members;
CREATE POLICY project_members_service_role_all
  ON public.project_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS project_members_select_self_or_owner_or_super_admin ON public.project_members;
CREATE POLICY project_members_select_self_or_owner_or_super_admin
  ON public.project_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_owner(project_id)
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS project_members_insert_project_owner_only ON public.project_members;
CREATE POLICY project_members_insert_project_owner_only
  ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_project_owner(project_id)
    AND member_role IN ('editor', 'viewer')
    AND (invited_by IS NULL OR invited_by = auth.uid())
  );

DROP POLICY IF EXISTS project_members_update_project_owner_only ON public.project_members;
CREATE POLICY project_members_update_project_owner_only
  ON public.project_members FOR UPDATE TO authenticated
  USING (public.is_project_owner(project_id))
  WITH CHECK (
    public.is_project_owner(project_id)
    AND member_role IN ('editor', 'viewer')
  );

DROP POLICY IF EXISTS project_members_delete_owner_or_self_leave ON public.project_members;
CREATE POLICY project_members_delete_owner_or_self_leave
  ON public.project_members FOR DELETE TO authenticated
  USING (
    public.is_project_owner(project_id)
    OR user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 5.5 public.project_files
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS project_files_service_role_all ON public.project_files;
CREATE POLICY project_files_service_role_all
  ON public.project_files FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS project_files_select_member_or_super_admin ON public.project_files;
CREATE POLICY project_files_select_member_or_super_admin
  ON public.project_files FOR SELECT TO authenticated
  USING (public.is_project_member(project_id) OR public.is_super_admin());

DROP POLICY IF EXISTS project_files_insert_editor_only ON public.project_files;
CREATE POLICY project_files_insert_editor_only
  ON public.project_files FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_project(project_id)
    AND owner_id = auth.uid()
  );

DROP POLICY IF EXISTS project_files_update_editor_only ON public.project_files;
CREATE POLICY project_files_update_editor_only
  ON public.project_files FOR UPDATE TO authenticated
  USING (public.can_edit_project(project_id))
  WITH CHECK (public.can_edit_project(project_id));

DROP POLICY IF EXISTS project_files_delete_editor_or_super_admin ON public.project_files;
CREATE POLICY project_files_delete_editor_or_super_admin
  ON public.project_files FOR DELETE TO authenticated
  USING (public.can_edit_project(project_id) OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.6 public.license_keys (lecture limitée au titulaire ou super_admin, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS license_keys_service_role_all ON public.license_keys;
CREATE POLICY license_keys_service_role_all
  ON public.license_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS license_keys_select_assigned_or_super_admin ON public.license_keys;
CREATE POLICY license_keys_select_assigned_or_super_admin
  ON public.license_keys FOR SELECT TO authenticated
  USING (
    assigned_user_id = auth.uid()
    OR activated_by_user_id = auth.uid()
    OR public.is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- 5.7 public.subscriptions (lecture propre/super_admin, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscriptions_service_role_all ON public.subscriptions;
CREATE POLICY subscriptions_service_role_all
  ON public.subscriptions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS subscriptions_select_self_or_super_admin ON public.subscriptions;
CREATE POLICY subscriptions_select_self_or_super_admin
  ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.8 public.payments (Zero-Trust : lecture propre/super_admin, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS payments_service_role_all ON public.payments;
CREATE POLICY payments_service_role_all
  ON public.payments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS payments_select_self_or_super_admin ON public.payments;
CREATE POLICY payments_select_self_or_super_admin
  ON public.payments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.9 public.connection_logs (immuable côté client, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS connection_logs_service_role_all ON public.connection_logs;
CREATE POLICY connection_logs_service_role_all
  ON public.connection_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS connection_logs_select_self_or_super_admin ON public.connection_logs;
CREATE POLICY connection_logs_select_self_or_super_admin
  ON public.connection_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.10 public.subscriber_usage (append-only propre côté client, aucune modification/suppression)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS subscriber_usage_service_role_all ON public.subscriber_usage;
CREATE POLICY subscriber_usage_service_role_all
  ON public.subscriber_usage FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS subscriber_usage_select_self_or_super_admin ON public.subscriber_usage;
CREATE POLICY subscriber_usage_select_self_or_super_admin
  ON public.subscriber_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS subscriber_usage_insert_self_only ON public.subscriber_usage;
CREATE POLICY subscriber_usage_insert_self_only
  ON public.subscriber_usage FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_matches_profile_email(user_email)
  );

-- -----------------------------------------------------------------------------
-- 5.11 public.audit_logs (lecture super_admin vérifié uniquement, écriture serveur uniquement)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_service_role_all ON public.audit_logs;
CREATE POLICY audit_logs_service_role_all
  ON public.audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS audit_logs_select_super_admin_only ON public.audit_logs;
CREATE POLICY audit_logs_select_super_admin_only
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 5.12 public.feedback (soumission propre, triage super_admin vérifié, aucune suppression client)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS feedback_service_role_all ON public.feedback;
CREATE POLICY feedback_service_role_all
  ON public.feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS feedback_select_self_or_super_admin ON public.feedback;
CREATE POLICY feedback_select_self_or_super_admin
  ON public.feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS feedback_insert_self_only ON public.feedback;
CREATE POLICY feedback_insert_self_only
  ON public.feedback FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.current_user_matches_profile_email(user_email)
    AND status = 'new'
    AND admin_notes IS NULL
  );

DROP POLICY IF EXISTS feedback_update_super_admin_only ON public.feedback;
CREATE POLICY feedback_update_super_admin_only
  ON public.feedback FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
