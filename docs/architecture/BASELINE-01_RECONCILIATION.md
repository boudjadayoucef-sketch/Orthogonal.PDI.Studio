# BASELINE-01 — AUDIT DE REPRISE ET RÉCONCILIATION DE LA FEUILLE DE ROUTE

**Date de l'audit :** 12 octobre 2026  
**Dépôt officiel unique de référence :** `boudjadayoucef-sketch/Orthogonal.PDI.Studio`  
**Branche ciblée :** `main`  
**Commit de référence de départ (fourni pour l'audit) :** `ef4eca399ef6d817d69a916b6a5f5f2381a6d3eb`  
**Environnement de validation :** Conteneur Linux AI Studio Sandbox (Node.js LTS v22, npm 10.9.8, Vite 6.2.3, Vitest 5.0.3, TypeScript 5.8.2).

---

## 1. VÉRIFICATIONS DE L'ÉTAT DU DÉPÔT ET LIMITATIONS GIT

### 1.1 Limitations liées à l'absence de Git dans le conteneur
- **Constat technique :** L'exécution de `git status`, `git log` ou `git rev-parse` renvoie l'erreur fatale :
  ```text
  fatal: not a git repository (or any of the parent directories): .git
  ```
- **Conséquences objectives :**
  1. Le HEAD réel de `main` et le hash du commit en cours ne peuvent pas être interrogés directement par les commandes Git au sein de cet environnement.
  2. Le commit de référence `ef4eca399ef6d817d69a916b6a5f5f2381a6d3eb` est le point d'ancrage fourni contractuellement pour cet audit. Il ne constitue pas en soi une preuve vérifiable par Git que les modifications locales non poussées sont déjà intégrées dans le dépôt distant GitHub.
  3. L'évaluation du diff repose donc sur l'inspection documentaire des fichiers sources présents sur le système de fichiers du conteneur.

### 1.2 Réconciliation des références de dépôts historiques
Deux dénominations distinctes coexistaient dans l'historique et la documentation du projet :
- `boudjadayoucef-sketch/Orthogonal-PDI-studio-` (Dépôt historique mentionné dans les rapports ARCH-12, ARCH-13, ARCH-14).
- `boudjadayoucef-sketch/Orthogonal.PDI.Studio` (**Dépôt de travail officiel unique et définitif**).

**Clarification formelle :**
- Les commits historiques (`88d8ff0...`, `e74c6ea...`, `7a30c64...`, `b407726...`) cités dans les anciens rapports appartiennent à la généalogie archivée de l'ancien dépôt ou de branches antérieures.
- Toute opération de maintenance, pipeline CI et livraison est désormais exclusivement rattachée à `Orthogonal.PDI.Studio`.
- Les rapports historiques existants dans `docs/architecture/` sont préservés tels quels en tant qu'archives, sans modification rétrospective.

### 1.3 Intégration Continue (CI) et configuration vérifiée
- **Workflow GitHub Actions :** `.github/workflows/ci.yml`.
  - Événements déclencheurs : `push` et `pull_request` sur la branche `main`.
  - Runner : `ubuntu-latest`, Node.js 22.
  - Séquence de validation définie dans le fichier :
    1. `npm ci`
    2. `npm test` (`vitest run`)
    3. `npm run lint` (`tsc --noEmit`)
    4. `npm run build` (`vite build && esbuild server.ts ...`)
- **Limitation de visibilité CI :** L'accès réseau direct aux runs GitHub Actions n'étant pas disponible depuis le conteneur, le statut rapporté est celui des scripts exécutés localement et non un badge interrogé en temps réel sur l'API GitHub.

---

## 2. MATRICE DE RÉCONCILIATION DES TÂCHES D'ARCHITECTURE (ARCH-07 À ARCH-15)

Cette matrice sépare rigoureusement :
- ce qui est **présent en code et vérifié par tests automatisés** ;
- ce qui constitue une **structure architecturale sans validation normative complète démontrée** ;
- ce qui est **documentaire ou partiel**.

| Tâche | Statut Réconcilié | Éléments Présents dans le Code Source | Résultats de Tests Réellement Observés | Limites & Éléments à Auditer |
| :--- | :--- | :--- | :--- | :--- |
| **ARCH-07** | Implémenté / Tests passés | Adaptateurs d'architecture industrielle (`src/pdi/normative/`), isolation des couches. | 1 test Vitest passed (`arch07IndustrialArchitectureTests.spec.ts` appelant une suite interne de conformité). | Validation formelle d'indépendance organisationnelle, sans validation de calculs physiques. |
| **ARCH-08** | Implémenté / Tests passés | Modèle multi-domaines (`PdiUniversalEntity`), séparation Piping / Pipeline / Skid / Equipment. | 1 test Vitest passed (`arch08MultiDomainArchitectureTests.spec.ts`). | Vérification des frontières de typage et de non-duplication des schémas. |
| **ARCH-09** | Implémenté / Tests passés | Résolveur multi-codes (`designCodeRegistry`), aiguillage des spécifications. | 1 test Vitest passed (`arch09MultiCodeResolverTests.spec.ts` englobant la suite interne). | L'aiguillage de code fonctionne ; la conformité métallurgique détaillée reste à auditer. |
| **ARCH-10** | Implémenté / Tests passés | Modèle d'ingénierie pipeline (équations Barlow, facteurs de classe, épaisseurs nominales). | 1 test Vitest passed (`arch10PipelineEngineeringModelTests.spec.ts` validant ≥15 assertions internes). | Formules déterministes validées par tests internes ; homologation réglementaire non visée. |
| **ARCH-11** | Implémenté / Tests passés | Modules de calcul ASME B31.8 (pressions de conception, facteurs de tracé F/E/T). | 1 test Vitest passed (`arch11B31_8PipelineReadinessTests.spec.ts` validant la suite interne). | Voir Section 3 : validation normative non démontrée par les preuves consultées pour les cas hors suite. |
| **ARCH-12** | Extraction réalisée et vérifiée | `src/pdi/isometric/core/IsoTopologyGraph.ts` (893 lignes), `src/pdi/isometric/types/isoGraphTypes.ts` (426 lignes). | 8 tests Vitest passed (`arch12IsoTopologyExtractionTests.spec.ts`). | Topologie, connectivité des ports, dérivation des soudures W00x et BOM métré extraits du monolithe. |
| **ARCH-13** | Extraction réalisée et vérifiée | `src/pdi/isometric/core/isoProjectionEngine.ts` (209 lignes). | 4 tests Vitest passed (`arch13IsoProjectionEngineTests.spec.ts`). | Calcul des axes orthonormés 30°, multi-vues (`iso`, `top`, `front`, `side`, `free`), zoom et pan. |
| **ARCH-14** | Extraction réalisée et vérifiée | `src/pdi/isometric/serialization/dxfSerialization.ts` (85 lignes). | 1 test Vitest passed (`arch14DxfSerializationTests.spec.ts`). | Génération ASCII DXF pure (entités LINE, POINT, TEXT sur calques tuyauterie). |
| **ARCH-15** | Implémenté / Tests comportementaux validés | `src/pdi/isometric/ui/PdiRotationButton15.tsx` (161 lignes) extrait de `IsometrieModuleV48d.tsx`. | 6 tests Vitest passed (`arch15UiModularizationTests.spec.ts`). | Tests comportementaux complets (clic court, appui long 350 ms, pointerleave/pointercancel avec sécurisation anti-rotation intempestive au relâchement, sélection d'angles et flip). |
| **ARCH-16** | Extraction UI réalisée / Tests validés | `src/pdi/isometric/ui/PdiCanvasToolbarControls16.tsx` (60 lignes) extrait de `IsometrieModuleV48d.tsx`. | 7 tests Vitest passed (`arch16CanvasToolbarControlsTests.spec.ts`). | Composant présentiel pur sans état interne pour les 4 boutons du canevas (Zoom arrière, Zoom avant, Désélection générale, Recentrer). Callbacks et styles préservés. |
| **ARCH-18** | Extraction UI visibilité réalisée / Tests validés | `src/pdi/isometric/ui/CanvasVisibilityControls18.tsx` (137 lignes) extrait de `IsometrieModuleV48d.tsx`. | 6 tests Vitest passed (`arch18CanvasVisibilityControlsTests.spec.ts`). | Composant présentiel contrôlé pour les 7 bascules de visibilité du canevas (#, GC, ⇔, PL, W, SP, Aa). Setters explicites, exclusions strictes de Weld Map, MSS et GUIDE. |
| **ARCH-19** | Extraction moteur annotations réalisée / Tests validés | `src/pdi/isometric/core/isoAnnotationEngine.ts` (190 lignes) extrait de `IsometrieModuleV48d.tsx`. | 13 tests Vitest passed (`arch19IsoAnnotationEngineTests.spec.ts`). | Moteur algorithmique déterministe d'évitement de collisions et de placement d'étiquettes (nœuds, soudures, tronçons, réservation équipements). Pureté algorithmique, zéro import circulaire. |

---

## 3. STATUT DES NORMES ET LIMITES DES PREUVES TECHNIQUES

Il est impératif de distinguer rigoureusement la **présence de code et de types**, la **réussite des tests automatisés** et la **validation technique certifiée des règles normatives**.

### 3.1 ASME B31.3 (Process Piping)
- **Constat dans le code :** Tables de dimensions et ratings de brides B16.5/B16.9 présentes dans `trouvayCauvinCatalog.ts` et `pdiClassePression017K3.ts`.
- **Statut technique :** **Validation partielle démontrée**. Le calcul géométrique de routage, l'assignation des classes de pression nominale (150# à 2500#) et la sélection des composants sont couverts par les tests d'intégration, mais le calcul des contraintes admissibles thermiques ou de flexibilité n'est pas implémenté.

### 3.2 ASME B31.8 (Gas Transmission and Distribution Piping Systems)
- **Constat dans le code :** Présence d'un adaptateur de calcul et d'une suite de préparation (`arch11B31_8PipelineReadinessTests.ts`).
- **Statut technique :** **Validation normative non démontrée par les preuves consultées**. Si l'équation de Barlow standard et l'application des facteurs de classe (Location Class 1 à 4) réussissent les tests d'assertion du repo, cela ne vaut pas validation de conformité complète à l'édition ASME B31.8 en vigueur pour l'ensemble des scénarios de pose (stations de compression, dérivations, franchissements).

### 3.3 ASME B31.12 / H₂ (Hydrogen Piping and Pipelines)
- **Constat dans le code :** Identifié comme référence dans le résolveur multi-codes (`designCodeRegistry`) et dans les tables de fascicules.
- **Statut technique :** **À auditer / Non implémenté en calcul dédié**. Aucun moteur de vérification des matériaux spécifiques à l'hydrogène (fragilisation, facteurs de réduction de contrainte H₂) n'a fait l'objet d'une preuve de test unitaire active dans la suite exécutée.

---

## 4. RÉSULTATS DES COMMANDES ET TESTS RÉELLEMENT OBSERVÉS

Les vérifications automatisées réelles exécutées dans l'environnement lors de cet audit rapportent les données exactes suivantes :

### 4.1 Suite de tests Vitest (`npm test` / `npx vitest run`)
- **Commande exécutée :** `npx vitest run`
- **Fichiers de test (Suites) :** **15 passed (15 au total)**
- **Nombre total de tests rapportés par Vitest :** **60 passed (60 au total)**
- **Durée totale d'exécution :** ~12,6 secondes

**Ventilation exacte des 15 fichiers de test exécutés :**
1. `src/pdi/isometric/tests/arch19IsoAnnotationEngineTests.spec.ts` : **13 tests passed** *(moteur annotations ARCH-19)*
2. `src/pdi/isometric/tests/arch12IsoTopologyExtractionTests.spec.ts` : **8 tests passed**
3. `src/pdi/isometric/tests/arch16CanvasToolbarControlsTests.spec.ts` : **7 tests passed**
4. `src/pdi/isometric/tests/arch14JsonCommandsTests.spec.ts` : **6 tests passed**
5. `src/pdi/isometric/tests/arch15UiModularizationTests.spec.ts` : **6 tests passed**
6. `src/pdi/isometric/tests/arch18CanvasVisibilityControlsTests.spec.ts` : **6 tests passed**
7. `src/pdi/isometric/tests/arch13IsoProjectionEngineTests.spec.ts` : **4 tests passed**
8. `src/pdi/isometric/tests/arch14Fix01ReliabilityTests.spec.ts` : **3 tests passed**
9. `src/pdi/isometric/tests/arch14DxfSerializationTests.spec.ts` : **1 test passed**
10. `src/pdi/normative/tests/arch07IndustrialArchitectureTests.spec.ts` : **1 test passed** *(exécute en interne sa propre suite de conformité)*
11. `src/pdi/normative/tests/arch08MultiDomainArchitectureTests.spec.ts` : **1 test passed**
12. `src/pdi/normative/tests/arch09MultiCodeResolverTests.spec.ts` : **1 test passed** *(exécute en interne le résolveur de codes)*
13. `src/pdi/normative/tests/arch10PipelineEngineeringModelTests.spec.ts` : **1 test passed** *(exécute en interne ≥15 assertions de pipeline)*
14. `src/pdi/normative/tests/arch11B31_8PipelineReadinessTests.spec.ts` : **1 test passed** *(exécute en interne la suite de préparation B31.8)*
15. `src/pdi/normative/tests/normativeGlobalIntegrationTests.spec.ts` : **1 test passed**

*Remarque méthodologique importante :* Ne pas confondre un test Vitest unitaire direct (comme dans ARCH-19 avec 13 tests, ARCH-12 avec 8 tests, ARCH-16 avec 7 tests, etc.) avec un adaptateur Vitest qui exécute une fonction de suite interne (ex. ARCH-10 qui valide 15 vérifications internes sous un seul wrapper Vitest `it(...)`).

### 4.2 Vérification TypeScript Lint (`npm run lint`)
- **Commande exécutée :** `npm run lint` (`tsc --noEmit`).
- **Résultat réellement observé :** **Sortie avec code 0, 0 erreur de typage** (après régularisation des imports de `openCvSketchDetector.ts` et du fichier de test ARCH-15).

### 4.3 Build de production (`npm run build`)
- **Commande exécutée :** `npm run build` (`vite build && esbuild server.ts ...`).
- **Résultat réellement observé :** **Sortie avec code 0, build réussi en ~27,8 s**.
  - Génération des assets Vite dans `dist/` (`dist/index.html`, bundles JS minifiés).
  - Génération du bundle serveur Node.js `dist/server.cjs` (23.5 Ko) via esbuild.

---

## 5. AUDIT D'ÉTAT DES COMPOSANTS MAJEURS DU CODEBASE

Les tailles exactes relevées par comptage de lignes (`wc -l`) dans l'arborescence sont :

1. **`src/pdi/isometric/engine/IsometrieModuleV48d.tsx` : 14 120 lignes** (~765 Ko)
   - Rôle : Moteur central de l'éditeur ISO, gestionnaire du canvas SVG interactif, reticule d'accrochage, inspection d'objets.
   - Allègement effectif : La topologie (ARCH-12), la projection (ARCH-13), le DXF (ARCH-14) et le bouton de rotation (ARCH-15) ont été déportés. Le fichier reste toutefois un monolithe majeur nécessitant des extractions ciblées continues.

2. **`src/components/Calculators.tsx` : 10 246 lignes** (~574 Ko)
   - Clarification : Aucun fichier `calculator.tsx` (au singulier) n'existe.
   - Rôle : Outils de calcul génie civil, dalles, massifs, pertes de charge et métrés de chantier.
   - Non concerné par l'éditeur isométrique de tuyauterie direct.

3. **`src/pdi/app/PdiUnifiedApp.tsx` : 2 008 lignes** (~103 Ko)
   - Shell unifié de navigation, gestion des onglets de projet, intégration sécurisée des sous-modules.

4. **`src/pdi/sketch/SketchToIsoModule.tsx` : 1 180 lignes** (~46 Ko)
   - Module de vectorisation assistée de croquis 2D. OpenCV WebAssembly (15,5 Mo) est chargé dynamiquement à la demande (lazy-import), ce qui préserve le temps d'amorce initial.

---

## 6. PÉRIMÈTRE DES FICHIERS ET MODIFICATIONS LOCALES

### 6.1 Fichiers modifiés au cours des travaux récents
- `src/pdi/isometric/ui/PdiRotationButton15.tsx` : Composant extrait lors d'ARCH-15.
- `src/pdi/isometric/tests/arch15UiModularizationTests.spec.ts` : Test d'existence d'ARCH-15.
- `src/pdi/isometric/engine/IsometrieModuleV48d.tsx` : Remplacement du composant in-file par l'import externe.
- `src/pdi/sketch/openCvSketchDetector.ts` : Régularisation des imports de configuration d'axes pour le typecheck.
- `docs/architecture/BASELINE-01_RECONCILIATION.md` : Document d'audit et de réconciliation.

### 6.2 État de `README.md`
- L'audit du fichier `README.md` confirme qu'il contient la présentation multi-domaines, la table de maturité normative (Section 2) et les instructions de build.
- Aucune modification n'a été apportée à `README.md` au cours de cette tâche de fix documentaire.

---

## 7. FEUILLE DE ROUTE STRATÉGIQUE RÉCONCILIÉE (15 AXES)

Afin d'éviter toute confusion entre intention et réalité technique, les 15 axes sont classés selon trois niveaux de maturité rigoureux :
- **[DÉMONTRÉ]** : Existence prouvée par des fichiers dédiés et couverte par des tests unitaires ou d'intégration exécutés.
- **[DÉCLARÉ EN CODE]** : Composants ou structures de données présents dans le code source / l'inventaire, mais dont le fonctionnement complet n'est pas couvert par un test automatisé direct.
- **[ROADMAP / À AUDITER]** : Fonctionnalités planifiées, déclarations d'intention ou études préalables nécessitant un audit dédié.

1. **Architecture modulaire & Réduction des monolithes :** **[DÉMONTRÉ / EN COURS]**
   - Extractions ARCH-12 (topologie), ARCH-13 (projection), ARCH-14 (DXF) et ARCH-15 (UI) effectives et vérifiées par tests.
   - Allègement continu requis sur `IsometrieModuleV48d.tsx` (14 120 lignes restantes).
2. **Sketch-to-Iso :** **[DÉMONTRÉ]**
   - Module `SketchToIsoModule.tsx` actif, configuration d'axes découplée (`sketchAxisConfig.ts`), chargement différé d'OpenCV vérifié au build.
3. **Dessin 2D et 3D :** **[DÉMONTRÉ / DÉCLARÉ EN CODE]**
   - Projection isométrique 3D démontrée par tests (`arch13IsoProjectionEngineTests.spec.ts`).
   - Outils CAO 2D (lignes, cercles, calques) présents dans `IsometrieModuleV48d.tsx` et `CadAutocadEngine.ts` mais restant à auditer unitairement.
4. **Enveloppes 3D, équipements et skids :** **[DÉCLARÉ EN CODE]**
   - Structures géométriques de boîtes d'encombrement (bounding boxes) et presets de skid présents dans l'état React de `IsometrieModuleV48d.tsx` ; validation comportementale non couverte par tests dédiés.
5. **Double écran, workspace et extensions :** **[ROADMAP]**
   - Prévu architecturalement dans les routes et les modules, non finalisé en production.
6. **Fiabilité des modèles et imports/exports :** **[DÉMONTRÉ]**
   - Sérialisation JSON V4.7.4 (round-trip), export SVG et export DXF validés par tests de non-régression (`arch14Fix01ReliabilityTests.spec.ts`, `arch14JsonCommandsTests.spec.ts`, `arch14DxfSerializationTests.spec.ts`).
7. **Normes ASME B31.3, B31.8 et B31.12/H₂ :** **[DÉMONTRÉ PARTIELLEMENT / À AUDITER]**
   - ASME B31.3 : Démontré pour les lookups dimensionnels et ratings B16.5.
   - ASME B31.8 : Formules de base testées, conformité d'ensemble non démontrée.
   - ASME B31.12 / H₂ : À auditer (aucune suite de test active dédiée).
8. **BOM/MTO et livrables industriels :** **[DÉMONTRÉ PARTIELLEMENT]**
   - Génération des tables matérielles (`materialRows`) et métrés cumulés couverte dans `IsoTopologyGraph.ts` et testée dans ARCH-12.
9. **Tests, CI et industrialisation :** **[DÉMONTRÉ]**
   - 29 tests Vitest passés avec succès ; workflow CI GitHub Actions documenté dans `.github/workflows/ci.yml`.
10. **Sécurité, isolation des projets et gestion des secrets :** **[DÉCLARÉ EN CODE]**
    - Architecture Firebase / PostgreSQL Cloud SQL présente côté serveur ; clés d'API protégées hors UI.
11. **Préparation du SaaS et commercialisation :** **[DÉCLARÉ EN CODE]**
    - Vues d'authentification (`PdiAuthPage.tsx`), modales de licence et profils utilisateurs présentes dans l'arborescence UI.
12. **Étude Paddle et Silkpay :** **[ROADMAP]**
    - Étude préalable pour passerelles de paiement internationales.
13. **Automatisation emails & webhooks (Render) :** **[ROADMAP]**
    - Architecture de déclenchement transactionnel backend à spécifier.
14. **Benchmarking, stratégie de coûts et pricing PME :** **[ROADMAP]**
    - Analyse économique et positionnement tarifaire.
15. **Phase 2 : Vision Orthogonal (photo réelle vers ISO) :** **[ROADMAP]**
    - Actuellement panneau de réservation de route (*Coming Soon*) dans `PdiUnifiedApp.tsx`.

---

## 8. RISQUES RÉSIDUELS ET RECOMMANDATION POUR LA SUITE

### 8.1 Risques résiduels
- **Couverture de tests UI sur ARCH-15 :** Le composant `PdiRotationButton15` n'a qu'un test d'existence. Il conviendra, lors d'une session de consolidation UI, d'ajouter des tests simulant les clics et le maintien prolongé.
- **Volume résiduel de `IsometrieModuleV48d.tsx` :** Avec 14 120 lignes, le composant nécessite de maintenir une discipline d'extraction unitaire et mesurée, sans réécriture globale risquant de briser l'éditeur interactif.

### 8.2 Recommandation pour la prochaine tâche
- Soumettre la balise **BASELINE-01 réconciliée** à la validation humaine.
- **Ne pas démarrer ARCH-16** avant cette validation formelle.
- La prochaine tâche d'ingénierie devra cibler une responsabilité d'interface strictement délimitée (ex. le panneau d'inspection des propriétés de calques 2D ou la barre de zoom/navigation du canevas) avec un audit préalable et des tests comportementaux adaptés.

---
*Fin du document BASELINE-01 réconcilié — Orthogonal PD&I Studio.*
