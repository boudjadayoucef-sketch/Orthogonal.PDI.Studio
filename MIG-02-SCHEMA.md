# MIG-02 — Architecture PostgreSQL Supabase, Migrations SQL & Sécurité RLS

**Projet :** Orthogonal PD&I Studio  
**Dépôt :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche :** `main`  
**Commit de référence :** `1d62c3715b2da12ee4fd58ae66bcc72412a96d79`  
**Périmètre :** Préparation de la base de données Supabase (schéma cible, migrations SQL versionnées, RLS Zero-Trust, tests PostgreSQL réels). Aucune migration de données de production ni modification de Firebase n'est exécutée dans cette étape.

---

## 1. Audit initial de l'existant (PostgreSQL Drizzle + Firestore)

### 1.1 Schéma PostgreSQL existant (`src/db/schema.ts`)

Le schéma Drizzle existant (conservé intact pour la compatibilité transitoire) comporte 3 tables :

| Table existante (`src/db/schema.ts`) | Clé primaire | Clés étrangères SQL physiques | RLS PostgreSQL | Couplage Firebase |
| :--- | :--- | :--- | :--- | :--- |
| `users` | `uid` (`text`) | Aucune | Non | `uid` = Firebase Auth UID |
| `projects` | `id` (`serial`) | Aucune (relations Drizzle virtuelles uniquement sur `uid`) | Non | `uid` = Firebase Auth UID |
| `drive_files` | `id` (`serial`) | Aucune (relations Drizzle virtuelles uniquement sur `uid`) | Non | `uid` = Firebase Auth UID |

Points d'audit relevés :
- **Absence d'intégrité référentielle SQL :** `projects.uid` et `drive_files.uid` ne possèdent pas de contrainte `FOREIGN KEY` physique vers `users.uid`.
- **Absence de Row Level Security :** `src/db/schema.ts` est destiné à un accès serveur direct (`src/db/index.ts`, protégé par `evaluateServerPostgresInitGate()`), sans séparation `anon` / `authenticated` / `service_role`.
- **Modèle incomplet par rapport aux besoins SaaS :** les champs profil métier, licences, paiements, journaux de connexion, télémétrie d'usage et retours utilisateurs résident aujourd'hui dans Firestore.

### 1.2 Collections Firestore auditées (`src/lib/firebase.ts`, `firestore.rules`, `src/security/webhooks/*`)

| Collection Firestore | Usage actuel dans le code | Traitement cible MIG-02 |
| :--- | :--- | :--- |
| `profiles/{uid}` | Profils SaaS (`PdiUserProfile`), rôles, plans, compteurs | Migré vers `public.profiles` (lié à `auth.users.id`) + `public.user_identity_mappings` |
| `projects/{id}` | Projets SaaS (`PdiSaasProject`, `ownerId`, `tenantId`, `code`) | Unifié avec PG `projects` dans `public.projects` + collaboration via `public.project_members` |
| `projects/{id}/isometrics/{isoId}` | Plans isométriques (`PdiSaasIsometric`) | Unifié avec PG `drive_files` dans `public.project_files` (`file_kind = 'isometric'` / `'drive_file'`) |
| `license_keys/{keyId}` | Clés de licence (`PdiLicenseKey`) | Migré vers `public.license_keys` (gestion serveur `service_role` uniquement) |
| `payment_transactions` (et legacy `pdi_payment_transactions`) | Commandes autoritatives & paiements (`AuthoritativePendingOrder`, `PdiPaymentTransaction`) | Migré vers `public.payments` + état d'abonnement normalisé dans `public.subscriptions` |
| `connection_logs` | Journaux d'authentification (`PdiConnectionLog`) | Migré vers `public.connection_logs` (immuable côté client, écriture serveur) |
| `subscriber_usage` | Télémétrie d'usage par module (`PdiSubscriberUsage`) | Migré vers `public.subscriber_usage` (append-only propre côté client) |
| `user_feedbacks` / `feedbacks` | Retours utilisateurs (`PdiUserFeedback`) | Unifié dans `public.feedback` |
| `auth_credentials` | Héritage d'identifiants obsolète (bloqué par `firestore.rules`) | **Exclu volontairement** — remplacé nativement par Supabase `auth.users` (zéro mot de passe dans `public.*`) |
| `password_requests` | Héritage obsolète (bloqué par `firestore.rules`) | **Exclu volontairement** — géré nativement par Supabase Auth |
| `payment_webhook_events` | Verrouillage/idempotence technique des webhooks serveur (`webhookIdempotencyRepository.ts`) | Reste côté serveur (non exposé au client) ; la traçabilité métier est assurée par `public.payments` (`last_event_id`, `(provider, provider_transaction_id)`) et `public.audit_logs` |

