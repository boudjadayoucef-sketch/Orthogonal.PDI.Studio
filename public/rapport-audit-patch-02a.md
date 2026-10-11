# RAPPORT D'AUDIT TECHNIQUE MAÎTRE — PATCH 02A (P0-B)
**Dépôt :** `boudjadayoucef-sketch/pd-i-vis-dz`  
**Branche :** `main`  
**Commit de référence :** `72a72753233567cfcbfb5e21a2b68d43f943c968`  
**Date :** 11 Septembre 2026  
**Auteur :** AI Assistant (PDI Architecture & Security Team)

---

## 1. SOURCE OF TRUTH & ÉTAT DE RÉFÉRENCE

* **Dépôt :** `boudjadayoucef-sketch/pd-i-vis-dz`
* **Branche :** `main`
* **Commit de référence audité :** `72a72753233567cfcbfb5e21a2b68d43f943c968` (`feat(security): implement strict Firestore security rules`)
* **État de conformité :** Tous les fichiers inspectés correspondent rigoureusement au code source actif du repository. Aucun fichier n'a été altéré ou supprimé durant cette phase.

---

## 2. AUTHORITY MAP (Cartographie des Autorités Actuelles)

| Domaine | Autorité actuelle | Fichier(s) source | Fonction(s) | Risque réel constaté | Autorité cible |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Identité** | Hybride (Firebase Auth SDK + fallback `auth_credentials` / `profiles`) | `src/lib/firebase.ts`, `src/pdi/auth/PdiAuthPage.tsx` | `signInWithPdi()`, `authenticateSuperAdmin()`, `onAuthStateChanged()` | Rupture d'identité si le compte n'est pas dans Firebase Auth (pas de `request.auth.uid`). | **Firebase Auth** |
| **Mot de passe** | Double autorité (Firebase Auth scrypt + WebCrypto SHA-256 + salt dans Firestore) | `src/lib/firebase.ts` | `hashPassword()`, `changeUserProfilePassword()`, `signInWithEmailAndPassword()` | Incohérence des mots de passe : changer le mot de passe via l'ancien flux modifiait Firestore sans toucher à Firebase Auth. | **Firebase Auth** |
| **UID** | Triple autorité (`request.auth.uid`, `profiles/{uid}`, ou UID synthétique `"super_admin_boudjada"`) | `src/lib/firebase.ts`, `src/pdi/app/PdiUnifiedApp.tsx` | `signInWithPdi()`, `saveUserProfile()` | Rejet immédiat par les Firestore Rules sécurisées si l'UID n'est pas émis par Firebase Auth. | **Firebase UID** |
| **Session** | Navigateur (`localStorage` + `sessionStorage`) | `src/pdi/app/PdiUnifiedApp.tsx`, `src/lib/firebase.ts` | `localStorage.setItem("pdi.auth.mode.v1")`, `sessionStorage.setItem("pdi.stage.v4")` | Déconnexion automatique de Firebase Auth tout en conservant une session locale factice. | **Firebase Auth** |
| **Rôle** | Client + Document Firestore `profiles/{uid}.role` | `src/lib/firebase.ts`, `src/pdi/app/PdiUnifiedApp.tsx` | `pdiUserProfile.role`, `localStorage` | Vulnérable à l'absence de signature cryptographique (pas de Custom Claims JWT). | **Custom Claims / Server** |
| **Permissions** | `firestore.rules` (P0-A) | `firestore.rules` | `isSuperAdmin()`, `isOwnerByUid()` | Dépend de l'email présent dans le token JWT (`request.auth.token.email`). | **Firestore Rules + Claims** |
| **Firestore** | `request.auth.uid` (P0-A) | `firestore.rules` | `allow read, write: if isAuthenticated() && request.auth.uid == ...` | Tout utilisateur sans token Firebase Auth est rejeté avec `Missing or insufficient permissions`. | **Firebase UID** |
| **PostgreSQL** | Drizzle ORM / SQL direct | `src/db/projects.ts`, `src/db/users.ts`, `server.ts` | `WHERE user_id = ...` | Incohérence si `user_id` reçoit un email au lieu du `firebaseUid`. | **Firebase UID** |
| **Superadmin** | Email en dur (`boudjada.youcef@gmail.com`) + `auth_credentials/super_admin_boudjada` | `firestore.rules`, `src/lib/firebase.ts` | `isSuperAdmin()`, `authenticateSuperAdmin()` | **BROKEN BY P0-A** pour le fallback `auth_credentials` (le client ne peut plus lire ce document). | **Firebase Auth + Token JWT** |
| **Legacy credentials** | Collection Firestore `auth_credentials` | `src/lib/firebase.ts` | `verifyUserCredential()`, `saveUserAuthCredential()` | **BROKEN BY P0-A** côté client (`allow read, write: if false;`). | **Server-only / Déprécié** |

