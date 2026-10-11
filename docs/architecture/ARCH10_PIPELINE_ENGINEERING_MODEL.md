# ARCH-10 — PIPELINE ENGINEERING MODEL

## 0. STATUT & RÉFÉRENCE

- **Identifiant** : ARCH-10
- **Module** : Pipeline Engineering Model (`PIPELINE` Domain — Layer A / `PRODUCT_CORE`)
- **Statut** : IMPLEMENTED (en attente d'audit utilisateur)
- **Socle amont** : ARCH-00 à ARCH-09, NORM-01 à NORM-14
- **Couche d'appartenance** : Couche A — Engineering (`PRODUCT_CORE` — ARCH-07 / ARCH-08)

---

## 1. OBJECTIF ET PÉRIMÈTRE

L'objectif d'**ARCH-10** est de fournir un modèle métier structuré, typé en TypeScript, immuable et validable de manière déterministe pour le domaine d'ingénierie `PIPELINE` (transport et distribution par canalisations), distinct du domaine `PIPING` (tuyauteries d'usines en intérieur de limites), tout en restant 100% compatible avec le modèle universel `PdiUniversalEntity` (ARCH-03 / ARCH-08) et le Multi-Code Resolver (ARCH-09).

### 1.1 Périmètre couvert
- Représentation d'un système de pipeline identifié (`PipelineSystem`), de ses nœuds de connexion (`PipelineNode`) et de ses tronçons physiques ou logiques (`PipelineSegment`).
- Représentation structurée des services et catégories de fluides déclarés (`PipelineServiceFluidDeclaration` : `NATURAL_GAS`, `HYDROGEN`, `NATURAL_GAS_HYDROGEN_BLEND`, `LIQUID_HYDROCARBON`, `MULTIPHASE`, `WATER`, `CO2`, `OTHER`).
- Représentation des grandeurs physiques avec unité explicite obligatoire (`PipelineExplicitQuantity<U>`), sans valeur par défaut arbitraire ni conversion silencieuse.
- Représentation déclarative du matériau (`PipelineDeclaredMaterial`) sans qualification normative automatique ni présomption de compatibilité hydrogène.
- Validation structurelle, relationnelle, physique et d'isolation des couches via un validateur déterministe sans mutation des entrées (`validatePipelineSystem`, `validatePipelineSegment`, `validatePipelineNode`).
- Analyse topologique non destructive (identification des nœuds isolés, des sous-réseaux déconnectés et des boucles maillées sans rejet arbitraire).

### 1.2 Hors périmètre strict (Non implémenté dans ARCH-10)
- **Aucun calcul de dimensionnement** : aucun calcul `ASME-B31.8`, `ASME-B31.12`, `ASME-B31.4` ou `ISO-13623` n'est implémenté ni activé (leurs statuts dans `DESIGN_CODE_CALCULATION_REGISTRY` demeurent strictement `NOT_IMPLEMENTED`).
- **Aucun calcul de reconversion GN/H₂, hydraulique ou thermodynamique**.
- **Aucune qualification normative de matériau ou de compatibilité H₂**.
- **Aucune interface UI, 2D, 3D ou SIG d'alignement géographique**.
- **Aucune donnée commerciale (prix, coûts, devises) ni logique SaaS/licences**.

---

## 2. CONTRATS MÉTIER IMPLÉMENTÉS

### 2.1 `PipelineSystem` (`src/pdi/engineering/types/pipelineEngineeringModelTypes.ts`)
Représente un réseau ou système de pipelines identifié :
- `id: string` : identifiant stable du système.
- `name: string` : libellé du système.
- `engineeringDomain: EngineeringDomainId` : obligatoirement `"PIPELINE"`.
- `projectId?: string` : référence optionnelle au projet parent.
- `service?: PipelineServiceFluidDeclaration` : fluide/service déclaré au niveau système (jamais déduit du nom du système ou du projet).
- `nodes: readonly PipelineNode[]` : nœuds du système.
- `segments: readonly PipelineSegment[]` : tronçons du système.
- `traceabilityRefs?: PipelineTraceabilityRefs` : références déclaratives aux documents sources (`sourceDocumentIds`), preuves (`evidenceIds`), spécification ou code de conception (`designCodeRef`).
- `structuralValidationState?: "UNVALIDATED" | "STRUCTURALLY_VALID" | "STRUCTURALLY_INVALID"`.

