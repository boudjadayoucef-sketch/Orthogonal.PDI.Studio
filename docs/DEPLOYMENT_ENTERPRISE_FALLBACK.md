# Déploiement PD&I — réseau entreprise sans Vercel

## Problème constaté
- Vercel ne fonctionne pas sur le réseau entreprise.
- Pas d'accès firewall.
- AI Studio fonctionne mais le quota `europe-west1` est saturé.

## Stratégie recommandée maintenant

### Option A — Build statique exportable ZIP, prioritaire
1. Construire localement ou dans AI Studio : `npm run build`.
2. Récupérer le dossier `dist/`.
3. Ouvrir l'app sur un poste autorisé ou l'héberger sur un serveur interne/NAS/IIS/Apache/Nginx.
4. Avantage : pas besoin Vercel, pas besoin firewall sortant vers Vercel.

### Option B — Google Cloud Run autre région
Si AI Studio/Google Cloud est le seul accès utilisable :
- éviter `europe-west1` saturé.
- essayer : `europe-west2`, `europe-west3`, `europe-west4`, `me-west1`, `us-central1`.
- garder Firebase côté client via variables `VITE_FIREBASE_*`.

### Option C — GitHub Pages pour version statique
- possible si le réseau entreprise ne bloque pas github.io.
- adapté au front React statique.
- moins adapté aux APIs serveur Express.

### Option D — Archive HTML autonome pour démonstration
- créer une build offline limitée.
- utile pour démonstration client/interne.
- pas de backend réel.

## Décision provisoire
Continuer développement via patches + GitHub, mais préparer une sortie `dist/` autonome pour éviter dépendance à Vercel.
