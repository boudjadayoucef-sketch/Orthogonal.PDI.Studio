-- =============================================================================
-- ORTHOGONAL PD&I STUDIO — MIG-02-FIX-01 (03/03)
-- Migration SQL corrective versionnée : Correction du contrôle d'autorité serveur
-- dans `is_service_role()` et suppression du contexte `SECURITY DEFINER` sur
-- `guard_project_member_role()`.
--
-- Cause corrigée :
--   Dans PostgreSQL, à l'intérieur d'une fonction `SECURITY DEFINER` détenue par
--   `postgres` / `supabase_admin`, `current_user` prend la valeur du propriétaire
--   de la fonction et non celle du rôle appelant (`authenticated`).
--   Un contrôle `is_service_role()` fondé sur `current_user` pouvait donc accorder
--   à tort les privilèges serveur à un appelant `authenticated` lorsqu'il était
--   invoqué depuis `guard_project_member_role()` (ou toute autre fonction
--   `SECURITY DEFINER`).
--
-- Principes de la correction :
--   1. `public.is_service_role()` n'utilise JAMAIS `current_user`.
--      - Si un rôle PostgreSQL explicite est actif via `SET ROLE` / `SET LOCAL ROLE`
--        (comportement systématique de PostgREST : `anon`, `authenticated`,
--        `service_role`), la GUC `current_setting('role', true)` conserve le rôle
--        réel de l'appelant même à l'intérieur d'une fonction `SECURITY DEFINER`.
--      - Si aucun `SET ROLE` n'est actif (`role = 'none'`), seule une session
--        administrative directe (`session_user` dans `service_role`, `postgres`,
--        `supabase_admin`) sans identité JWT cliente (`auth.uid() IS NULL` et
--        `auth.role()` hors `authenticated`/`anon`) est reconnue comme serveur.
--   2. `public.guard_project_member_role()` passe explicitement en `SECURITY INVOKER`
--      et verrouille `member_role = 'owner'`, `project_id`, `user_id`, `invited_by`
--      et `created_at` pour toute requête non-serveur.
--   3. Non destructif : conserve l'historique des migrations 01 et 02 intact.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CORRECTION DE `public.is_service_role()` (IMMUNISÉ CONTRE SECURITY DEFINER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_guc_role text := NULLIF(btrim(COALESCE(current_setting('role', true), '')), '');
BEGIN
  -- 1. Rôle actif explicite (SET ROLE / SET LOCAL ROLE via PostgREST ou transaction serveur).
  --    La GUC PostgreSQL `role` n'est jamais élevée par SECURITY DEFINER.
  IF v_guc_role IS NOT NULL AND v_guc_role <> 'none' THEN
    RETURN v_guc_role IN ('service_role', 'postgres', 'supabase_admin');
  END IF;

  -- 2. Aucun SET ROLE actif (`role = 'none'`) : exécution administrative directe
  --    (migrations Supabase CLI, SQL Editor, maintenance interne).
  --    Refuse `authenticator` ainsi que tout contexte portant une identité JWT cliente.
  IF session_user::text NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN false;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    RETURN false;
  END IF;

  IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 2. CORRECTION DE `public.guard_project_member_role()` (PASSAGE EN SECURITY INVOKER)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_project_member_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  -- Les requêtes clientes sur `project_members` ne peuvent jamais attribuer le rôle `owner`
  -- (la propriété du projet est portée par `projects.owner_id` ; les politiques RLS clientes
  -- limitent strictement `project_members.member_role` à `editor` et `viewer`).
  IF NEW.member_role = 'owner' THEN
    RAISE EXCEPTION 'Forbidden: cannot assign project owner role via client request on project_members.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW.project_id IS DISTINCT FROM OLD.project_id
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.invited_by IS DISTINCT FROM OLD.invited_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Forbidden: project_id, user_id, invited_by and created_at cannot be reassigned on project_members.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_member_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_project_member_role() TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. COMPATIBILITÉ `INSERT ... RETURNING` SUR `public.projects` (PostgREST `.insert().select()`)
--    Dans PostgreSQL, une fonction STABLE appelée dans une politique SELECT ne voit pas
--    la ligne en cours d'insertion durant `INSERT ... RETURNING`. L'évaluation directe
--    `owner_id = auth.uid()` préserve strictement la même règle métier tout en autorisant
--    `INSERT ... RETURNING` pour le propriétaire authentifié.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS projects_select_member_or_super_admin ON public.projects;
CREATE POLICY projects_select_member_or_super_admin
  ON public.projects FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_project_member(id)
    OR public.is_super_admin()
  );