### 1.3 Divergences majeures identifiées & client Supabase existant

- **Divergence d'identifiants :** Firebase Auth utilise des chaînes (`uid: text`), tandis que Supabase Auth utilise des UUID (`auth.users.id: uuid`).
- **Divergence de structure projets :** PostgreSQL utilise un `serial id` + `drive_*` + `data jsonb`, alors que Firestore utilise un ID texte + `tenantId` + `code` + sous-collection `isometrics`.
- **Client navigateur `src/lib/supabase.ts` (issu de MIG-01-FIX-02) :** déjà prêt, fail-closed, exigeant une clé `sb_publishable_*`, rejetant `sb_secret_*` et les JWT hérités, et utilisant une clé de stockage isolée (`orthogonal.pdi.supabase.auth.dev.v1`).

---

## 2. Schéma cible Supabase (12 tables)

Les migrations SQL versionnées sont situées dans :
1. `supabase/migrations/20261123000100_mig02_supabase_core_schema.sql` — DDL non destructif, contraintes, index, triggers `updated_at`.
2. `supabase/migrations/20261123000200_mig02_supabase_rls_and_security.sql` — Fonctions `SECURITY DEFINER`, triggers anti-escalade, révocation de privilèges, `ENABLE` + `FORCE ROW LEVEL SECURITY` et politiques RLS.

Le miroir typé Drizzle ORM et les fonctions de mapping transitoire sont définis dans `src/db/supabaseSchema.ts` sans modifier `src/db/schema.ts`.

### 2.1 Inventaire des 12 tables et justifications métier

| # | Domaine | Table | Clé primaire | Relations principales (FK) | Justification code |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | Identité | `public.profiles` | `id uuid` | `id -> auth.users(id) ON DELETE CASCADE` | Remplace PG `users` + Firestore `profiles` (`PdiUserProfile`) sans mot de passe |
| 2 | Identité | `public.user_identity_mappings` | `id uuid` | `supabase_user_id -> auth.users(id) ON DELETE CASCADE` | Correspondance bijective traçable `firebase_uid <-> supabase_user_id` |
| 3 | Projets | `public.projects` | `id uuid` | `owner_id -> public.profiles(id) ON DELETE CASCADE` | Unifie PG `projects` et Firestore `projects` avec `legacy_pg_id`, `legacy_firestore_id`, `legacy_firebase_uid` |
| 4 | Projets | `public.project_members` | `id uuid` | `project_id -> public.projects(id) CASCADE`, `user_id -> public.profiles(id) CASCADE`, `invited_by -> public.profiles(id) SET NULL` | Contrôle d'accès collaboratif (`owner`, `editor`, `viewer`), contrainte unique `(project_id, user_id)` |
| 5 | Projets | `public.project_files` | `id uuid` | `project_id -> public.projects(id) CASCADE`, `owner_id -> public.profiles(id) CASCADE` | Unifie PG `drive_files` et Firestore `projects/{id}/isometrics` sans redondance |
| 6 | Licences & Facturation | `public.license_keys` | `id uuid` | `assigned_user_id -> public.profiles(id) SET NULL`, `activated_by_user_id -> public.profiles(id) SET NULL` | Remplace Firestore `license_keys` (`PdiLicenseKey`) |
| 7 | Licences & Facturation | `public.subscriptions` | `id uuid` | `user_id -> public.profiles(id) CASCADE`, `license_key_id -> public.license_keys(id) SET NULL` | Normalise l'état autoritatif d'abonnement (Paddle, SlickPay, clé de licence, admin) |
| 8 | Licences & Facturation | `public.payments` | `id uuid` | `user_id -> public.profiles(id) RESTRICT`, `subscription_id -> public.subscriptions(id) SET NULL` | Remplace `payment_transactions` (`AuthoritativePendingOrder`), unicité `order_id` et `(provider, provider_transaction_id)` |
| 9 | Sécurité & Traçabilité | `public.connection_logs` | `id uuid` | `user_id -> public.profiles(id) CASCADE` | Remplace Firestore `connection_logs` (`PdiConnectionLog`) |
| 10 | Sécurité & Traçabilité | `public.subscriber_usage` | `id uuid` | `user_id -> public.profiles(id) CASCADE` | Remplace Firestore `subscriber_usage` (`PdiSubscriberUsage`) |
| 11 | Sécurité & Traçabilité | `public.audit_logs` | `id uuid` | `actor_user_id -> public.profiles(id) SET NULL`, `target_user_id -> public.profiles(id) SET NULL` | Journal d'audit serveur autoritatif (rôles, paiements, webhooks, activations, actions admin) |
| 12 | Support | `public.feedback` | `id uuid` | `user_id -> public.profiles(id) CASCADE` | Unifie Firestore `user_feedbacks` et `feedbacks` (`PdiUserFeedback`) |

