# ORTHOGONAL PD&I STUDIO — SEC-01-FIX-01
## IMPLÉMENTATION SÉCURITÉ ATOMIQUE — WORKFLOW OFFICIEL V3.4

### CONTEXTE ET BASELINE

Dépôt :

`boudjadayoucef-sketch/Orthogonal.PDI.Studio`

Branche :

`main`

SHA DE DÉPART OBLIGATOIRE :

`ba65fcc1d3b3e376863e12698e41b7078ea696f8`

État baseline :

- 23 suites Vitest
- 171 tests passants
- `tsc --noEmit` : PASS
- `npm run build` : PASS

Le dépôt GitHub reste **PUBLIC volontairement pendant le développement**.

Ne pas rendre le dépôt privé comme solution.

Architecture cible future :

**Internet → Hostinger VPS → Nginx/LiteSpeed reverse proxy → Node.js/Express → Firebase Auth / Firestore**

Le système d’email doit être **portable** :

- Sender.net
- Brevo
- Resend
- SMTP Hostinger

Aucun fournisseur email ne doit être imposé dans le code métier.

---

# RÈGLE ABSOLUE DU TICKET

Une seule tâche atomique :

> Sécuriser la frontière serveur/authentification/paiement/Firestore/GitHub de SEC-01 sans commencer DRAW-2D et sans refactorisation fonctionnelle hors périmètre.

INTERDICTIONS :

- Ne pas commencer DRAW-2D.
- Ne pas modifier la logique industrielle PD&I.
- Ne pas modifier les modules Isométriques métier sans nécessité de sécurité directe.
- Ne pas modifier `IsometrieModuleV48d.tsx`.
- Ne pas ajouter de faux paiement.
- Ne pas inventer une API officielle Slick-Pay.
- Ne pas inventer un secret.
- Ne pas placer de secret dans le frontend.
- Ne pas coder une dépendance obligatoire à Render.
- Ne pas coder une dépendance obligatoire à Sender/Brevo/Resend.
- Ne pas supprimer une sécurité existante uniquement pour faire passer les tests.
- Ne pas écrire des tests qui recopient la logique de production.

---

# A — AUTHENTIFICATION ET SUPER ADMIN

## A1 — SUPPRIMER L'AUTORITÉ PAR EMAIL

Dans :

`src/middleware/auth.ts`

et :

`firestore.rules`

supprimer toute autorisation Super Admin basée uniquement sur une adresse email.

INTERDIT :

```ts
email === "..."
```

comme mécanisme d’autorisation administrative.

La source d’autorité doit être :

**Firebase ID Token vérifié + Custom Claims.**

---

## A2 — EMAIL VERIFIED POUR ACTIONS SENSIBLES

Les privilèges sensibles doivent exiger :

- utilisateur authentifié ;
- token Firebase valide ;
- `email_verified === true` lorsque l’action dépend d’une identité email.

Créer ou adapter une fonction/middleware de production réutilisable pour cette vérification.

Le Super Admin doit être contrôlé via :

```text
request.auth.token.role == "super_admin"
```

ou l’équivalent vérifié côté serveur.

Aucun fallback silencieux vers une adresse email.

---

## A3 — PROTECTION DE L'ENDPOINT ADMIN

`/api/admin/set-user-role` doit :

- exiger un Firebase ID Token valide ;
- exiger le Custom Claim `role === "super_admin"` ;
- refuser un utilisateur non vérifié si l’identité email est utilisée dans l’opération ;
- valider strictement `targetUid` ;
- valider strictement la liste des rôles ;
- ne jamais faire confiance à un rôle envoyé par le client comme preuve d’autorisation.

Ajouter une protection contre une auto-escalade accidentelle ou non autorisée.

---

# B — WEBHOOKS PAIEMENT

Fichiers concernés notamment :

`server.ts`

Créer une architecture de vérification de webhook portable.

## B1 — RÈGLE FONDAMENTALE

Aucun webhook ne doit :

- activer un abonnement ;
- modifier un rôle ;
- créer une licence active ;

avant vérification d’authenticité.

---

## B2 — PADDLE

Implémenter la vérification officielle de signature Paddle uniquement à partir de la configuration serveur.

Le secret doit provenir exclusivement d’une variable d’environnement serveur.