### 2.2 `PipelineSegment`
Représente un tronçon physique ou logique reliant deux nœuds distincts :
- `id: string`, `systemId: string`, `name: string`.
- `startNodeId: string`, `endNodeId: string` : références explicites aux nœuds de départ et d'arrivée.
- `length?: PipelineExplicitQuantity<PipelineLengthUnit>` : longueur finie strictement positive avec unité explicite (`"m" | "km" | "ft" | "mi"`).
- `dimensions?: PipelineSegmentDimensions` : `nominalDiameter`, `outerDiameter`, `wallThickness`, `corrosionAllowance` avec unité explicite (`"mm" | "in"`), et `schedule`.
- `material?: PipelineDeclaredMaterial` : matériau déclaré (`materialId`, `standardCode`, `grade`, `designation`, `productSpecificationLevel`) avec `normativeQualificationStatus: "NOT_EVALUATED_IN_ENGINEERING_MODEL"` et `fluidCompatibilityStatus: "NOT_EVALUATED_IN_ENGINEERING_MODEL"`.
- `service?: PipelineServiceFluidDeclaration` : service déclaré au niveau du tronçon (`verificationState: "DECLARED_UNVERIFIED"`).
- `domainAttributes?: PipelineDomainAttributes` : réutilisation directe du contrat ARCH-08 (`kilometerPointStart`, `kilometerPointEnd`, `burialDepthMeters`, `classLocation`, `designFactorF`, `crossingType`, `cathodicProtectionZone`).
- `universalEntityId?: string` & `traceabilityRefs?: PipelineTraceabilityRefs`.

### 2.3 `PipelineNode`
Représente un point de connexion du réseau (`TERMINAL_INLET`, `TERMINAL_OUTLET`, `JUNCTION`, `BLOCK_VALVE_STATION`, `COMPRESSOR_STATION`, `PUMP_STATION`, `METERING_REGULATING_STATION`, `PIG_TRAP_LAUNCHER`, `PIG_TRAP_RECEIVER`, `FIELD_BEND`, `TRANSITION_POINT`, `GENERIC_NODE`) :
- `id: string`, `systemId: string`, `name: string`, `kind?: PipelineNodeKind`.
- `connectedSegmentIds?: readonly string[]` : références optionnelles aux tronçons connectés (contrôlées en cohérence bidirectionnelle avec `startNodeId` / `endNodeId`).
- `stationPoint?: PipelineExplicitQuantity<PipelineLengthUnit>` : point kilométrique déclaré avec unité explicite.
- `coordinates?: PipelineNodeCoordinates` : coordonnées spatiales locales optionnelles (`x`, `y`, `z?`, `elevation?`, `unit`).

### 2.4 Service et Fluide (`PipelineServiceFluidDeclaration`)
Catégories strictement distinguées et contrôlées en cohérence avec `hydrogenMoleFractionPercent` :
- `"NATURAL_GAS"` (Gaz naturel : `hydrogenMoleFractionPercent` omis ou `=== 0` ; toute valeur `> 0` est rejetée).
- `"HYDROGEN"` (Hydrogène pur : `hydrogenMoleFractionPercent` omis ou `=== 100` ; toute valeur `< 100` est rejetée).
- `"NATURAL_GAS_HYDROGEN_BLEND"` (Mélange GN/H₂ : `hydrogenMoleFractionPercent` **obligatoire** et appartenant strictement à `]0, 100[`).
- `"LIQUID_HYDROCARBON"`, `"WATER"`, `"CO2"` (`hydrogenMoleFractionPercent` omis ou `=== 0` ; toute valeur `> 0` est rejetée).
- `"MULTIPHASE"`, `"OTHER"` (`hydrogenMoleFractionPercent` optionnel dans `[0, 100]`).

---

## 3. RELATIONS, TOPOLOGIE ET RÈGLES DE VALIDATION

Le validateur `validatePipelineSystem` (`src/pdi/engineering/validators/pipelineEngineeringModelValidator.ts`) effectue les contrôles déterministes suivants sans jamais modifier les objets reçus :

1. **Champs obligatoires et domaine** :
   - Vérifie `system.id`, `system.name`, `system.engineeringDomain === "PIPELINE"`, `node.id`, `node.name`, `node.systemId`, `segment.id`, `segment.name`, `segment.systemId`, `segment.startNodeId`, `segment.endNodeId`.
2. **Unicité des identifiants dans le périmètre système** :
   - Détecte les doublons de nœuds (`DUPLICATE_NODE_ID`), les doublons de tronçons (`DUPLICATE_SEGMENT_ID`) ainsi que toute collision d'identifiant entre un nœud et un tronçon.
3. **Cohérence inter-systèmes** :
   - Rejette tout nœud (`NODE_SYSTEM_ID_MISMATCH`) ou tronçon (`SEGMENT_SYSTEM_ID_MISMATCH`) dont le `systemId` diffère de `system.id`.
