# ARCH-18 — EXTRACTION DES CONTRÔLES DE VISIBILITÉ DU CANEVAS

**Projet :** Orthogonal PD&I Studio  
**Dépôt :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche :** `main`  
**Commit de référence :** `9d0fa3b712cf82187cf963c34d56ffa5fe0e6a13`  
**Date d'exécution :** 17 octobre 2026  
**Environnement de validation :** Conteneur Linux AI Studio (Node.js LTS v22, npm 10.9.8, Vite 6.2.3, Vitest 5.0.3, TypeScript 5.8.2).

---

## 1. RÉSUMÉ DES CHANGEMENTS

L'étape **ARCH-18** a permis d'extraire de manière contrôlée et purement présentielle le groupe des **sept bascules de visibilité du canevas** hors du fichier monolithique `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` (lignes 10024 à 10031 du commit de référence).

- **Nouveau composant créé :** `src/pdi/isometric/ui/CanvasVisibilityControls18.tsx`.
- **Suite de tests créée :** `src/pdi/isometric/tests/arch18CanvasVisibilityControlsTests.spec.ts`.
- **Intégration dans le moteur :** Import dans `IsometrieModuleV48d.tsx`, construction d'un objet d'état typé `visibility` et d'une action unifiée `actions.onToggleLayer`, avec commutation explicite via un `switch (layer)` vers les 7 setters d'état locaux existants.
- **Préservation des boutons exclus :** Les boutons `Flame` (`Weld Map`), `MSS` (panneau de supports) et `GUIDE` (raccourcis) restent strictement en place dans `IsometrieModuleV48d.tsx` et sont exclus du composant extrait.

---

## 2. LISTE EXACTE DES FICHIERS CRÉÉS ET MODIFIÉS

| Fichier | Nature | Description |
| :--- | :--- | :--- |
| `src/pdi/isometric/ui/CanvasVisibilityControls18.tsx` | **Création** | Composant de présentation contrôlé contenant les 7 boutons de visibilité, leurs types d'interface et leurs styles Tailwind. |
| `src/pdi/isometric/tests/arch18CanvasVisibilityControlsTests.spec.ts` | **Création** | Suite de tests Vitest unitaire (6 tests) validant les états actif/inactif, infobulles, labels, dispatch des clés et exclusion de Weld Map / MSS / GUIDE. |
| `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` | **Modification** | Import de `CanvasVisibilityControls18` et remplacement des 7 balises `<button>` inline par le composant câblé aux setters locaux. |
| `docs/architecture/ARCH18_CANVAS_VISIBILITY_CONTROLS.md` | **Création** | Rapport d'architecture détaillé de l'étape ARCH-18. |
| `docs/architecture/BASELINE-01_RECONCILIATION.md` | **Modification** | Mise à jour de la matrice des jalons ARCH et actualisation du décompte réel des tests observés. |

---

## 3. CONTRAT TYPESCRIPT RESPECTÉ

Dans `src/pdi/isometric/ui/CanvasVisibilityControls18.tsx` :

```ts
export type CanvasVisibilityLayerKey =
  | "grid"
  | "civilBackground"
  | "dimensions"
  | "pipeLabels"
  | "welds"
  | "spoolColoring"
  | "annotations";

export interface CanvasVisibilityState {
  grid: boolean;
  civilBackground: boolean;
  dimensions: boolean;
  pipeLabels: boolean;
  welds: boolean;
  spoolColoring: boolean;
  annotations: boolean;
}

export interface CanvasVisibilityActions {
  onToggleLayer: (layer: CanvasVisibilityLayerKey) => void;
}

export interface CanvasVisibilityControlsProps {
  visibility: CanvasVisibilityState;
  actions: CanvasVisibilityActions;
}
```

Dans `IsometrieModuleV48d.tsx` :

```tsx
<CanvasVisibilityControls18
  visibility={{
    grid: showGrid,
    civilBackground: gcVisibleEditor,
    dimensions: showDimensions,
    pipeLabels: showPipeLabels,
    welds: showWelds,
    spoolColoring: colorBySpool,
    annotations: showLabels,
  }}
  actions={{
    onToggleLayer: (layer: CanvasVisibilityLayerKey) => {
      switch (layer) {
        case "grid":
          setShowGrid(v => !v);
          break;
        case "civilBackground":
          setGcVisibleEditor(v => !v);
          break;
        case "dimensions":
          setShowDimensions(v => !v);
          break;
        case "pipeLabels":
          setShowPipeLabels(v => !v);
          break;
        case "welds":
          setShowWelds(v => !v);
          break;
        case "spoolColoring":
          setColorBySpool(v => !v);
          break;
        case "annotations":
          setShowLabels(v => !v);
          break;
      }
    },
  }}
/>
```

