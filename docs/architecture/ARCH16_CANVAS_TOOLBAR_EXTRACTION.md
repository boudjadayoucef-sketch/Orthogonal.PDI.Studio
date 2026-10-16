# ARCH-16 — SAFE CANVAS TOOLBAR CONTROLS EXTRACTION

**Projet :** Orthogonal PD&I Studio  
**Dépôt :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche :** `main`  
**Commit de référence de départ :** `ba4d813e520300ec48c2ee548a49efc8e46c0e9b`  
**Date d'exécution :** 16 octobre 2026  
**Environnement de validation :** Conteneur AI Studio (Node.js LTS v22, npm 10.9.8, Vite 6.2.3, Vitest 5.0.3, TypeScript 5.8.2).

---

## 1. ÉTAT DU CODE AVANT MODIFICATION

Avant l'exécution de la tâche ARCH-16, le canevas isométrique interactif dans `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` intégrait directement en ligne (lignes 10057 à 10061) la barre d'outils des 4 boutons de contrôle visuel et de sélection :

```tsx
<div className="flex shrink-0 items-center gap-0.5 border border-slate-800 rounded-lg p-0.5 bg-slate-950">
  <button type="button" onClick={zoomOut} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Zoom arrière (-)"><ZoomOut className="w-3.5 h-3.5"/></button>
  <button type="button" onClick={zoomIn} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 hover:text-white" title="Zoom avant (+)"><ZoomIn className="w-3.5 h-3.5"/></button>
  <button type="button" onClick={()=>{setSelectedNodeIds([]);setSelectedNodeId(null);setSelectedFitting(null);setSelectedSegmentIds([]);setSelectedSegmentId(null);}} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300 hover:text-white" title="Désélectionner tout">×</button>
  <button type="button" onClick={resetView} className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-cyan-300 hover:text-white" title="Recentrer et ajuster la vue (Touche 0 / Fit)"><RefreshCw className="w-3.5 h-3.5"/></button>
</div>
```

### Problématiques identifiées :
- Couplage fort entre le layout global du canevas et le groupe de boutons de contrôle.
- Présence d'une fonction anonyme de désélection multi-états directement dans le JSX inline.
- Absence de composant dédié réutilisable ou testable isolément sans instancier le moteur complet de 14 000 lignes.

---

## 2. FRONTIÈRE D'EXTRACTION ET FICHIERS CRÉÉS / MODIFIÉS

### 2.1 Nouveau composant dédié : `src/pdi/isometric/ui/PdiCanvasToolbarControls16.tsx`
- **Rôle :** Composant purement présentiel (sans hooks d'état interne, zéro effet de bord).
- **Interface des propriétés (`PdiCanvasToolbarControls16Props`) :**
  ```ts
  export interface PdiCanvasToolbarControls16Props {
    onZoomOut: () => void;
    onZoomIn: () => void;
    onClearSelection: () => void;
    onResetView: () => void;
    className?: string;
  }
  ```
- **Dépendances visuelles conservées :** `ZoomOut`, `ZoomIn`, `RefreshCw` depuis `lucide-react`.
- **Maintien strict :**
  - Ordre des 4 boutons : Zoom arrière (-), Zoom avant (+), Désélectionner tout (×), Recentrer la vue (Fit).
  - Styles Tailwind et attributs d'accessibilité (`title`).

### 2.2 Fichier modifié : `src/pdi/isometric/engine/IsometrieModuleV48d.tsx`
- **Import ajouté :**
  ```ts
  import { PdiCanvasToolbarControls16 } from "../ui/PdiCanvasToolbarControls16";
  ```
- **Remplacement du JSX inline :**
  ```tsx
  <PdiCanvasToolbarControls16
    onZoomOut={zoomOut}
    onZoomIn={zoomIn}
    onClearSelection={() => {
      setSelectedNodeIds([]);
      setSelectedNodeId(null);
      setSelectedFitting(null);
      setSelectedSegmentIds([]);
      setSelectedSegmentId(null);
    }}
    onResetView={resetView}
  />
  ```
- **Garantie d'intégrité :** Les actions de désélection exécutées sont strictement identiques à l'état antérieur (réinitialisation de `selectedNodeIds`, `selectedNodeId`, `selectedFitting`, `selectedSegmentIds`, `selectedSegmentId`). Aucune action n'a été retirée ni ajoutée.

---

## 3. SUITE DE TESTS DÉDIÉE : `src/pdi/isometric/tests/arch16CanvasToolbarControlsTests.spec.ts`

Une suite de tests Vitest ciblée a été créée sans manipulation des composants internes de React, le composant étant une fonction de présentation pure :
1. **Présence exacte des 4 boutons** dans la structure retournée.
2. **Déclenchement isolé de `onZoomOut`** sans invocation des autres callbacks.
3. **Déclenchement isolé de `onZoomIn`** sans invocation des autres callbacks.
4. **Déclenchement isolé de `onClearSelection`** sans invocation des autres callbacks.
5. **Déclenchement isolé de `onResetView`** sans invocation des autres callbacks.
6. **Vérification de l'ordre et des libellés accessibles des titres**.
7. **Prise en charge d'une classe CSS personnalisée**.

---

## 4. VALIDATIONS RÉELLES EXÉCUTÉES

1. **Test unitaire ciblé ARCH-16 :**
   ```bash
   npx vitest run src/pdi/isometric/tests/arch16CanvasToolbarControlsTests.spec.ts
   ```
   **Résultat :** **7/7 tests passés (100% green)** en 807 ms.

2. **Suite globale des tests du projet :**
   ```bash
   npm test
   ```
   **Résultat :** **13/13 fichiers de suites passés, 41/41 tests passés (100% green)** en 16,42 s.

3. **Vérification TypeScript / Lint :**
   ```bash
   npm run lint
   ```
   **Résultat :** `tsc --noEmit` passé avec le **code de sortie 0 (0 erreur de typage)**.

4. **Build de production :**
   ```bash
   npm run build
   ```
   **Résultat :** Vite v6.4.3 + esbuild server.ts exécutés avec succès (**code de sortie 0**).

5. **Compilateur AI Studio (`compile_applet`) :**
   **Résultat :** `Build succeeded - the applet is compiled`.

---

## 5. LIMITES RÉSIDUELLES ET SÉCURITÉ DU REPO

- **Absence d'impact métier :** Aucun calcul mathématique, formule de projection ou règle normative n'a été modifié.
- **Environnement Git :** L'environnement conteneurisé sandboxé d'AI Studio n'embarque pas le répertoire `.git`. Les modifications sont appliquées localement sur le filesystem et prêtes pour révision, sans push direct vers GitHub.