4. **Intégrité référentielle nœuds ↔ tronçons** :
   - Rejette tout tronçon référençant un `startNodeId` inexistant (`SEGMENT_REFERENCES_UNKNOWN_START_NODE`) ou un `endNodeId` inexistant (`SEGMENT_REFERENCES_UNKNOWN_END_NODE`).
   - Rejette tout tronçon auto-bouclé sur un même nœud (`startNodeId === endNodeId` → `SEGMENT_SELF_LOOP_NOT_ALLOWED`).
   - Rejette tout nœud dont `connectedSegmentIds` référence un tronçon inexistant (`NODE_REFERENCES_UNKNOWN_SEGMENT`), contient des références de tronçons dupliquées, ou présente une incohérence d'incidence avec les tronçons connectés (`NODE_SEGMENT_INCIDENCE_MISMATCH`).
5. **Contrôle des grandeurs physiques et unités explicites** :
   - Rejette toute valeur non finie (`NaN`, `Infinity`, `-Infinity` → `NON_FINITE_NUMERIC_VALUE`).
   - Rejette toute longueur de tronçon `<= 0` (`NEGATIVE_OR_ZERO_SEGMENT_LENGTH`).
   - Rejette toute grandeur physique sans unité explicite (`MISSING_EXPLICIT_PHYSICAL_UNIT`) ou avec unité inconnue (`UNSUPPORTED_PHYSICAL_UNIT`).
   - Rejette toute incohérence géométrique directe (`2 * wallThickness >= outerDiameter` dans la même unité → `INVALID_PHYSICAL_QUANTITY`).
6. **Contrôle anti-auto-qualification et isolation des couches** :
   - Rejette toute tentative de marquer une donnée déclarée comme `VERIFIED` dans le modèle métier (`DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM`).
   - Rejette toute tentative de marquer un matériau comme normativement qualifié ou compatible hydrogène dans le modèle métier (`DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION`).
   - Rejette tout champ commercial/prix (`DISALLOWED_COMMERCIAL_FIELD_IN_ENGINEERING_MODEL`) et toute identité de client historique (`DISALLOWED_CLIENT_IDENTITY_IN_ENGINEERING_MODEL`).
