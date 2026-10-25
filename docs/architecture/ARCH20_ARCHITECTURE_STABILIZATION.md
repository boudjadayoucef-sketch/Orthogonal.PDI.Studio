# ARCH-20 — STABILISATION ARCHITECTURALE ET CLÔTURE DE LA PHASE 1

**Projet :** Orthogonal PD&I Studio  
**Dépôt officiel unique :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche ciblée :** `main`  
**Commit de référence obligatoire :** `915b65c166230cd0d96125a77f804ec01b05ea5c`  
**Date d'exécution :** 18 octobre 2026  
**Environnement de validation :** Conteneur Linux AI Studio Sandbox (Node.js LTS v22.14.0, npm 10.9.8, Vite 6.2.3, Vitest 5.0.3, TypeScript 5.8.2).

---

## 1. PÉRIMÈTRE ET OBJECTIFS D'ARCH-20

ARCH-20 constitue le jalon final de stabilisation et de consolidation structurelle de la **Phase 1 (ARCH)** avant l'ouverture des travaux de la Phase 2.1 (`SKETCH-ISO`).

Conformément au mandat strict défini dans le cahier des charges :
1. **Zéro refonte invasive du monolithe :** aucun découpage nouveau, aucune modification du corps du composant, des hooks, des états React, du rendu JSX ou des calculs géométriques n'a été opéré dans `IsometrieModuleV48d.tsx`.
2. **Nettoyage rigoureux des imports en tête de fichier :** élimination exclusive des symboles importés dont l'inutilité a été démontrée par diagnostic officiel du compilateur TypeScript (`TS6133` et `TS6192`).
3. **Conservation absolue des exports métiers fournisseurs :** aucun export de module fournisseur (`core/`, `engine/`, `ui/`, `welding/`, `catalog/`, `supports/`) n'a été altéré ou supprimé.
4. **Mise en place d'une barrière anti-cycle structurelle automatisée :** création d'un test garantissant qu'aucun fichier source de `core/` ou `ui/` n'importe le monolithe `IsometrieModuleV48d.tsx`.
5. **Couverture des contrats publics de la Phase 1 :** vérification automatisée de l'existence et de l'intégrité des exports stables issus des jalons ARCH-12 à ARCH-19.
6. **Documentation de la cartographie, des conventions de nommage et de la dépendance ascendante connue.**

---

## 2. CARTOGRAPHIE RÉELLE DES RÉPERTOIRES DE LA PHASE 1

L'inspection directe du système de fichiers valide l'organisation suivante :

### 2.1 Répertoire `src/pdi/isometric/core/`
- `IsoTopologyGraph.ts` (29 747 octets) : Graphe topologique, nœuds, raccords, calcul de longueurs cumulées, dérivation des joints W00x et nomenclatures métrées (ARCH-12).
- `isoProjectionEngine.ts` (4 980 octets) : Moteur mathématique des projections axonométriques 30°, multi-vues (`iso`, `top`, `front`, `side`, `free`), transformations monde <-> écran (ARCH-13).
- `isoAnnotationEngine.ts` (7 125 octets) : Moteur de placement géométrique et d'évitement de collisions des étiquettes isométriques (ARCH-19).
- `isoProjectionState.ts` (452 octets) : Modèle d'état partagé de vue et projection.