### 2.2 Diagramme relationnel synthétique

```text
auth.users (Supabase Auth)
 ├── (1:1) public.profiles
 │     ├── (1:N) public.projects
 │     │     ├── (1:N) public.project_members  <── (N:1) public.profiles (user_id, invited_by)
 │     │     └── (1:N) public.project_files    <── (N:1) public.profiles (owner_id)
 │     ├── (1:N) public.subscriptions          ──> (N:1) public.license_keys
 │     ├── (1:N) public.payments               ──> (N:1) public.subscriptions
 │     ├── (1:N) public.license_keys (assigned_user_id / activated_by_user_id)
 │     ├── (1:N) public.connection_logs
 │     ├── (1:N) public.subscriber_usage
 │     ├── (1:N) public.audit_logs (actor_user_id / target_user_id)
 │     └── (1:N) public.feedback
 └── (1:1) public.user_identity_mappings (supabase_user_id <-> firebase_uid)
```

### 2.3 Stratégie de correspondance Firebase UID ↔ Supabase UUID

1. **Aucune destruction des UID Firebase existants :** `public.user_identity_mappings` enregistre la paire unique `(supabase_user_id, firebase_uid)` avec `firebase_email`, `migration_status` (`pending`, `verified`, `migrated`, `revoked`) et `migrated_at`.
2. **Dénormalisation contrôlée sur `profiles` :** `public.profiles.firebase_uid` (colonne `UNIQUE`, écriture réservée à `service_role`) permet la résolution rapide pendant la période de coexistence.
3. **Traçabilité des enregistrements hérités :** `public.projects` conserve `legacy_pg_id` (unique), `legacy_firestore_id` (unique) et `legacy_firebase_uid` ; `public.project_files` conserve `legacy_drive_record_id` (unique) et `(project_id, legacy_isometric_id)` (index unique partiel) ; `public.payments` conserve `legacy_firebase_uid` et le format d'ID commande `^ORD_(PADDLE|SLICKPAY)_[A-Za-z0-9_-]{1,110}$`.
4. **Règle d'isolation :** aucune requête cliente (`authenticated` ou `anon`) ne peut créer ou modifier les colonnes `legacy_*` ni la table `user_identity_mappings`.

---

## 3. Rapport de sécurité Row Level Security (RLS)

### 3.1 Principes Zero-Trust appliqués

