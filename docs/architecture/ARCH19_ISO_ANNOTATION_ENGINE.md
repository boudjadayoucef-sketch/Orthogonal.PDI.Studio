# ARCH-19 — EXTRACTION DU MOTEUR D'ANNOTATIONS ISOMÉTRIQUES

**Projet :** Orthogonal PD&I Studio  
**Dépôt :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche :** `main`  
**Commit de référence de départ :** `80ac510b2cbf484eac905fb040458dc56017a5de`  
**Date d'exécution :** 18 octobre 2026  
**Environnement de validation :** Conteneur Linux AI Studio (Node.js LTS v22, npm 10.9.8, Vite 6.2.3, Vitest 5.0.3, TypeScript 5.8.2).

---

## 1. OBJECTIF ET PÉRIMÈTRE

L'étape **ARCH-19** a réalisé l'extraction fidèle du groupe d'algorithmes et de contrats de types dédié au placement et à l'évitement de collisions des étiquettes isométriques (`compactIsoLabel`, `IsoAnnotationPlacement`, `buildIsoAnnotationLayout`), depuis le monolithe `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` vers un module géométrique et topologique pur et réutilisable : `src/pdi/isometric/core/isoAnnotationEngine.ts`.

---

## 2. FICHIERS CRÉÉS ET MODIFIÉS

| Fichier | Nature | Description |
| :--- | :--- | :--- |
| `src/pdi/isometric/core/isoAnnotationEngine.ts` | **Création** | Module autonome pur hébergeant `compactIsoLabel`, l'interface `IsoAnnotationPlacement`, l'interface `IsoAnnotationViewport` et `buildIsoAnnotationLayout`. Zéro dépendance à React. |
| `src/pdi/isometric/tests/arch19IsoAnnotationEngineTests.spec.ts` | **Création** | Suite de tests Vitest complète (13 tests) couvrant la troncature, la réservation d'équipements, l'ancrage de soudures, les anneaux de nœuds, les vecteurs de segments, l'évitement de collision, la non-mutation et l'équivalence exacte. |
| `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` | **Modification** | Remplacement de la définition locale par l'import depuis `../core/isoAnnotationEngine`. Maintien strict du `useMemo` existant et des appels directs au rendu. |
| `docs/architecture/ARCH19_ISO_ANNOTATION_ENGINE.md` | **Création** | Rapport d'architecture détaillé de l'étape ARCH-19. |
| `docs/architecture/BASELINE-01_RECONCILIATION.md` | **Modification** | Ajout du jalon ARCH-19 dans la matrice des tâches et actualisation du décompte réel des tests observés (15 suites, 60 tests). |

---

## 3. DÉPENDANCES ET STRATÉGIE DE DÉCOUPLAGE

Les quatre dépendances de l'algorithme ont été analysées et résolues sans créer de duplication ni d'import circulaire :

1. **`isoProjectV4` :** Importée directement depuis `src/pdi/isometric/core/isoProjectionEngine.ts`. Fonction pure déjà extraite sous ARCH-13.
2. **`portWorldPosition` :** Importée directement depuis `src/pdi/isometric/core/IsoTopologyGraph.ts`. Fonction topologique pure déjà extraite sous ARCH-12.
3. **`equipmentLabel` :** Importée directement depuis `src/pdi/isometric/core/IsoTopologyGraph.ts`. Helper d'affichage pur déjà extrait sous ARCH-12.
4. **`segmentEndpoints` :** Importée directement depuis `src/pdi/isometric/core/IsoTopologyGraph.ts`. Fonction géométrique pure déjà extraite sous ARCH-12.

---

## 4. PREUVE DE L'ABSENCE D'IMPORT CIRCULAIRE

Le graphe de dépendances de `isoAnnotationEngine.ts` est strictement acyclique :
```text
isoAnnotationEngine.ts
├── types/isoGraphTypes.ts (types stricts uniquement)
├── core/IsoTopologyGraph.ts (portWorldPosition, segmentEndpoints, equipmentLabel)
└── core/isoProjectionEngine.ts (isoProjectV4)
```
- **Zéro import** de `IsometrieModuleV48d.tsx` depuis `isoAnnotationEngine.ts`.
- **Zéro dépendance** à un état React ou hook (`useState`, `useRef`, etc.).
- `IsometrieModuleV48d.tsx` est un consommateur pur de `isoAnnotationEngine.ts`.