Ne jamais exposer ce secret au frontend.

Préserver l’accès au corps brut si nécessaire à la vérification de signature.

---

## B3 — SLICK-PAY

NE PAS INVENTER un algorithme de signature Slick-Pay.

Créer une couche explicite de vérification/configuration :

- si une méthode officielle de signature est configurée : vérifier avant traitement ;
- si elle n’est pas configurée : le webhook ne doit pas automatiquement activer un abonnement.

Dans ce cas, enregistrer éventuellement un état sûr/pending ou refuser explicitement selon l’architecture existante, mais :

**JAMAIS d’activation automatique sans authentification vérifiée.**

---

## B4 — ANTI-REJEU

Implémenter une protection d’idempotence côté serveur.

Un même identifiant d’événement ne doit pas pouvoir produire plusieurs activations.

La protection doit :

- être déterministe ;
- survivre au redémarrage du processus si l’infrastructure Firebase est disponible ;
- utiliser un identifiant stable du provider ;
- distinguer un événement en cours et un événement traité si nécessaire.

---

## B5 — DONNÉES

Ne pas journaliser en clair des payloads complets contenant potentiellement :

- emails ;
- informations client ;
- données sensibles ;
- secrets ou signatures.

Les logs doivent être minimisés.

---

# C — FIRESTORE RULES

Modifier :

`firestore.rules`

Objectif :

**DENY BY DEFAULT réel.**

Conserver :

```text
match /{document=**} {
  allow read, write: if false;
}
```

Mais corriger les exceptions.

---

## C1 — SUPPRIMER LES AUTORISATIONS PUBLIQUES NON JUSTIFIÉES

Auditer et corriger notamment les règles de type :

```text
allow create: if true;
allow read: if true;
```

Toute collection publique doit être explicitement justifiée.

Les logs, demandes de mot de passe, données techniques et événements internes ne doivent pas devenir une surface publique d’écriture non bornée.

---

## C2 — SUPER ADMIN

Supprimer les adresses email hardcodées comme autorité.

Utiliser le Custom Claim vérifié.

---

## C3 — MULTI-TENANT / UID

Conserver ou renforcer :

- isolation par UID ;
- immuabilité de `ownerId` / `uid` ;
- contrôle des sous-collections ;
- séparation lecture / list si nécessaire.

Un client ne doit jamais pouvoir devenir propriétaire d’une ressource appartenant à un autre utilisateur par simple écriture Firestore.

---

# D — CONFIGURATION ET SECRETS

Auditer :

`src/lib/firebase-admin.ts`

et les fichiers de configuration réellement présents.

## D1 — SERVEUR VS CLIENT

Séparer clairement :

### Configuration publique frontend

Exemple :

`VITE_*`

### Secrets serveur

Exemple :

- webhook secrets ;
- credentials serveur ;
- clés SMTP/API email ;
- secrets de paiement.

Les secrets serveur ne doivent jamais utiliser un préfixe `VITE_`.

---

## D2 — DÉMARRAGE SÛR

En production :

- pas de fallback silencieux vers un projet demo ;
- pas de credential secret fictif ;
- pas de démarrage production avec une configuration critique manquante.

Le serveur doit échouer explicitement avec un message sûr si une configuration critique réellement nécessaire manque.

Ne pas afficher le secret dans l’erreur.

---

## D3 — GITIGNORE

Renforcer `.gitignore` pour couvrir explicitement les fichiers de secrets courants.

Conserver :

`.env.example`

si nécessaire.

Ne jamais placer une vraie clé dans un fichier de test.

---

# E — EXPRESS / HOSTINGER / NGINX / LITESPEED

Modifier `server.ts` de manière minimale et sûre.

## E1 — TRUST PROXY

Configurer explicitement Express pour le futur déploiement derrière un reverse proxy.

La configuration doit être compatible Hostinger/Nginx/LiteSpeed et ne doit pas supposer Render.

Ne pas utiliser aveuglément une configuration trop permissive sans justification.

---

## E2 — CORS

Remplacer la liste figée par une configuration contrôlée via environnement.

Exigences :

- localhost autorisé seulement en développement ;
- origine Hostinger configurable en production ;
- origine AI Studio configurable uniquement lorsque nécessaire ;
- aucune wildcard permissive en production ;
- `credentials: true` uniquement avec une origine explicitement autorisée.