7. **Politique topologique explicite (Nœuds isolés, sous-réseaux déconnectés, boucles)** :
   - Les **nœuds isolés** (ex: futurs points de piquage en cours d'étude), les **sous-réseaux déconnectés** (phasage de construction) et les **boucles fermées** (réseaux maillés ou conduites parallèles doublées) sont **autorisés** structurellement (`valid: true`) et documentés de manière déterministe dans `topologySummary` (`isolatedNodeIds`, `connectedComponentCount`, `hasLoops`) et `topologyNotices` (`ISOLATED_NODE_DETECTED`, `DISCONNECTED_SUBNETWORKS_DETECTED`, `LOOP_TOPOLOGY_DETECTED`, `EMPTY_PIPELINE_NETWORK`).

---

## 4. FICHIERS CRÉÉS ET MODIFIÉS

| Fichier | Action | Rôle |
| :--- | :--- | :--- |
| `src/pdi/engineering/types/pipelineEngineeringModelTypes.ts` | Créé | Contrats TypeScript immuables (`PipelineSystem`, `PipelineSegment`, `PipelineNode`, `PipelineServiceFluidDeclaration`, `PipelineDeclaredMaterial`, `PipelineSegmentDimensions`, résultats et codes d'erreurs). |
| `src/pdi/engineering/validators/pipelineEngineeringModelValidator.ts` | Créé | Validateur déterministe et analyseur topologique sans effet de bord (`validatePipelineSystem`, `validatePipelineSegment`, `validatePipelineNode`). |
| `src/pdi/engineering/model/pipelineEngineeringModel.ts` | Créé | Constructeurs immuables (`createPipelineSystem`, `createPipelineSegment`, `createPipelineNode`), requêtes (`getIncidentSegmentsForNode`, `resolveEffectiveSegmentService`) et adaptateur `attachPipelineSegmentToUniversalEntity`. |
| `src/pdi/engineering/index.ts` | Modifié | Export public des types, constructeurs et validateurs ARCH-10. |
| `src/pdi/normative/tests/arch10PipelineEngineeringModelTests.ts` | Créé | Suite de tests canonique ARCH-10 (15 scénarios). |
| `src/pdi/normative/tests/arch10PipelineEngineeringModelTests.spec.ts` | Créé | Adaptateur Vitest pour l'exécution automatique via `npm test`. |
| `src/pdi/normative/index.ts` | Modifié | Export public de `arch10PipelineEngineeringModelTests`. |
| `docs/architecture/ARCH10_PIPELINE_ENGINEERING_MODEL.md` | Créé | Documentation architecturale fidèle au code livré. |

---

## 5. COMPATIBILITÉ AVEC ARCH-08 ET ARCH-09

- **ARCH-08 (`EngineeringDomainRegistry`, `PIPELINE_DOMAIN_DESCRIPTOR`, `PdiUniversalEntity`)** :
  - `PipelineSystem.engineeringDomain` utilise `EngineeringDomainId` (`"PIPELINE"`).
  - `PipelineSegment.domainAttributes` réutilise `PipelineDomainAttributes` défini en ARCH-08.
  - `attachPipelineSegmentToUniversalEntity` enrichit `PdiUniversalEntity` sans créer de `PipelineUniversalEntity` concurrent.
- **ARCH-09 (`MultiCodeResolver` & `DESIGN_CODE_CALCULATION_REGISTRY`)** :
  - Aucun statut de code de conception n'a été modifié (`ASME-B31.4`, `ASME-B31.8`, `ASME-B31.12`, `ISO-13623` restent `NOT_IMPLEMENTED`).
  - `MultiCodeResolver` conserve un comportement strictement identique.

---

## 6. TESTS ET RÉSULTATS

La suite `src/pdi/normative/tests/arch10PipelineEngineeringModelTests.spec.ts` couvre 17 scénarios :

| ID Test | Scénario vérifié |
| :--- | :--- |
| **TEST 01** | Création et validation d'un `PipelineSystem` valide avec nœuds, tronçon, fluide et traçabilité. |
| **TEST 02** | Création et validation d'un `PipelineSegment` valide en unités impériales sans conversion silencieuse. |
| **TEST 03** | Validation d'un réseau complexe comportant plusieurs nœuds, tronçons, boucle maillée et nœud isolé. |
| **TEST 04** | Rejet des identifiants dupliqués (`DUPLICATE_NODE_ID`, `DUPLICATE_SEGMENT_ID`, collision nœud/tronçon). |
| **TEST 05** | Rejet des références à un nœud de départ ou d'arrivée inexistant. |
| **TEST 06** | Rejet d'une référence à un tronçon inexistant et d'une incohérence d'incidence nœud ↔ tronçon. |
| **TEST 07** | Rejet d'une relation inter-systèmes incohérente et d'une auto-boucle sur un tronçon. |
| **TEST 08** | Rejet des longueurs négatives ou nulles, de `NaN`/`Infinity`, des unités absentes et de `2 * wallThickness >= outerDiameter`. |
| **TEST 09** | Traitement explicite des champs facultatifs sans valeur par défaut arbitraire ni déduction du fluide depuis le nom du projet. |
| **TEST 10** | Vérification par snapshot JSON que le validateur ne modifie jamais les objets d'entrée. |
| **TEST 11** | Distinction GN / H₂ / mélange GN-H₂ / hydrocarbures liquides et rejet de toute auto-qualification matériau ou compatibilité H₂. |
| **TEST 12** | Non-régression complète du registre de domaines (`ARCH-08`) et du Multi-Code Resolver (`ARCH-09`). |
| **TEST 13** | Vérification qu'aucun calcul `ASME-B31.8`, `ASME-B31.12`, `ASME-B31.4` ou `ISO-13623` n'est déclaré disponible (`NOT_IMPLEMENTED`). |
| **TEST 14** | Rejet des champs commerciaux (`unitPrice`, `currencyCode`) et des identités de clients historiques dans le modèle Pipeline. |
| **TEST 15** | Projection non destructive vers `PdiUniversalEntity` et maintien de l'interdiction de `PipelineUniversalEntity`. |
| **TEST 16** | **[ARCH-10-FIX-01 / FIX-01]** Immutabilité profonde de `createPipelineSystem()` (clonage et gel profond des nœuds, tronçons et sous-structures sans muter les entrées). |
| **TEST 17** | **[ARCH-10-FIX-01 / FIX-02 & FIX-03]** Cohérence stricte `fluidCategory` vs `hydrogenMoleFractionPercent` et rejet des doublons dans `connectedSegmentIds`. |

---

## 7. ÉTAPES FUTURES (NON RÉALISÉES DANS ARCH-10)

Les évolutions suivantes ne sont **pas implémentées** dans ARCH-10 et feront l'objet de tâches ultérieures dédiées :
- Implémentation de règles et formules normatives vérifiées pour `ASME-B31.4`, `ASME-B31.8`, `ASME-B31.12` ou `ISO-13623` dans la Couche B (Normative Engine) à partir de sources documentaires licenciées et vérifiées.
- Qualification de compatibilité hydrogène et évaluation de reconversion GN/H₂ avec preuves normatives.
- Calculs hydrauliques, profils d'élévation et représentation graphique 2D/3D d'alignement.