### 2.2 Répertoire `src/pdi/isometric/engine/`
- `IsometrieModuleV48d.tsx` (760 171 octets) : Composant monolithique d'orchestration CAO / CFAO du canevas isométrique.
- `CadAutocadEngine.ts` (40 905 octets) : Primitives de dessin géométrique et géométrie analytique 2D AutoCAD.
- `pdiAlignParallel017Q.ts` (39 297 octets) : Fonctions d'alignement et de parallélisme universel.
- `pdiAnomalies017P9.ts` (6 694 octets) : Référentiel unifié des 11 codes d'anomalies de conception.
- `pdiAxes017P3.ts` (2 043 octets) : Constantes d'axes isométriques et rayons de nœuds (feuille du graphe, 0 dépendance externe).
- `pdiClassePression017K3.ts` (3 723 octets) : Tables de rating ASME B16.5 / PN et règles de dérogation de spécification.
- `pdiGlyphes017P5.ts` (1 224 octets) : Échelles et facteurs visuels des glyphes CAO.
- `pdiPorts017P2.ts` (6 592 octets) : Réorientation des ports de connexion et tolérances d'affichage.
- `pdiPrecision017P.ts` (3 311 octets) : Précision géométrique, tolérances d'accrochage et arrondi CAD.
- `pdiRegistreCommandes.v1.ts` (40 938 octets) : Registre des onglets et commandes du ruban CAO.
- `pdiSaisie017P10.ts` (3 309 octets) : Validation des longueurs, diamètres nominaux et écarts d'accrochage.
- `pdiSnapEngine.ts` (5 811 octets) : Moteur d'accrochage magnétique contextuel.
- `pdiTagging.ts` (7 178 octets) : Générateur et validateur de repères (tags) de tuyauterie.
- `useIsoInjection.ts` (5 379 octets) : Hook d'injection de données externes dans l'isométrie.