---

## E3 — CSP

Conserver la compatibilité nécessaire au développement AI Studio, mais :

- ne pas utiliser `frame-ancestors *` en production ;
- rendre les origines de frame explicitement configurables ;
- conserver les protections `nosniff`, HSTS en HTTPS et politique de référence appropriée.

---

## E4 — STATIC FILES

Conserver la protection contre le Path Traversal.

Ajouter explicitement :

- refus des dotfiles ;
- comportement sûr pour les chemins suspects ;
- aucune exposition de fichiers `.env`, `.git`, backups ou fichiers secrets.

---

## E5 — HEALTHCHECK

Conserver un endpoint santé minimal :

`/api/health`

ou créer un alias :

`/healthz`

Il doit être utilisable par Hostinger/reverse proxy.

Il ne doit pas révéler :

- secrets ;
- structure détaillée du serveur ;
- chemins internes ;
- données clients.

Réduire les informations de diagnostic exposées publiquement.

---

## E6 — ENDPOINTS DE DIAGNOSTIC

L’endpoint `/api/health/assets` et toute route analogue ne doivent pas exposer inutilement :

- liste de fichiers internes ;
- structure du bundle ;
- informations facilitant l’énumération.

Soit les supprimer du mode production, soit les protéger strictement, soit les réduire à une réponse non sensible.

---

# F — RATE LIMITER ET HYGIÈNE MÉMOIRE

## F1 — RATE LIMITER BORNÉ

Le `Map` actuel ne doit pas pouvoir croître indéfiniment.

Créer une fonction de production testable qui :

- limite le nombre d’entrées ;
- expire les entrées anciennes ;
- évite une croissance mémoire non bornée ;
- continue de retourner 429 lorsque la limite est dépassée.

Ne pas dépendre d’une bibliothèque externe si une correction simple et sûre suffit.

---

## F2 — EMAIL ANTI-BOMBING

Préparer une protection spécifique pour les futures routes d’activation/ré-envoi email.

Même si le fournisseur final n’est pas encore choisi :

- le mécanisme de throttling doit être indépendant du fournisseur ;
- il doit limiter les demandes par identité/cible ;
- il doit éviter qu’un utilisateur puisse déclencher un bombardement d’emails.

Ne pas envoyer réellement d’email sans fournisseur configuré.

---

## F3 — MÉMOIRE CLIENT / WASM

Auditer les ressources déjà présentes dans le projet pour les cas de :

- Object URLs ;
- Web Workers ;
- OpenCV/WASM ;
- Canvas ou gros buffers.

Ne modifier que les fuites démontrables dans le périmètre SEC-01.

Toute ressource créée doit disposer d’un chemin de libération correspondant :

- `URL.revokeObjectURL()`
- `worker.terminate()`
- nettoyage mémoire/documenté lorsque disponible.

Ne pas faire un refactor massif des modules industriels.

---

# G — GITHUB PUBLIC PROTÉGÉ

Le dépôt doit rester PUBLIC.

Ajouter une protection automatisée minimale dans `.github/workflows/`.

## G1 — CI

Conserver la CI actuelle :

- `npm ci`
- tests
- `tsc --noEmit`
- build

---

## G2 — SECURITY WORKFLOW

Ajouter un workflow de sécurité adapté à un dépôt public.

Il doit au minimum détecter les secrets accidentellement ajoutés dans le dépôt ou le diff.

Ne pas utiliser une clé réelle pour tester le détecteur.

Le workflow doit échouer si une vraie fuite détectable est introduite.

Ne pas prétendre détecter les secrets historiques déjà présents sans outil/preuve permettant de le faire.

---

# ARCHITECTURE EMAIL FUTURE — CONTRAT PORTABLE

Ne pas intégrer définitivement Sender, Brevo ou Resend.

Si une abstraction est nécessaire, créer une interface minimale de fournisseur email permettant ultérieurement :

```text
EmailProvider
  ├── SenderProvider
  ├── BrevoProvider
  ├── ResendProvider
  └── SmtpProvider
```

Mais :