---

## 4. LES 7 COMMANDES PRÉSERVÉES

1. **Grille (`#`) :** Bascule `showGrid`, classe actif `bg-blue-600 text-white`, infobulle `"Afficher la grille (#)"`.
2. **Fond génie civil (`GC`) :** Bascule `gcVisibleEditor`, classe actif `bg-cyan-600 text-white`, infobulle `"Afficher le génie civil (GC)"`.
3. **Cotations (`⇔`) :** Bascule `showDimensions`, classe actif `bg-blue-600 text-white`, infobulle `"Afficher les cotes (⇔)"`.
4. **Labels tuyauterie (`PL`) :** Bascule `showPipeLabels`, classe actif `bg-cyan-600 text-white`, infobulle `"Labels des tuyauteries (PL)"`.
5. **Soudures (`W`) :** Bascule `showWelds`, classe actif `bg-amber-600 text-white`, infobulle `"Afficher les soudures Wxxx (W)"`.
6. **Coloration spool (`SP`) :** Bascule `colorBySpool`, classe actif `bg-purple-600 text-white`, infobulle `"Coloration par Spool (SP)"`.
7. **Annotations (`Aa`) :** Bascule `showLabels`, classe actif `bg-indigo-600 text-white`, infobulle `"Afficher les annotations (Aa)"`.

Classe inactif uniforme : `bg-slate-800 text-slate-400`.

---

## 5. CONFIRMATION DE CHAQUE INVARIANT

- **Invariant 1 (États conservés) :** Les sept états `useState` (`showGrid`, `gcVisibleEditor`, `showDimensions`, `showPipeLabels`, `showWelds`, `colorBySpool`, `showLabels`) restent définis dans `IsometrieModuleV48d.tsx`.
- **Invariant 2 (Groupes SVG intouchés) :** Aucun groupe SVG ni logique de rendu conditionnel dans le canevas n'a été altéré.
- **Invariant 3 (Coloration spools) :** La logique de partitionnement topologique et de palette des spools n'a pas été déplacée.
- **Invariant 4 (Raccourcis clavier & Persistance) :** Le hook d'écoute clavier (`keydown`), les fonctions de sauvegarde locale et d'export restent 100% identiques.
- **Invariant 5 (Calculs géométriques & topologiques) :** Aucun calcul de coordonnées ni règle normative touché.
- **Invariant 6 (Exclusion stricte) :** `Weld Map`, `MSS` et `GUIDE` sont exclus de `CanvasVisibilityControls18.tsx`.
- **Invariant 7 (Dépendances) :** Zéro nouvelle dépendance ajoutée.

---

## 6. RÉSULTATS RÉELS DES TESTS ET VALIDATIONS

1. **Test unitaire ciblé ARCH-18 :**
   ```bash
   npx vitest run src/pdi/isometric/tests/arch18CanvasVisibilityControlsTests.spec.ts
   ```
   **Résultat :** **6 tests passés sur 6 (100% green)** en 451 ms.

2. **Suite globale des tests du projet :**
   ```bash
   npm test
   ```
   **Résultat :** **14 fichiers de suites passés sur 14, 47 tests passés sur 47 (100% green)** en 13,96 s.

3. **TypeScript / Lint :**
   ```bash
   npm run lint
   ```
   **Résultat :** `tsc --noEmit` exécuté avec succès, **0 erreur** (code de sortie 0).

4. **Build de production :**
   ```bash
   npm run build
   ```
   **Résultat :** Bundle Vite + esbuild `dist/server.cjs` complétés avec succès en 24,52 s (**code de sortie 0**).

5. **Compilateur AI Studio (`compile_applet`) :**
   **Résultat :** `Build succeeded - the applet is compiled`.

---

## 7. LIMITES RÉSIDUELLES ET CONTEXTE GIT

- **Environnement conteneurisé :** Comme constaté lors de BASELINE-01, le répertoire `.git` n'est pas hébergé dans le sous-conteneur applicatif (`fatal: not a git repository`). Aucun commit direct ni push vers GitHub n'a été effectué. Le SHA de référence fourni pour la tâche est `9d0fa3b712cf82187cf963c34d56ffa5fe0e6a13`.
- Les fichiers modifiés et créés sont prêts sur le système de fichiers pour revue, validation humaine et commit manuel par le développeur.