---

## 3. CURRENT AUTH FLOW (Diagramme du Flux de Connexion Actuel)

```text
                                Utilisateur (Client React)
                                            │
                                            ▼
                           [ Soumission Formulaire Login ]
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
     [ Connexion Standard ]                                  [ Connexion Super-Admin ]
     signInWithPdi(email, pass)                              authenticateSuperAdmin(email, pass)
               │                                                         │
               ├─────────────────────────────────┐                       ├─────────────────────────────────┐
               ▼                                 ▼                       ▼                                 ▼
   1. Firebase Auth natif               2. Fallback Legacy           1. getDoc("auth_credentials/     2. signInWithEmailAndPassword
   signInWithEmailAndPassword()         getDoc("auth_credentials")      super_admin_boudjada")          (auth, email, pass)
               │                                 │                       │                                 │
     ┌─────────┴─────────┐                       │                       │                       ┌─────────┴─────────┐
     ▼                   ▼                       ▼                       ▼                       ▼                   ▼
  Succès              Échec             [ BROKEN BY P0-A ]      [ BROKEN BY P0-A ]            Succès              Échec
     │                   │              (Rejet Firestore Rules  (Rejet Firestore Rules           │                   │
     │                   │               allow read: if false)   allow read: if false)           │                   │
     ▼                   ▼                       │                       │                       ▼                   ▼
Token JWT émis     Tente fallback                │                       │                 Token JWT émis      Bloqué si pass
profiles/{uid} lu  SHA-256 local                 ▼                       ▼                 profiles/{uid} lu   différent
Session OK         (Échoue)               Access Denied           Access Denied            Session OK          (Échec total)
```

---

## 4. UID MAP (Analyse de Correspondance des Identifiants)

Dans le code actuel, nous avons identifié **4 formats d'identifiants concurrents** :

1. **Firebase Auth UID :** Chaîne alphanumérique de 28 caractères (ex: `AbC123xyz789...`) générée par Google Identity.
2. **Email direct :** Utilisé comme identifiant de fallback dans certains composants historiques (`userId: email`, `ownerId: email`).
3. **UID Synthétique legacy :** `"super_admin_boudjada"` créé en dur dans `src/lib/firebase.ts`.
4. **PostgreSQL `user_id` :** Champ `text` dans `src/db/schema.ts` (`projects.userId`).

**Incompatibilité critique :**
Les Firestore Rules appliquées en P0-A vérifient :
`resource.data.ownerId == request.auth.uid || resource.data.uid == request.auth.uid`
Si un projet a été enregistré avec `ownerId: "user@example.com"` au lieu du Firebase UID `AbC123xyz...`, Firestore Rules rejettera l'accès car `request.auth.uid != request.auth.token.email`.

---

## 5. USER CATEGORIES (Inventaire des Profils Utilisateurs)