---

## 5. CONTRATS TYPESCRIPT RETENUS

Dans `src/pdi/isometric/core/isoAnnotationEngine.ts` :

```ts
export const compactIsoLabel: (value: string, maxLength?: number) => string;

export interface IsoAnnotationPlacement {
  id: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
}

export interface IsoAnnotationViewport {
  zoom: number;
  panX: number;
  panY: number;
  viewMode?: string;
  yaw?: number;
  pitch?: number;
}

export function buildIsoAnnotationLayout(
  nodes: readonly IsoNode[],
  segments: readonly IsoSegment[],
  joints: readonly PipingJoint[],
  viewport: IsoAnnotationViewport
): Map<string, IsoAnnotationPlacement>;
```

- Zéro `any` dans les signatures publiques.
- Utilisation de `readonly IsoNode[]`, `readonly IsoSegment[]`, `readonly PipingJoint[]` pour garantir la non-mutation des structures du projet.

---

## 6. TESTS AJOUTÉS ET RÉSULTATS RÉELS

La suite `src/pdi/isometric/tests/arch19IsoAnnotationEngineTests.spec.ts` valide 13 tests exhaustifs :
1. **Troncature de libellé (`compactIsoLabel`) :** textes courts, chaînes vides, limite exacte à 30 caractères, troncature à 29 + ellipse, limite personnalisée.
2. **Réservation des équipements :** réservation du rectangle central 38×38 pour éviter toute superposition d'étiquette.
3. **Ancrage et déport de soudures :** orientation perpendiculaire au port (`px`, `py`) et dimensions standardisées (34×11).
4. **Placement des nœuds :** exploration des anneaux concentriques et dimensions proportionnelles au texte.
5. **Placement des tronçons :** positionnement le long de la normale au segment au point médian projeté.
6. **Évitement de collision :** vérification de l'absence totale de chevauchement (`overlaps === false`) sur deux nœuds proches.
7. **Non-mutation et entrées vides :** vérification de l'absence d'effet de bord sur les tableaux d'origine et support d'entrées vides sans crash.
8. **Équivalence exacte :** comparaison point à point avec les coordonnées déterministes calculées avant extraction.

---

## 7. RÉSULTATS DES COMMANDES ET TESTS

1. **Test unitaire ciblé ARCH-19 :**
   ```bash
   npx vitest run src/pdi/isometric/tests/arch19IsoAnnotationEngineTests.spec.ts
   ```
   **Résultat :** **13 tests passés sur 13 (100% green)** en 552 ms.
2. **Suite globale des tests du projet :**
   ```bash
   npm test
   ```
   **Résultat :** **15 fichiers de suites passés sur 15, 60 tests passés sur 60 (100% green)** en 12,64 s.
3. **Vérification TypeScript / Lint :**
   ```bash
   npm run lint
   ```
   **Résultat :** `tsc --noEmit` exécuté avec succès, **0 erreur** (code de sortie 0).
4. **Build de production :**
   ```bash
   npm run build
   ```
   **Résultat :** Vite v6.4.3 + bundle esbuild Node.js complétés avec succès en 22,43 s (**code de sortie 0**).
5. **Compilateur AI Studio (`compile_applet`) :**
   **Résultat :** `Build succeeded - the applet is compiled`.

---

## 8. ÉQUIVALENCE COMPORTEMENTALE

- Les formules mathématiques de placement (`Math.hypot`, `overlaps`, pénalité de score, anneaux d'échantillonnage `phase`, offsets `[22, 38, 56, 78]`, etc.) ont été transférées sans aucune modification de constante ni d'arrondi.
- L'équivalence stricte a été démontrée à la précision du pixel par le test de référence (`Test 8`) validant les coordonnées exactes (`x`, `y`, `anchorX`, `anchorY`, `width`, `height`) sur un cas de tuyauterie combinant équipement, soudure, nœud et tronçon.

---

## 9. CONTEXTE GIT ET VERDICT

- **Absence de Git local :** Comme documenté dans BASELINE-01, l'environnement conteneurisé d'AI Studio n'héberge pas le sous-répertoire `.git` (`fatal: not a git repository`). Aucun commit direct ni push vers GitHub n'a été produit.
- **SHA de référence fourni :** `80ac510b2cbf484eac905fb040458dc56017a5de`.
- **Verdict :** **`IMPLEMENTED`**