- ne pas implémenter quatre SDK maintenant ;
- ne pas ajouter de dépendance inutile ;
- ne pas envoyer d’email réel sans configuration ;
- les secrets restent exclusivement côté serveur.

Les futures URL d’activation doivent être protégées contre :

**OPEN REDIRECT.**

Toute URL de retour doit être :

- relative sûre ;
- ou appartenir à une allowlist d’origines configurées.

---

# FICHIERS AUTORISÉS

Modifier uniquement les fichiers nécessaires parmi :

- `server.ts`
- `src/middleware/auth.ts`
- `src/lib/firebase-admin.ts`
- `firestore.rules`
- `.gitignore`
- `.github/workflows/ci.yml`
- `.github/workflows/security.yml` (nouveau si nécessaire)
- fichiers de tests dédiés à SEC-01
- éventuellement un petit module source dédié à la sécurité si cela permet de tester directement la logique.

Interdit de modifier :

- `src/pdi/isometric/engine/IsometrieModuleV48d.tsx`
- la logique métier industrielle ;
- les calculs normatifs ;
- les fichiers hors périmètre sans justification directe.

---

# TESTS OBLIGATOIRES

Créer au minimum :

## 1. UNE SUITE TEST SOURCE RÉELLE

Par exemple :

`src/security/tests/sec01Security.spec.ts`

ou une structure équivalente cohérente avec le dépôt.

Les tests doivent importer directement les vraies fonctions de production.

---

## 2. COUVERTURE MINIMALE

Tester :

### Auth

- token/authentification absent → 401 ;
- utilisateur authentifié sans rôle Super Admin → refus ;
- rôle Super Admin uniquement via Custom Claim → autorisé ;
- ancienne adresse email sans Custom Claim → refus ;
- email non vérifié → refus pour action sensible.

### Rate limiting

- limite normale ;
- dépassement → 429 ;
- expiration ;
- nettoyage des anciennes entrées ;
- borne mémoire.

### Webhook

- signature/configuration invalide → aucune activation ;
- événement dupliqué → une seule activation ;
- webhook non authentifié → aucune modification de privilège ;
- absence de configuration Slick-Pay officielle → aucune auto-activation.

### Redirect

- URL relative sûre → autorisée ;
- domaine non autorisé → refus ;
- tentative `https://evil.example/...` → refus.

### Configuration

- production sans configuration critique → échec sûr ;
- secret absent du frontend ;
- aucune valeur secrète imprimée.

### Firestore

Tester la logique/règles selon les outils déjà disponibles dans le projet.

Si aucun émulateur Firestore n’est actuellement configuré, ne pas inventer une fausse validation d’émulateur.

Dans ce cas :

- ajouter les tests réellement exécutables ;
- documenter explicitement ce qui nécessite une validation Firebase Emulator séparée.

---

# RÈGLE ANTI-FAUX TESTS

INTERDICTION :

Créer une fonction de test qui recopie l’algorithme de production puis compare deux copies.

Les tests doivent appeler directement les fonctions exportées du code de production.

---

# VALIDATION OBLIGATOIRE AVANT LIVRAISON

Exécuter et fournir les sorties réelles :

```bash
npx vitest run
```

```bash
tsc --noEmit
```

```bash
npm run build
```

La CI GitHub doit ensuite être verte après push.

---

# CRITÈRE OBLIGATOIRE "NO CODE IMPLEMENTED"

Le travail est considéré :

**FAILED — NO CODE IMPLEMENTED**

si le diff final ne contient pas :

1. au moins **un fichier `.ts` ou `.tsx` de production réellement modifié ou créé** ;
2. au moins **un fichier de test réellement ajouté ou modifié** ;
3. un diff Git non vide ;
4. des tests exécutés contre les fonctions de production.

---

# RAPPORT FINAL OBLIGATOIRE

À la fin, fournir :

1. SHA de départ ;
2. liste exacte des fichiers modifiés/créés ;
3. résumé A → G ;
4. résultat exact des tests ;
5. résultat `tsc --noEmit` ;
6. résultat `npm run build` ;
7. limites résiduelles ;
8. aucune affirmation de sécurité non prouvée.

Ne pas modifier GitHub directement depuis cette session si le workflow normal exige une validation utilisateur avant push.

FIN DU TICKET :

`SEC-01-FIX-01`