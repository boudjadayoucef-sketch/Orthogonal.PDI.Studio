# MIG-03-BOOTSTRAP-01 — Création sécurisée du premier super administrateur Supabase

## 1. Synthèse de l'audit préalable du dépôt

Avant l'implémentation, l'inspection de `src/lib/supabase.ts`, `src/lib/firebase.ts`, `src/middleware/auth.ts`, `server.ts`, `package.json` et des 3 migrations `supabase/migrations/20261123000100..300` a établi les faits suivants :

1. **Création des utilisateurs Supabase** : aucun code serveur n'appelait encore l'API Supabase Admin (`auth.admin.*`). `src/lib/supabase.ts` est exclusivement navigateur et n'accepte que `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_*`). Le paquet `@supabase/supabase-js` (`^2.119.0`) est déjà présent dans `package.json`.
2. **Lien entre `auth.users` et `public.profiles`** :
   - `public.profiles.id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - Index unique insensible à la casse : `idx_profiles_email_lower_unique ON public.profiles (lower(email))`
   - Colonnes de contrôle : `role` (`'super_admin' | 'admin' | 'client' | 'guest' | 'demo'`), `status` (`'active' | 'suspended' | 'pending_activation' | 'revoked' | 'disabled'`).
3. **Vérification des privilèges par `public.is_super_admin()`** :
   - Fonction `SECURITY DEFINER` (`SET search_path = pg_catalog, public, auth`).
   - Exige **simultanément** :
     - `auth.uid() IS NOT NULL`
     - `public.profiles.id = auth.uid()`
     - `public.profiles.role = 'super_admin'`
     - `public.profiles.status = 'active'`
     - `auth.users.email_confirmed_at IS NOT NULL`
   - Ne lit **jamais** `user_metadata` ni `app_metadata`.
4. **Création automatique de `public.profiles`** : **aucun trigger** n'existe sur `auth.users` dans MIG-02 pour créer automatiquement un profil. Le bootstrap serveur doit donc créer et vérifier `public.profiles` explicitement avec `service_role` / `sb_secret_`, et appliquer un rollback compensatoire en cas d'erreur.
5. **Accès sécurisé à l'API Admin Supabase sans fuite de secret navigateur** :
   - Séparation physique dans `src/server/supabaseAdmin.ts` et `src/server/supabaseSuperAdminBootstrap.ts` + CLI `scripts/bootstrapSupabaseSuperAdmin.ts`.
   - Aucun import de ces modules dans le code client (`src/App.tsx`, `src/main.tsx`, `src/lib/*`, `src/components/*`, `src/pdi/*`).
   - Garde navigateur à l'exécution (`window` / `document`), rejet des variables `VITE_*` secrètes, masquage systématique des clés (`sb_secret_*`, `sbp_*`, JWT) dans les erreurs et journaux.

---

## 2. Architecture Zero-Trust en deux phases

Compte unique autorisé (codé en dur côté serveur) : **`orthognaleng@gmail.com`**.

| Phase | Précondition dans `auth.users` | Action serveur (`service_role` / `sb_secret_`) | État `public.profiles` | `public.is_super_admin()` | Journal `public.audit_logs` |
|---|---|---|---|---|---|
| **Dry-run** (défaut) | Quelle qu'elle soit | Lecture seule + contrôles de sécurité | Inchangé | Inchangé | Aucun |
| **Phase 1 — Invitation** | Utilisateur inexistant ou `email_confirmed_at IS NULL` | `auth.admin.inviteUserByEmail("orthognaleng@gmail.com", { data: {} })` (jamais `email_confirm: true`) | `role = 'client'`, `status = 'pending_activation'` (aucun privilège) | **`false`** | `supabase.super_admin.bootstrap.invited` |
| **Confirmation email** | Action humaine sur Gmail | L'opérateur ouvre le lien reçu sur `orthognaleng@gmail.com` et définit son mot de passe | Inchangé (`client` / `pending_activation`) | **`false`** | — |
| **Phase 2 — Activation** | `email_confirmed_at IS NOT NULL` | Promotion contrôlée de `role` et `status` uniquement (préserve `name`, `company`, `firebase_uid`, etc.) + relecture de contrôle | `role = 'super_admin'`, `status = 'active'` | **`true`** | `supabase.super_admin.bootstrap.activated` (`critical`) |
| **Réexécution** | Déjà confirmé et actif | Aucune modification, aucun doublon, aucune rétrogradation | Préservé à l'identique | **`true`** | `supabase.super_admin.bootstrap.verified_idempotent` |

### Garanties de sécurité intégrées

- **Aucune route HTTP publique** : le bootstrap n'est pas exposé dans `server.ts` ; il s'exécute uniquement via le script CLI serveur `scripts/bootstrapSupabaseSuperAdmin.ts`.
- **Kill-switch fail-closed** : bloqué par défaut tant que `SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED` ne vaut pas exactement `"true"`.
- **Rejet Sandbox** : bloqué si `PDI_ENV=sandbox`.
- **Unicité `super_admin`** : bloqué (`MULTIPLE_SUPER_ADMINS_FORBIDDEN`) si un autre email possède déjà `role = 'super_admin'` dans `public.profiles`.
- **Protection des statuts négatifs** : bloqué (`NEGATIVE_PROFILE_STATUS_BLOCKED`) si le profil existant est `suspended`, `revoked` ou `disabled`.
- **Rollback compensatoire** :
  - Si `public.profiles` ou `public.audit_logs` échoue en Phase 1 après l'invitation, le profil et l'utilisateur `auth.users` nouvellement créés sont supprimés.
  - Si la vérification post-écriture ou `public.audit_logs` échoue en Phase 2 après promotion, le profil est immédiatement restauré à son état antérieur (`role` et `status` d'origine) ou supprimé s'il venait d'être créé. Aucun profil partiellement privilégié ne subsiste.
- **Compatibilité Firebase préservée** : aucune modification de `src/lib/firebase.ts`, `src/middleware/auth.ts`, `firestore.rules` ou du flux de connexion Firebase existant.

---

## 3. Variables d'environnement serveur (Vercel / environnement serveur sécurisé)

**Ne jamais préfixer une clé secrète par `VITE_`. Ne jamais commiter de valeur réelle.**

| Variable | Portée | Obligatoire | Valeur attendue | Usage |
|---|---|---|---|---|
| `SUPABASE_URL` | **Serveur uniquement** | Oui | `https://<project-ref>.supabase.co` | Origine HTTPS du projet Supabase (sans chemin ni credentials). |
| `SUPABASE_SECRET_KEY` | **Serveur uniquement (Secret)** | Oui | Clé secrète `sb_secret_...` (ou JWT `service_role`) | Authentification Supabase Admin API (`auth.admin.*`, bypass RLS serveur). |
| `SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED` | **Serveur uniquement** | Oui (temporaire) | `true` uniquement pendant l'opération, **`false` le reste du temps** | Kill-switch explicite activant/désactivant le bootstrap. |
| `SUPABASE_SUPER_ADMIN_REDIRECT_URL` | **Serveur uniquement** | Optionnel | `https://<votre-domaine-vercel>/` | URL HTTPS de redirection incluse dans le lien d'invitation email Supabase. |

> Sur **Vercel** (Project Settings → Environment Variables) : si vous stockez `SUPABASE_URL` et `SUPABASE_SECRET_KEY` dans l'environnement serveur Vercel, veillez à les marquer comme sensibles, sans préfixe `VITE_`, et laissez **`SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`** en permanence (ne la passez à `true` que le temps exact du bootstrap, puis supprimez-la ou repassez-la à `false`).

---

## 4. Procédure opérationnelle pas à pas (création réelle du compte)

> **État actuel** : ce dépôt prépare le mécanisme serveur et ses tests automatisés. **Le compte réel `orthognaleng@gmail.com` n'a PAS encore été créé sur votre projet Supabase distant.**

### Étape 0 — Prérequis obligatoires dans Supabase

1. Vérifier que les **3 migrations MIG-02** sont appliquées dans l'ordre exact sur votre projet Supabase (`orthogonal-pdi-dev`) :
   1. `supabase/migrations/20261123000100_mig02_supabase_core_schema.sql`
   2. `supabase/migrations/20261123000200_mig02_supabase_rls_and_security.sql`
   3. `supabase/migrations/20261123000300_mig02_fix01_security_definer_service_role_guard.sql`
2. Dans **Supabase Dashboard → Authentication → URL Configuration**, vérifier que votre URL de redirection HTTPS autorisée (ex. votre domaine Vercel) est bien déclarée dans *Redirect URLs*.
3. Vérifier dans **Authentication → Providers → Email** que la confirmation d'email (*Confirm email*) est activée.

### Étape 1 — Contrôle en lecture seule (`--dry-run`)

Depuis un poste/serveur sécurisé (jamais dans le navigateur), exporter temporairement les variables d'environnement de session :

```bash
export SUPABASE_URL="https://<votre-project-ref>.supabase.co"
export SUPABASE_SECRET_KEY="<votre-cle-sb_secret>"
export SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED="true"
export SUPABASE_SUPER_ADMIN_REDIRECT_URL="https://<votre-domaine-vercel>/"

npx tsx scripts/bootstrapSupabaseSuperAdmin.ts --dry-run
```

Résultat attendu : `"phase": "dry_run_would_invite_and_provision_pending"` et `"privilegesEffective": false`.

### Étape 2 — Phase 1 : Envoi de l'invitation à `orthognaleng@gmail.com`

```bash
npx tsx scripts/bootstrapSupabaseSuperAdmin.ts --execute
```

Résultat attendu :
- `"phase": "awaiting_email_confirmation"`
- `"emailConfirmed": false`
- `"profileRole": "client"`
- `"profileStatus": "pending_activation"`
- `"privilegesEffective": false`
- Un identifiant `auditLogId` créé dans `public.audit_logs` (`supabase.super_admin.bootstrap.invited`).

### Étape 3 — Confirmation réelle de l'email (`orthognaleng@gmail.com`)

1. Ouvrir la boîte Gmail **`orthognaleng@gmail.com`**.
2. Ouvrir l'email d'invitation envoyé par Supabase Auth.
3. Cliquer sur le lien de confirmation et définir le mot de passe du compte super administrateur (mot de passe fort unique, stocké dans un gestionnaire de mots de passe).
4. Vérifier dans **Supabase Dashboard → Authentication → Users** que `orthognaleng@gmail.com` affiche bien une date de confirmation (**Email Confirmed** / `email_confirmed_at IS NOT NULL`).

### Étape 4 — Phase 2 : Activation effective du rôle `super_admin`

Relancer la même commande serveur :

```bash
npx tsx scripts/bootstrapSupabaseSuperAdmin.ts --execute
```

Résultat attendu :
- `"phase": "activated"`
- `"emailConfirmed": true`
- `"profileRole": "super_admin"`
- `"profileStatus": "active"`
- `"privilegesEffective": true`
- Une entrée `critical` `supabase.super_admin.bootstrap.activated` enregistrée dans `public.audit_logs`.

### Étape 5 — Vérification dans Supabase SQL Editor

Exécuter cette requête en lecture seule dans **Supabase Dashboard → SQL Editor** :

```sql
SELECT
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.status,
  (u.email_confirmed_at IS NOT NULL AND p.role = 'super_admin' AND p.status = 'active') AS eligible_super_admin
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE lower(u.email) = 'orthognaleng@gmail.com';

SELECT id, event_type, severity, metadata, created_at
FROM public.audit_logs
WHERE event_type LIKE 'supabase.super_admin.bootstrap.%'
ORDER BY created_at DESC
LIMIT 5;
```

### Étape 6 — Désactivation immédiate du mécanisme de bootstrap

**Obligatoire dès que l'étape 5 est validée :**

```bash
unset SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED
unset SUPABASE_SECRET_KEY
```

Et dans Vercel (si la variable a été saisie) :
- Passer **`SUPABASE_SUPER_ADMIN_BOOTSTRAP_ENABLED=false`** (ou supprimer la variable).
- Vérifier qu'une tentative de relance échoue immédiatement avec `"code": "BOOTSTRAP_DISABLED"`.

---

## 5. Limites connues et périmètre volontairement exclu

1. **Aucune migration de l'authentification applicative** : l'interface de connexion et les endpoints existants continuent d'utiliser Firebase Auth et Firestore jusqu'à **MIG-04**. Le compte Supabase `orthognaleng@gmail.com` préparé ici servira de fondation pour le basculement contrôlé de MIG-04.
2. **Exécution manuelle requise par l'opérateur** : aucun compte n'est créé automatiquement pendant le build ou les tests. Le bootstrap nécessite vos vraies variables serveur Supabase et votre confirmation manuelle dans la boîte `orthognaleng@gmail.com`.
3. **Pagination `listUsers`** : la recherche d'utilisateur dans `auth.admin.listUsers` parcourt jusqu'à 50 pages de 200 utilisateurs (10 000 utilisateurs), largement suffisant pour le bootstrap initial ; au-delà, un lookup par table `public.profiles` ou requête Admin dédiée sera utilisé dans MIG-04.
4. **MFA / TOTP** : il est recommandé d'activer l'authentification multifacteur (MFA) sur `orthognaleng@gmail.com` dans Supabase Auth dès l'ouverture de la console d'administration en MIG-04.