1. **Deny-by-default :** `REVOKE ALL` sur les 12 tables pour `PUBLIC`, `anon` et `authenticated`, puis octroi minimal explicite à `authenticated` (aucun privilège accordé à `anon`).
2. **RLS activé et forcé :** `ENABLE ROW LEVEL SECURITY` et `FORCE ROW LEVEL SECURITY` sur 100 % des 12 tables.
3. **Aucune confiance dans les métadonnées JWT modifiables côté navigateur :** `public.is_super_admin()` est `SECURITY DEFINER` (avec `SET search_path = pg_catalog, public, auth`) et vérifie conjointement `public.profiles.role = 'super_admin'`, `public.profiles.status = 'active'` et `auth.users.email_confirmed_at IS NOT NULL`.
4. **Autorité serveur stricte :** `public.is_service_role()` repose exclusivement sur le rôle PostgreSQL réel (`current_user IN ('service_role', 'postgres', 'supabase_admin')`) et ignore toute revendication falsifiée dans `request.jwt.claims`.
5. **Défense en profondeur par triggers `BEFORE INSERT/UPDATE` :**
   - `trg_profiles_guard_privileged_fields` : impose `email = auth.users.email`, `role = 'client'`, `status = 'pending_activation'`, `account_type = 'basic'`, `subscription_plan = 'monthly'`, `firebase_uid IS NULL`, `payment_gateway IS NULL` et compteurs à 0 à la création ; verrouille toutes les colonnes privilégiées et compteurs serveur en mise à jour.
   - `trg_projects_guard_immutability` : interdit aux clients d'injecter ou de modifier `owner_id`, `tenant_id`, `legacy_pg_id`, `legacy_firestore_id`, `legacy_firebase_uid` et `created_at`.
   - `trg_project_members_guard_role` : empêche l'attribution du rôle `owner` à un tiers et verrouille `(project_id, user_id)` en mise à jour.
   - `trg_project_files_guard_immutability` : verrouille `project_id`, `owner_id`, `legacy_drive_record_id`, `legacy_isometric_id` et `created_at`.
   - `trg_feedback_guard_fields` : force `status = 'new'` et `admin_notes IS NULL` à la soumission client ; restreint les mises à jour `super_admin` aux seuls champs `status` et `admin_notes` (le contenu soumis par l'utilisateur est immuable).

### 3.2 Matrice des politiques RLS par table

| Table | `anon` | `authenticated` (Client standard) | `authenticated` (`super_admin` vérifié) | `service_role` |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | Refus total | `SELECT` propre ; `INSERT` propre (client `pending_activation`, email = `auth.users`) ; `UPDATE` propre (champs présentation uniquement) ; `DELETE` interdit | `SELECT` tous les profils ; pas d'escalade directe de rôle via le navigateur | Accès complet |
| `user_identity_mappings` | Refus total | `SELECT` propre uniquement ; écritures interdites | `SELECT` tous ; écritures serveur uniquement | Accès complet |
| `projects` | Refus total | `SELECT` si owner/membre ; `INSERT` avec `owner_id = auth.uid()` ; `UPDATE` si owner/editor (colonnes immuables protégées) ; `DELETE` si owner | `SELECT` et `DELETE` autorisés | Accès complet |
| `project_members` | Refus total | `SELECT` si soi-même ou owner du projet ; `INSERT`/`UPDATE` owner du projet uniquement (`editor`/`viewer`, `invited_by = auth.uid()`) ; `DELETE` owner ou départ volontaire | `SELECT` tous | Accès complet |
| `project_files` | Refus total | `SELECT` si membre du projet ; `INSERT` si owner/editor (`owner_id = auth.uid()`) ; `UPDATE`/`DELETE` si owner/editor | `SELECT` et `DELETE` autorisés | Accès complet |
| `license_keys` | Refus total | `SELECT` si assignée ou activée par `auth.uid()` ; écritures interdites | `SELECT` toutes ; écritures serveur uniquement | Accès complet |
| `subscriptions` | Refus total | `SELECT` propre uniquement ; écritures interdites | `SELECT` tous ; écritures serveur uniquement | Accès complet |
| `payments` | Refus total | `SELECT` propre uniquement ; écritures interdites | `SELECT` tous ; écritures serveur uniquement | Accès complet |
| `connection_logs` | Refus total | `SELECT` propre uniquement ; écritures/modifications/suppressions interdites | `SELECT` tous ; écritures serveur uniquement | Accès complet |
| `subscriber_usage` | Refus total | `SELECT` propre ; `INSERT` propre (`user_email` cohérent avec `profiles`) ; `UPDATE`/`DELETE` interdits | `SELECT` tous | Accès complet |
| `audit_logs` | Refus total | **Refus total** (aucune lecture ni écriture) | `SELECT` uniquement (email vérifié obligatoire) ; écritures serveur uniquement | Accès complet |
| `feedback` | Refus total | `SELECT` propre ; `INSERT` propre (`status='new'`, `admin_notes IS NULL`) ; `UPDATE`/`DELETE` interdits | `SELECT` tous ; `UPDATE` limité à `status` et `admin_notes` ; `DELETE` interdit | Accès complet |

---

## 4. Procédure d'application des migrations sur un projet Supabase de test

> **Avertissement obligatoire :** Ne jamais appliquer ces migrations sur un environnement de production ni modifier Firebase dans le cadre de MIG-02. Utiliser exclusivement un **projet Supabase de test/staging dédié et vierge**.

### Option A — Via Supabase CLI (recommandée)

1. Installer et authentifier la CLI Supabase sur un poste de développement disposant d'un accès au projet Supabase de **test** :
   ```bash
   npx supabase login
   npx supabase link --project-ref <SUPABASE_TEST_PROJECT_REF>
   ```
2. Vérifier le plan de migration sans exécution (`--dry-run`) :
   ```bash
   npx supabase db push --dry-run
   ```
3. Appliquer les deux migrations versionnées de `supabase/migrations/` sur le projet Supabase de **test** :
   ```bash
   npx supabase db push
   ```
4. Contrôler l'historique des migrations enregistrées :
   ```bash
   npx supabase migration list
   ```

### Option B — Via l'éditeur SQL du tableau de bord Supabase (projet de test uniquement)

1. Ouvrir **SQL Editor** sur le projet Supabase de test.
2. Exécuter intégralement `supabase/migrations/20261123000100_mig02_supabase_core_schema.sql`.
3. Exécuter intégralement `supabase/migrations/20261123000200_mig02_supabase_rls_and_security.sql`.

### Vérifications SQL post-migration sur le projet Supabase de test

Exécuter les requêtes de contrôle suivantes pour confirmer la conformité :

```sql
-- 1. Vérifier que les 12 tables existent avec RLS activé et forcé
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2. Vérifier la couverture des politiques RLS
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- 3. Vérifier l'absence totale de privilèges pour le rôle anon
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public';
-- Résultat attendu : 0 ligne.

-- 4. Vérifier l'absence totale de colonnes mot de passe / secret dans public.*
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name ~* '(password|secret|private_key|service_role)';
-- Résultat attendu : 0 ligne.
```

---

## 5. Validation locale automatisée (PostgreSQL réel via PGlite)

Les deux fichiers SQL de `supabase/migrations/` sont exécutés tels quels sur une instance PostgreSQL réelle en mémoire (`@electric-sql/pglite`, zéro réseau, zéro base distante) par la suite dédiée :

```bash
./node_modules/.bin/vitest run src/security/tests/mig02SupabaseSchemaRls.spec.ts
```

Cette suite vérifie de bout en bout :
1. Exécution des migrations sur une base vierge, création des 12 tables, `ENABLE` + `FORCE ROW LEVEL SECURITY` et absence de colonnes sensibles.
2. Intégrité référentielle des clés étrangères.
3. Unicité des identifiants (`email` insensible à la casse, `firebase_uid`, `code`, `order_id`, `(provider, provider_transaction_id)`).
4. Isolation complète entre deux utilisateurs authentifiés distincts (`User A` vs `User B`).
5. Protection anti-escalade de rôles (`super_admin` / `admin`), rejet de la falsification JWT (`user_metadata`, `app_metadata`, `role: "service_role"`), rejet d'un `super_admin` non vérifié (`email_confirmed_at IS NULL`) et verrouillage de l'email à la création.
6. Verrouillage en écriture client de `payments`, `subscriptions`, `license_keys` et `user_identity_mappings`.
7. Refus total pour le rôle `anon` sur les 12 tables.
8. Protection des membres de projet (`viewer` / `editor`, refus d'auto-adhésion), immuabilité des journaux (`connection_logs`, `audit_logs`, `subscriber_usage` append-only) et règles de triage `feedback`.
9. Compatibilité complète avec les enregistrements hérités PostgreSQL (Drizzle) et Firestore via `src/db/supabaseSchema.ts`.
