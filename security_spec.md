# Spécifications de Sécurité ABAC & Isolation Tenant SaaS

## 1. Invariants de Données (Data Invariants)
- **Isolation Multi-Tenant Strict**: Aucun projet ou plan isométrique ne peut être lu ou modifié par un utilisateur n'appartenant pas au même `tenantId`.
- **Authentification Obligatoire**: Toutes les opérations nécessitent un utilisateur authentifié (`request.auth != null`).
- **Validation d'Identité**: Tout document créé doit enregistrer l'ID de l'auteur (`ownerId == request.auth.uid`).
- **Immutabilité**: Le `tenantId` et l' `ownerId` sont immuables après la création.
- **Master Gate**: L'accès aux sous-collections (ex: `/projects/{projectId}/isometrics/{isoId}`) est soumis à l'accès au projet parent `/projects/{projectId}` via `get()`.

## 2. Les 12 Payloads d'Attaque ("Dirty Dozen Payloads")
1. **Tenant Bypasser**: Créer un projet avec un `tenantId` attribué à une autre organisation.
2. **Identity Spoofing**: Définir `ownerId` avec l'UID d'un autre utilisateur lors de la création.
3. **Ghost Field Injection**: Ajouter un champ non autorisé `isAdmin: true` dans le profil utilisateur.
4. **Tenant Hijack Update**: Tenter de modifier le `tenantId` d'un projet existant.
5. **Orphan Write**: Insérer une isométrie dans un `projectId` inexistant.
6. **Cross-Tenant List Query**: Interroger la collection `/projects` sans filtrer sur le `tenantId` de l'utilisateur.
7. **Cross-Tenant Read**: Accéder directement par GET au document d'un autre tenant.
8. **Resource Poisoning**: Envoyer un champ de texte de 1MB sur `name` pour provoquer une attaque Denial of Wallet.
9. **Invalid ID Injection**: Utiliser des caractères d'injection comme ID de document (`../../../admin`).
10. **Spoofed Email Admin**: Tenter de passer outre les règles avec un email non vérifié (`email_verified: false`).
11. **Terminal State Mutation**: Modifier un document archivé ou validé (`status: "approved"`) sans privilège.
12. **Unauthenticated List Scraping**: Tenter de lister la collection `/users` sans être authentifié.