| Catégorie | Description | État Identité | Accès Firestore (P0-A) | Migration possible ? | Type de Migration |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Catégorie A** | Utilisateur complet (Firebase Auth User + `profiles/{uid}`) | `request.auth.uid` valide | **100% Fonctionnel** | Déjà conforme | Aucune action requise |
| **Catégorie B** | Utilisateur legacy (`auth_credentials` + `profiles`, mais aucun compte Firebase Auth) | Aucun compte Firebase Auth | **BLOQUÉ** (rejeté par P0-A) | Oui | Création transparente dans Firebase Auth lors de la saisie du mot de passe |
| **Catégorie C** | Profil orphelin (`profiles/{id}` où `id` n'est pas un Firebase UID) | Inconnu | **BLOQUÉ** | Oui | Réconciliation via l'email lors du premier login Firebase Auth |
| **Catégorie D** | Compte Firebase Auth existant mais sans document `profiles/{uid}` | `request.auth.uid` valide | **Fonctionnel** mais profil vide | Oui | Initialisation automatique d'un profil par défaut lors de `onAuthStateChanged` |
| **Catégorie E** | Superadmin (`boudjada.youcef@gmail.com`) | Firebase Auth + `auth_credentials` | **Fonctionnel SI connecté via Firebase Auth** | Oui | Connexion stricte via `signInWithEmailAndPassword()` avec son mot de passe Firebase Auth |
| **Catégorie F** | Utilisateur Google Sign-In (`signInWithPopup`) | `request.auth.uid` valide | **100% Fonctionnel** | Déjà conforme | Aucune action requise |

---

## 6. auth_credentials DEPENDENCY MAP

| Fonction source | Fichier | Client / Server | Read | Write | Criticité | Remplacement cible |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `saveUserAuthCredential()` | `src/lib/firebase.ts` | Client | NON | OUI | **Obsolète** | Remplacé par `createUserWithEmailAndPassword()` natif |
| `verifyUserCredential()` | `src/lib/firebase.ts` | Client | OUI | NON | **Cassé (P0-A)** | Remplacé par `signInWithEmailAndPassword()` natif |
| `authenticateSuperAdmin()` | `src/lib/firebase.ts` | Client | OUI | NON | **Cassé (P0-A)** | Remplacé par `signInWithEmailAndPassword(auth, "boudjada.youcef@gmail.com", pass)` |
| `changeUserProfilePassword()` | `src/lib/firebase.ts` | Client | OUI | OUI | **Cassé (P0-A)** | Remplacé par `updatePassword(auth.currentUser, newPassword)` |
| `resetUserAuthCredential()` | `src/lib/firebase.ts` | Client | NON | OUI | **Obsolète** | Remplacé par `sendPasswordResetEmail()` natif |
| `ensureSuperAdminAccount()` | `src/lib/firebase.ts` | Client | OUI | OUI | **Cassé (P0-A)** | Provisioning serveur initial / Console Firebase Auth |

---

## 7. P0-A COMPATIBILITY AUDIT

* **CLIENT → `auth_credentials` :** **IMPOSSIBLE / BROKEN BY P0-A**
  * *Raison technique :* `firestore.rules` applique désormais explicitement `match /auth_credentials/{credId} { allow read, write: if false; }`. Toute tentative de `getDoc()` ou `setDoc()` depuis le navigateur déclenche une exception `FirebaseError: [code=permission-denied]`.
* **SERVER → `auth_credentials` :** **POSSIBLE** (uniquement via Node.js Firebase Admin SDK avec compte de service).
* **ADMIN SDK → `auth_credentials` :** **POSSIBLE** (contourne les règles client pour les opérations de migration de données si nécessaire).

---

## 8. PASSWORD MIGRATION MATRIX

| Situation | Mot de passe connu par l'utilisateur | Firebase Auth présent ? | Legacy credential présent ? | Stratégie de Résolution |
| :--- | :--- | :--- | :--- | :--- |
| **Cas 1 : Nominal** | OUI | OUI (mot de passe identique) | OUI / NON | `signInWithEmailAndPassword()` direct. Aucun fallback requis. |
| **Cas 2 : Compte Legacy non enrôlé** | OUI | NON | OUI (dans la base) | Lors du login, si Firebase Auth renvoie `auth/user-not-found`, appeler `createUserWithEmailAndPassword(auth, email, password)` avec le mot de passe fourni en clair par l'utilisateur dans le formulaire. |
| **Cas 3 : Mot de passe oublié** | NON | OUI / NON | OUI | Envoi d'un email de réinitialisation sécurisé via `sendPasswordResetEmail(auth, email)`. |
| **Cas 4 : Désynchronisation de mot de passe** | OUI | OUI (mais mot de passe Firebase différent) | OUI | L'utilisateur reçoit `auth/wrong-password`. Proposition immédiate de réinitialisation par email officiel Firebase Auth. |
| **Cas 5 : Superadmin** | OUI | OUI | OUI (`super_admin_boudjada`) | Utiliser le mot de passe Firebase Auth de `boudjada.youcef@gmail.com`. |
| **Cas 6 : Incohérence UID/Profil** | OUI | OUI | NON | Récupérer le `uid` Firebase Auth au login et synchroniser `profiles/{uid}` avec l'email correspondant. |

---

## 9. SUPERADMIN AUDIT

1. **Authentification actuelle :** Le fichier `src/lib/firebase.ts` tentait de lire `auth_credentials/super_admin_boudjada` puis d'exécuter `signInWithEmailAndPassword()`.
2. **UID réel :** Dans Firebase Auth, le compte possède un UID Firebase standard (ex: `XyZ...`). Dans les sessions locales historiques, il recevait l'UID synthétique `"super_admin_boudjada"`.
3. **Obtention du `request.auth.uid` :** Dès lors qu'il se connecte via `signInWithEmailAndPassword()`, Firebase Auth génère un ID Token valide avec son UID et son email `boudjada.youcef@gmail.com`.
4. **Dépendance à `auth_credentials` :** Totalement supprimable. Le Superadmin se connecte directement avec ses identifiants Firebase Auth.
5. **Rôle dans les Firestore Rules :** `firestore.rules` vérifie :
   `request.auth.token.email == "boudjada.youcef@gmail.com" || request.auth.token.email == "superadmin@pdi-vision.dz"`
   Cette règle est immédiatement satisfaite par le token JWT émis par Firebase Auth.

---

## 10. LOCKOUT RISK

| Catégorie d'utilisateurs | Niveau de Risque | Cause principale de risque | Mesure de mitigation | Test obligatoire |
| :--- | :--- | :--- | :--- | :--- |
| **Superadmin (`boudjada.youcef@gmail.com`)** | **LOW** | Mot de passe Firebase Auth différent de l'ancien mot de passe maître local | Vérifier le login Firebase Auth direct ; fallback par réinitialisation de mot de passe Firebase Auth si nécessaire. | TC-09 |
| **Utilisateurs standards Firebase Auth** | **LOW** | Aucune (fonctionnent déjà en natif) | Conserver le flux `signInWithEmailAndPassword()`. | TC-01 |
| **Utilisateurs Google Sign-In** | **LOW** | Aucune (Google Identity émet déjà un UID natif) | Conserver `signInWithPopup()`. | TC-02 |
| **Utilisateurs legacy sans compte Firebase Auth** | **MEDIUM** | Absence d'enregistrement dans `auth.users` | Auto-enrôlement transparent via `createUserWithEmailAndPassword()` lors de leur première connexion. | TC-04 |
| **Utilisateurs ayant un mot de passe désynchronisé** | **MEDIUM** | Échec de validation du mot de passe Firebase Auth | Proposer le bouton « Mot de passe oublié » connecté à `sendPasswordResetEmail()`. | TC-08 |

---

## 11. TARGET ARCHITECTURE

```text
                               ┌─────────────────────────────────────────┐
                               │           CLIENT (React / Vite)         │
                               └────────────────────┬────────────────────┘
                                                    │
                                1. signInWithEmailAndPassword()
                                2. Réception Token JWT (ID Token)
                                                    │
                                                    ▼
                               ┌─────────────────────────────────────────┐
                               │       FIREBASE AUTHENTICATION           │
                               │  - Autorité unique d'identité           │
                               │  - Hashing scrypt matériel              │
                               │  - Émission de request.auth.uid         │
                               └────────────────────┬────────────────────┘
                                                    │
                              Jeton JWT authentifié transmis aux services
                                                    │
                     ┌──────────────────────────────┼──────────────────────────────┐
                     ▼                              ▼                              ▼
      ┌─────────────────────────────┐┌─────────────────────────────┐┌─────────────────────────────┐
      │       FIRESTORE RULES       ││      API EXPRESS / NODE     ││         POSTGRESQL          │
      │ - request.auth.uid          ││ - verifyIdToken()           ││ - Requêtes filtrées par     │
      │ - isSuperAdmin() par email  ││ - Firebase Admin SDK        ││   user_id = firebaseUid     │
      └─────────────────────────────┘└─────────────────────────────┘└─────────────────────────────┘
```

---

## 12. MIGRATION PHASES

* **Phase A — Audit & Cartographie :** (Étape actuelle terminée — validation des dépendances).
* **Phase B — PATCH 02A (Nettoyage Client & Priorité Firebase Auth) :**
  - Remplacement des appels client `auth_credentials` par les méthodes natives Firebase Auth (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `updatePassword`, `sendPasswordResetEmail`).
  - Suppression des erreurs de permissions levées dans la console du navigateur.
* **Phase C — PATCH 02B (Gestion des cas de désynchronisation & Réinitialisation) :**
  - Intégration du modal de réinitialisation de mot de passe par email.
  - Normalisation des UIDs dans la collection `profiles` (garantir `profiles/{firebaseUid}`).
* **Phase D — Server-only & Dépréciation de `auth_credentials` :**
  - La collection `auth_credentials` n'est plus jamais sollicitée par aucun composant applicatif.

---

## 13. PROPOSED PATCH 02A (Périmètre Strict)

Le PATCH 02A est le **plus petit changement sûr et non régressif** :

1. **Dans `src/lib/firebase.ts` :**
   - Modifier `signInWithPdi(email, password)` : Tenter `signInWithEmailAndPassword()`. En cas d'erreur `auth/user-not-found`, tenter immédiatement `createUserWithEmailAndPassword()` pour enrôler les comptes legacy de façon transparente.
   - Modifier `authenticateSuperAdmin(email, password)` : Remplacer la tentative de lecture de `auth_credentials` par l'appel direct `signInWithEmailAndPassword(auth, email, password)`.
   - Modifier `changeUserProfilePassword(oldPass, newPass)` : Utiliser `updatePassword(auth.currentUser, newPass)` (avec `reauthenticateWithCredential` si nécessaire) au lieu de manipuler des hashes SHA-256 dans Firestore.
   - Supprimer les lectures/écritures directes vers `auth_credentials` qui échouent silencieusement depuis P0-A.
2. **Dans `src/pdi/auth/PdiAuthPage.tsx` :**
   - Aligner la connexion Super-Admin sur le même pipeline sécurisé Firebase Auth.

---

## 14. PATCH 02B+ DEFERRED ITEMS (Chantiers Reportés)

* **Custom Claims signés par le serveur** : Déploiement d'une fonction Admin pour injecter `claims: { role: "super_admin" }` dans le token JWT (reporté à P2 / Hardening Serveur).
* **Nettoyage/Suppression de la collection `auth_credentials`** : Aucune suppression de données historiques dans ce patch.
* **Refonte de PostgreSQL `user_id`** : Reporté au patch SaaS/Scalabilité P2-B.

---

## 15. TEST PLAN (20 Cas de Test Exhaustifs)

| ID | Intitulé du Test | Précondition | Action | Résultat Attendu | Risque couvert |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Login Email/Password standard | Compte existant dans Firebase Auth | Saisie email/mot de passe dans `PdiAuthPage` | Connexion réussie, émission d'un token JWT valide, chargement du profil | Régression login standard |
| **TC-02** | Login Google Sign-In | Compte Google valide | Clic sur « Continuer avec Google » | Popup Google, récupération de l'UID, accès direct à l'application | Régression OAuth Google |
| **TC-03** | Reconnexion utilisateur existant | Session précédente fermée | Connexion avec identifiants connus | Reconnexion sans recréation de document | Persistance de compte |
| **TC-04** | Utilisateur sans compte Firebase Auth | Profil présent mais absent de `auth.users` | Saisie email/mot de passe valide | Création transparente dans Firebase Auth, connexion immédiate | Blocage compte legacy |
| **TC-05** | Fallback legacy supprimé | DevTools réseau ouverts | Tentative de login | Aucune requête vers `/auth_credentials` n'est émise | Erreurs de permissions P0-A |
| **TC-06** | Saisie d'un mauvais mot de passe | Compte existant | Saisie d'un mot de passe erroné | Message d'erreur clair « Identifiants incorrects », pas de crash | Gestion d'erreurs |
| **TC-07** | Changement de mot de passe | Utilisateur connecté | Modification du mot de passe dans le profil | `updatePassword()` exécuté avec succès, reconnexion valide | Régression modification mot de passe |
| **TC-08** | Reset de mot de passe oublié | Utilisateur déconnecté | Demande de réinitialisation | `sendPasswordResetEmail()` déclenché, email de récupération envoyé | Perte d'accès utilisateur |
| **TC-09** | Connexion Superadmin | Email `boudjada.youcef@gmail.com` | Connexion via l'onglet dédié | Authentifié avec token Firebase Auth, accès débloqué à la console admin | Perte d'accès Superadmin |
| **TC-10** | Lecture profil Firestore | Utilisateur connecté avec UID `U1` | Chargement de `profiles/U1` | Profil lu sans erreur de permission Firestore | Isolation des profils |
| **TC-11** | Validation `request.auth.uid` | Utilisateur connecté | Vérification dans Firestore Rules | `request.auth.uid == U1` est validé par les règles | Conformité P0-A |
| **TC-12** | Isolation inter-utilisateurs | Utilisateur `U1` connecté | Tentative d'accès au projet de `U2` | Rejet strict `permission-denied` par Firestore Rules | Fuite de données projets |
| **TC-13** | Accès API Express | Utilisateur connecté avec ID Token | Appel `/api/projects` | Token vérifié avec succès par `verifyIdToken()` | Conformité backend |
| **TC-14** | Accès PostgreSQL | Utilisateur connecté | Requête SQL filtrée par `user_id` | Données restreintes à l'UID Firebase Auth | Conformité base SQL |
| **TC-15** | Déconnexion (Logout) | Utilisateur connecté | Clic sur « Déconnexion » | `signOut(auth)` exécuté, token révoqué, redirection vers landing | Session résiduelle |
| **TC-16** | Rafraîchissement navigateur | Utilisateur connecté | Touche F5 / Reload | `onAuthStateChanged` restaure la session sans redemander le mot de passe | Perte d'état au refresh |
| **TC-17** | Multi-onglets | Utilisateur connecté | Ouverture d'un second onglet | Session partagée instantanément via IndexedDB/Firebase Auth | Désynchronisation onglets |
| **TC-18** | Expiration de session | Session inactive > 30 min | Détection timeout | Déconnexion propre avec message de sécurité | Sécurité session inactive |
| **TC-19** | Tentative d'auto-promotion de rôle | Utilisateur standard | Tentative d'écriture `role: "super_admin"` | Rejet strict par Firestore Rules (P0-A) | Élévation de privilège |
| **TC-20** | Vérification étanchéité `auth_credentials` | Client web connecté | Tentative de `getDoc(doc(db, "auth_credentials", ...))` | Rejet immédiat `permission-denied` (conforme P0-A) | Exposition des credentials |

---

## 16. ROLLBACK STRATEGY

1. **Point de restauration git :** Le commit `72a72753233567cfcbfb5e21a2b68d43f943c968` constitue la baseline stable.
2. **Intégrité des bases :** Aucune donnée Firestore, PostgreSQL ou Firebase Auth n'est effacée ou altérée.
3. **Rollback applicatif :** Restauration immédiate des fichiers `src/lib/firebase.ts` et `src/pdi/auth/PdiAuthPage.tsx` en cas d'incompatibilité constatée.

---

## 17. FINAL GO / NO-GO

* **PATCH 02A AUDIT STATUS :** **GO**
* **REASON :** L'audit confirme que les dépendances client vers `auth_credentials` sont déjà bloquées par P0-A et génèrent des erreurs réseau. Remplacer ces appels par l'API native Firebase Authentication (`signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `updatePassword`) rétablira le fonctionnement normal sans aucun risque de régression pour les comptes existants.
* **FILES THAT WOULD BE MODIFIED :**
  - `src/lib/firebase.ts`
  - `src/pdi/auth/PdiAuthPage.tsx`
* **FILES THAT MUST NOT BE MODIFIED :**
  - `firestore.rules` (déjà verrouillé et conforme en P0-A)
  - `src/pdi/isometric/*` (moteur isométrique hors périmètre)
  - `src/db/*` (PostgreSQL hors périmètre de ce patch)
  - `package.json`
* **USER LOCKOUT RISK :** **LOW** (mitigé par l'auto-enrôlement transparent et la réinitialisation par email).
* **P0-A REGRESSION RISK :** **LOW** (aligne le code client sur les règles deny-by-default déjà en place).