### 2.3 Répertoire `src/pdi/isometric/ui/`
- `PdiRotationButton15.tsx` (6 793 octets) : Bouton de rotation interactif (clic court, appui long cadencé, menu d'angles, flip) avec protection anti-rotation sur pointerleave/pointercancel (ARCH-15).
- `PdiCanvasToolbarControls16.tsx` (1 980 octets) : Barre d'outils du canevas (Zoom +, Zoom -, Désélection, Recentrer) (ARCH-16).
- `CanvasVisibilityControls18.tsx` (3 630 octets) : Groupe des 7 bascules de calques de visibilité du canevas (ARCH-18).
- `IsoRibbonBar.tsx` (39 064 octets) : Barre de ruban multi-onglets supérieure.
- `IsoCommandDock.tsx` (1 648 octets) : Quai d'ancrage des commandes.
- `PdiUniversalPropertyInspector.tsx` (47 961 octets) : Inspecteur contextuel de propriétés universelles.

### 2.4 Répertoire `src/pdi/welding/`
- `isoWeldSpoolEngine.ts` (23 215 octets) : Algorithmes de partitionnement en tronçons de préfabrication (spools), repérage des soudures de chantier/atelier et exports CSV.
- `IsoWeldSpoolModal.tsx` (39 995 octets) : Interface modale d'affichage du carnet de spools et soudures.

### 2.5 Répertoire `src/pdi/isometric/types/`
- `isoGraphTypes.ts` (12 192 octets) : Contrats de typage stricts TypeScript (nœuds, raccords, segments, joints, dimensions, diamètres).

### 2.6 Répertoire `src/pdi/isometric/serialization/`
- `dxfSerialization.ts` (3 248 octets) : Générateur ASCII DXF pur (R12/2000) pour l'échange CAO (ARCH-14).

---

## 3. GRAPHE DE DÉPENDANCES ET DÉPENDANCE ASCENDANTE CONNUE

### 3.1 Architecture en couches observée

```text
┌─────────────────────────────────────────────────────────────┐
│                          UI LAYER                           │
│  PdiRotationButton15, PdiCanvasToolbarControls16,           │
│  CanvasVisibilityControls18, IsoRibbonBar, etc.             │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             │
┌──────────────────────────────┐              │
│       ORCHESTRATION          │              │
│   IsometrieModuleV48d.tsx    │              │
└───────────────┬──────────────┘              │
                │                             │
                ▼                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         CORE LAYER                          │
│   isoAnnotationEngine.ts, isoProjectionEngine.ts,           │
│   IsoTopologyGraph.ts, isoProjectionState.ts                │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
                ▼                             ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│         TYPES LAYER          │ │     SERIALIZATION LAYER    │
│      isoGraphTypes.ts        │ │     dxfSerialization.ts    │
└──────────────────────────────┘ └────────────────────────────┘
```

### 3.2 Documentation de la relation connue `IsoTopologyGraph.ts` -> `pdiAxes017P3.ts`

- **Chemin exact :** `src/pdi/isometric/core/IsoTopologyGraph.ts:23` importe `pdiNodeHasFaceOffset017P3` depuis `../engine/pdiAxes017P3`.
- **Analyse d'acyclicité :**
  - Le fichier `src/pdi/isometric/engine/pdiAxes017P3.ts` est un module purement arithmétique et constant qui n'effectue **aucun import** (0 import sortant).
  - Il s'agit d'une feuille terminale du graphe de dépendances.
  - Par conséquent, bien qu'il s'agisse d'un import transversal/ascendant d'un dossier `core/` vers un fichier situé sous `engine/`, **cette relation n'engendre aucun cycle de dépendance**.
- **Décision architecturale ARCH-20 :** Conformément aux règles strictes de non-intervention cosmétique, le fichier `pdiAxes017P3.ts` est maintenu à son emplacement d'origine sans déplacement ni renommage, et aucun chemin d'import n'a été altéré.

---

## 4. DIAGNOSTIC TYPESCRIPT DES IMPORTS INUTILISÉS ET NETTOYAGE

### 4.1 Diagnostic initial (`npx tsc --noEmit --noUnusedLocals true`)

Le compilateur officiel TypeScript 5.8.2 a été exécuté en mode strict de détection des identifiants inutilisés.
Dans la section des imports en tête de `IsometrieModuleV48d.tsx` (lignes 1 à 249), **46 diagnostics `TS6133` et `TS6192`** ont été relevés et confirmés :

| Symbole / Déclaration | Code TS | Justification |
| :--- | :--- | :--- |
| `pdiStandardsNote` (`pdiBranding`) | TS6133 | Non référencé dans le corps du module (seul `pdiCompanyName` est utilisé). |
| `pdiSnapDirectionIso`, `pdiFindCoincidentNodes` (`pdiPrecision017P`) | TS6133 | Non utilisés dans le composant ; les calculs de snap utilisent `pdiSnapEngine`. |
| `pdiIsoAxisDirs017P3`, `pdiNodeHasFaceOffset017P3` (`pdiAxes017P3`) | TS6133 | Non référencés dans le corps ; seuls `pdiNodeRadius017P3` et `PDI_METRE_CONVENTION_017P3` sont requis. |
| `extractEntityAnchors` (`pdiAlignParallel017Q`) | TS6133 | Non utilisé par le composant. |
| `PDI_ISO_ANGLE_017I2`, `PDI_ISO_COS_017I2`, `PDI_ISO_SIN_017I2` (`isoProjectionEngine`) | TS6133 | Constantes de projection désormais consommées en interne par `isoProjectionEngine` et `isoAnnotationEngine`. |
| `type IsoAnnotationPlacement` (`isoAnnotationEngine`) | TS6133 | Type importé mais non explicitement référencé dans les annotations locales de types. |
| `pdiGroupesOnglet017M`, `pdiEntreesGroupe017M` (`pdiRegistreCommandes.v1`) | TS6133 | Commandes du ruban résolues via `PDI_ONGLETS_RUBAN_017M` et `PDI_INVITE_COMMANDE_017M`. |
| `PDI_CLASSES_B165_017K3`, `PDI_DESIGNATIONS_PN_017K3` (`pdiClassePression017K3`) | TS6133 | Définitions de catalogues conservées dans le fournisseur, non lues directement dans le JSX. |
| `PdiSpoolEntry` (`isoWeldSpoolEngine`) | TS6133 | Seul `PdiWeldEntry` est annoté dans les types locaux du module. |
| Import complet `../../catalog/trouvayCauvinCatalog` | TS6192 | `TROUVAY_CAUVIN_CATALOG` et `getComponentVignetteSvg` ne sont pas appelés dans `IsometrieModuleV48d`. Conservés intacts dans le module fournisseur. Module sans effet de bord. |
| `formatTemperature` (`pdiUnitSystem`) | TS6133 | L'isométrie traite la géométrie, pression et masse ; la température n'est pas affichée dans le canevas. |
| `intersectSegments2D`, `intersectRayWithSegment` (`cad2dModifyEngine`) | TS6133 | Fonctions de calcul géométrique 2D non invoquées directement dans le composant. |
| `computeCivilMto`, `verifyPipingSpans` (`pdiMssSupportEngine`) | TS6133 | Calculs génie civil et portées déportés dans `PdiSupportCivilPanel`. |
| Import complet `../../../assets/pdiLogos` | TS6192 | Constantes et data URLs non consommées (le logo est rendu par `PdiBrandMark`). Module pur d'assets sans effet de bord. |
| 17 icônes Lucide (`ZoomIn`, `ZoomOut`, `Disc`, `ArrowRightLeft`, `EyeOff`, `Crosshair`, `Check`, `Scissors`, `RotateCcw`, `PanelRightClose`, `PanelRightOpen`, `Clipboard`, `CopyPlus`, `Terminal`, `CornerDownLeft`, `Tv2`, `Monitor`) | TS6133 | Icônes dont le rendu a été transféré aux composants modulaires dédiés (`PdiCanvasToolbarControls16`, `CanvasVisibilityControls18`). |
| `searchCadCommands` (`CadAutocadEngine`) | TS6133 | Remplacé par les tables de commandes globales du ruban. |
| `CadCommandLineBar` (`../components/CadCommandLineBar`) | TS6133 | Composant non instancié dans le JSX de cette version. |
| `CadShapeToolbar` (`../components/CadShapeToolbar`) | TS6133 | Composant non instancié dans le JSX de cette version. |
| `EQUIPMENT_NODE_TYPES`, `isEquipmentNode`, `inferJointType`, `isWeldableConnection` (`IsoTopologyGraph`) | TS6133 | Fonctions de dérivation topologique internalisées dans `deriveProjectJoints` et `validateProjectGraph`. Conservées intactes dans le module fournisseur `IsoTopologyGraph.ts`. |

### 4.2 Diagnostic post-nettoyage

Après application du remplacement ciblé :
- **Diagnostics restants dans la section des imports (lignes 1 à 240) : `0`** (tableau vide `[]`).
- **Aucune variable ni fonction du corps du composant n'a été modifiée**, conformément aux consignes de sécurité.

---

## 5. BARRIÈRE ANTI-CYCLE AUTOMATISÉE ET TESTS ARCHITECTURAUX

### 5.1 Test A — Intégrité des contrats publics de la Phase 1
La suite `src/pdi/isometric/tests/arch20ArchitectureStabilizationTests.spec.ts` valide les contrats publics suivants :
1. `IsoTopologyGraph.ts` (fonctions de création, topologie, géométrie, validation, nomenclatures, constantes).
2. `isoProjectionEngine.ts` (fonctions `getProjectionAxes`, `isoProjectV4`, `isoUnprojectV4`, constantes d'angles).
3. `isoAnnotationEngine.ts` (fonctions `compactIsoLabel`, `buildIsoAnnotationLayout`).
4. `isoWeldSpoolEngine.ts` (fonctions de spools, marquage SVG, logs CSV, palette).
5. `PdiRotationButton15.tsx` (composant interactif ARCH-15).
6. `PdiCanvasToolbarControls16.tsx` (composant toolbar ARCH-16).
7. `CanvasVisibilityControls18.tsx` (composant calques de visibilité ARCH-18).

### 5.2 Test B — Barrière anti-cycle dans `core/` et `ui/`
- Le test inspecte de manière récursive tous les fichiers source `.ts` et `.tsx` situés dans `src/pdi/isometric/core/` et `src/pdi/isometric/ui/`.
- Les commentaires de bloc (`/* ... */`) et de ligne (`// ...`) sont éliminés avant recherche afin de prévenir les faux positifs.
- Les motifs recherchés couvrent tous les imports statiques, réexports et imports dynamiques ciblant `IsometrieModuleV48d` quelle que soit la profondeur relative (`../`, `../../`, chemin absolu ou alias).
- **Résultat réel :** **0 violation détectée**.
- **Test négatif de validation du détecteur :** Le test valide également que des fragments de code artificiels contenant des imports illégaux déclenchent bien une détection positive, démontrant que la barrière est active et opérationnelle.

### 5.3 Test C — Protection des exports fournisseurs
Le test confirme que les exports des modules fournisseurs n'ont subi aucune régression :
- `trovayCauvinCatalog.ts` : `TROUVAY_CAUVIN_CATALOG`, `getComponentVignetteSvg`.
- `pdiClassePression017K3.ts` : `PDI_CLASSES_B165_017K3`, `PDI_DESIGNATIONS_PN_017K3`, `PDI_CLASSE_PAR_DEFAUT_017K3`.
- `pdiMssSupportEngine.ts` : `MSS_SUPPORT_CATALOG`, `computeCivilMto`, `verifyPipingSpans`.
- `IsoTopologyGraph.ts` : `isWeldableConnection`, `inferJointType`, `isEquipmentNode`.

---

## 6. CONVENTION DE NOMMAGE POUR LES PHASES FUTURES (À PARTIR DE LA PHASE 2)

Afin d'éviter la prolifération de numéros de jalons ou de tickets dans l'arborescence du code source :

1. **Règle pour les fichiers de code de production (`src/**/*.ts`, `src/**/*.tsx`) :**
   - **Interdiction formelle d'inclure des identifiants de tickets, sprints ou jalons dans le nom de nouveaux fichiers** (ex. ne plus créer `MonComposant21.tsx` ou `moteurFeature22.ts`).
   - Les noms doivent exprimer exclusivement la responsabilité métier ou technique claire (ex. `isoAnnotationEngine.ts`, `sketchContourDetector.ts`, `pipingWallThicknessCalculator.ts`).
2. **Préservation historique des fichiers existants :**
   - Aucun fichier historique existant (`PdiRotationButton15.tsx`, `PdiCanvasToolbarControls16.tsx`, `CanvasVisibilityControls18.tsx`, `pdiPrecision017P.ts`, etc.) n'est renommé rétroactivement, afin de garantir la stabilité des références git, de la documentation et des tests.
3. **Convention pour les fichiers de test (`*.spec.ts`, `*.test.ts`) :**
   - Les fichiers de test peuvent continuer à porter un préfixe de jalon ou de ticket (ex. `arch20ArchitectureStabilizationTests.spec.ts`, `sketch21DetectionTests.spec.ts`) afin de préserver la traçabilité des exigences contractuelles et des audits de conformité.

---

## 7. RÉSULTATS DES VALIDATIONS RÉELLEMENT OBSERVÉES

| Contrôle | Commande exécutée | Résultat observé | Détails |
| :--- | :--- | :--- | :--- |
| **Nouveau test ARCH-20** | `npx vitest run arch20ArchitectureStabilizationTests.spec.ts` | **PASS (10/10 tests)** | Durée : 986 ms. Contrats publics, anti-cycle et exports fournisseurs vérifiés. |
| **Suite complète Vitest** | `npx vitest run` | **PASS (16/16 fichiers, 70/70 tests, 100% green)** | Durée : 14,29 s. Zéro échec, zéro régression sur ARCH-07 à ARCH-19. |
| **Typecheck officiel** | `npm run lint` (`tsc --noEmit`) | **PASS (Code de sortie 0)** | 0 erreur TypeScript dans l'ensemble du projet. |
| **Build de production** | `npm run build` | **PASS (Code de sortie 0)** | Vite bundle web généré + esbuild bundle serveur (`dist/server.cjs`, 23.5 Ko). |
| **Compilateur AI Studio** | `compile_applet` | **PASS** | `Build succeeded - the applet is compiled`. |

---

## 8. RISQUES RÉSIDUELS ET LIMITES DE PREUVE

1. **Absence de dépôt Git local dans le conteneur Sandbox :**
   Comme documenté dans BASELINE-01 (§1.1), le conteneur AI Studio ne dispose pas d'un dossier `.git`. Le SHA de référence `915b65c166230cd0d96125a77f804ec01b05ea5c` est le commit officiel d'ancrage contractuel. La validation s'effectue sur les fichiers présents sur le filesystem du conteneur.
2. **Périmètre de la barrière anti-cycle :**
   La barrière anti-cycle couvre exhaustivement les répertoires `core/` et `ui/` vis-à-vis du monolithe `IsometrieModuleV48d.tsx`. Elle ne constitue pas une preuve formelle d'absence absolue de tout cycle entre l'ensemble des modules tiers du projet, mais sécurise la séparation des couches fondamentales de la Phase 1.
3. **Conformité normative :**
   Comme rappelé dans BASELINE-01, la stabilité architecturale démontrée par cette suite n'équivaut pas à une homologation réglementaire des calculs physiques ASME B31.3 / B31.8 / B31.12.

---

## 9. STATUT INITIAL ARCH-20 ET TRANSITION VERS FIX-01

- **Statut initial ARCH-20 :** **`IMPLEMENTED (AVANT CORRECTIF RECURSION)`**
- **Validation technique initiale :** 10 tests unitaires, 70 tests globaux, typecheck et build réussis.
- **Réserve relevée lors de l'audit de reprise :** Le parcours anti-cycle initial utilisait `fs.readdirSync(dir)` sans descente récursive, ne couvrant que le niveau racine immédiat de `core/` et `ui/`.

---

## 10. ARCH-20-FIX-01 — CORRECTION DU PARCOURS RÉCURSIF ANTI-CYCLE

**Date d'exécution :** 25 octobre 2026  
**Commit de base obligatoire :** `e604d7fc2cd32bd31046068660a77df5dedf3a8d`  
**Statut du correctif :** **`IMPLEMENTED`**

### 10.1 Diagnostic du défaut
Le test anti-cycle initial utilisait un appel à plat `fs.readdirSync(dir)` :
- **Conséquence :** Si un fichier source TypeScript était placé dans un sous-répertoire de `core/` (ex. `core/sub/engineBridge.ts`) ou de `ui/` (ex. `ui/controls/subPanel.tsx`), il échappait silencieusement au contrôle anti-cycle.

### 10.2 Implémentation du collecteur récursif
Dans `src/pdi/isometric/tests/arch20ArchitectureStabilizationTests.spec.ts`, la fonction suivante a été introduite :
```ts
export function collectTsFilesRecursively(dir: string): string[]
```
- **Mécanisme :**
  - Utilise `fs.readdirSync(dir, { withFileTypes: true })`.
  - Descend récursivement dans toute entrée où `entry.isDirectory()` est vrai.
  - Sécurisation contre les cycles : **ne suit pas les liens symboliques** (`entry.isSymbolicLink() === false`).
  - Filtrage des fichiers source : collecte les extensions `.ts` et `.tsx`.
  - **Règle d'exclusion stricte des fichiers de test :** les fichiers `*.spec.ts`, `*.spec.tsx`, `*.test.ts` et `*.test.tsx` sont exclus du scan des fichiers de production afin d'éviter les faux positifs sur les suites de test elles-mêmes.
  - Déterminisme : tri alphabétique des chemins absolus via `.sort()`.

### 10.3 Répertoires surveillés et extensions
- **Répertoires racines analysés :** `src/pdi/isometric/core/` et `src/pdi/isometric/ui/` à toutes les profondeurs d'arborescence.
- **Extensions inspectées :** `.ts`, `.tsx`.

### 10.4 Test unitaire d'arborescence temporaire imbriquée (profondeur ≥ 2)
Un test unitaire dédié utilisant `fs.mkdtempSync` dans `os.tmpdir()` a été ajouté dans la suite :
- Structure temporaire créée :
  - `root/topLevel.ts` (niveau 0)
  - `root/nested/levelOne.tsx` (niveau 1)
  - `root/nested/component.spec.ts` (fichier test à exclure)
  - `root/nested/sub/ordinary.ts` (niveau 2)
  - `root/nested/sub/badFile.ts` (niveau 2, contenant un import interdit ciblant `IsometrieModuleV48d`)
- **Résultats vérifiés par assertions strictes :**
  1. Exactement 4 fichiers collectés (les 4 fichiers source `.ts`/`.tsx`).
  2. Le fichier de test `component.spec.ts` est formellement ignoré par le collecteur.
  3. L'ordre des chemins retournés est strictement déterministe.
  4. Le fichier en profondeur 2 (`nested/sub/badFile.ts`) est bien inspecté par `detectMonolithImports` et l'import interdit est détecté.
  5. Le fichier ordinaire de profondeur 2 ne lève aucune fausse alerte.
  6. Nettoyage garanti du répertoire temporaire dans un bloc `finally` via `fs.rmSync(tempDir, { recursive: true, force: true })`.

### 10.5 Évolution du nombre de tests ARCH-20
- **Avant ARCH-20-FIX-01 :** 10 tests dans la suite `arch20ArchitectureStabilizationTests.spec.ts` (total projet : 70 tests).
- **Après ARCH-20-FIX-01 :** **11 tests** dans la suite `arch20ArchitectureStabilizationTests.spec.ts` (total projet : **71 tests**).

### 10.6 Résultats réels observés lors des vérifications
- **Test ciblé ARCH-20 :** `npx vitest run src/pdi/isometric/tests/arch20ArchitectureStabilizationTests.spec.ts` -> **PASS (11/11 tests, 23 ms)**.
- **Suite complète Vitest :** `npx vitest run` -> **PASS (16 suites, 71 tests, 100% green)**.
- **Typecheck officiel :** `npm run lint` (`tsc --noEmit`) -> **PASS (0 erreur, code 0)**.
- **Build de production :** `npm run build` -> **PASS (code 0, Vite web + server.cjs 23.5 Ko)**.
- **Compilateur AI Studio :** `compile_applet` -> **PASS (`Build succeeded - the applet is compiled`)**.

### 10.7 Limites connues du détecteur de motifs d'import
- La barrière anti-cycle analyse les imports statiques (`import ... from '...'`), les réexports (`export * from '...'`) et les imports dynamiques standards (`import('...')`) ciblant `IsometrieModuleV48d` dans `core/` et `ui/`.
- Elle ne prétend pas détecter des constructions dynamiques exotiques (ex. `eval`, calculs dynamiques de chaînes de chemins ou `require.resolve` indirect) ni garantir l'absence absolue de tout cycle entre l'ensemble des modules tiers du projet.
- La barrière est spécifique et dédiée à l'étanchéité des couches `core/` et `ui/` vis-à-vis du monolithe `IsometrieModuleV48d.tsx`.

### 10.8 Statut global d'ARCH-20 post-correctif
- **ARCH-20-FIX-01 :** **`IMPLEMENTED`**
- **ARCH-20 :** **`EN ATTENTE D'AUDIT EXTERNE`** (soumis à l'audit externe ChatGPT et au contre-audit Gemini après le push utilisateur).
- **Phase 1 et déblocage SKETCH-ISO :** En attente de validation finale distincte ; aucun déblocage automatique n'est anticipé.
