# ARCH-09 — MULTI-CODE RESOLVER

## 0. STATUT & RÉFÉRENCE

- **Identifiant** : ARCH-09 (finalisé par ARCH-09-FIX-01)
- **Module** : Multi-Code Resolver (Normative Engine)
- **Statut** : IMPLEMENTED (en attente de validation finale CI GitHub)
- **Socle amont** : ARCH-00 à ARCH-08 (LOCKED), NORM-01 à NORM-14
- **Couche d'appartenance** : `PRODUCT_CORE` / `NORMATIVE_ENGINE`

---

## 1. OBJECTIF ET PÉRIMÈTRE

Le **Multi-Code Resolver** (`ARCH-09`) fournit un mécanisme déterministe, typé, immuable et sans heuristique permettant d'identifier le code de conception (`DesignCodeId` de type `DESIGN_CODE`) applicable à un projet, un domaine d'ingénierie ou un contexte structuré, et d'évaluer sa disponibilité réelle pour le calcul sans confondre les différentes étapes normatives.

### 1.1 Périmètre couvert par ARCH-09
- Validation structurelle et anti-heuristique du contexte d'entrée (`MultiCodeResolutionContext`).
- Collecte déterministe des codes candidats exclusivement à partir de sources structurées (code explicite, spécification de tuyauterie, référence normative projet, candidats explicites ou descripteur de domaine ARCH-08).
- Vérification de l'existence dans `PDI_STANDARDS_REGISTRY`, de la nature `DESIGN_CODE` du standard et de la compatibilité avec le domaine d'ingénierie (`PIPING`, `PIPELINE`, `PACKAGE`, `EQUIPMENT`).
- Détection explicite des conflits et ambiguïtés (`AMBIGUOUS`) sans aucun arbitrage silencieux.
- Rapport sur l'édition normative et la vérification des preuves associées via `NormativeEvidenceResolver` (`DesignCodeEditionEvidenceReport`).
- Rapport sur la qualification normative des formules et la disponibilité réelle d'une capacité de calcul dans `DESIGN_CODE_CALCULATION_REGISTRY` (`DesignCodeCalculationAvailabilityReport`).

### 1.2 Hors périmètre (Invariants stricts)
- **Aucun second référentiel concurrent** : le resolver ne duplique ni `PDI_STANDARDS_REGISTRY`, ni `DESIGN_CODE_CALCULATION_REGISTRY`, ni `defaultEngineeringDomainRegistry`.
- **Aucune exécution numérique de calcul** : le resolver n'exécute jamais de calcul d'épaisseur, de contrainte ou de pression admissible (l'exécution effective demeure exclusivement réservée à `executeEngineeringCalculation` dans `designCodeEngine.ts`).
- **Aucune promotion normative implicite** : les statuts des codes dans `designCodeRegistry.ts` restent strictement inchangés.
- **Zéro sélection heuristique** : aucune déduction à partir d'un nom de client, d'une chaîne de texte libre ou d'un token heuristique.

---

## 2. ARCHITECTURE ET FICHIERS CONCERNÉS

### 2.1 Fichiers créés / concernés par ARCH-09

| Fichier | Rôle architectural |
| :--- | :--- |
| `src/pdi/normative/types/multiCodeResolverTypes.ts` | Contrats de types immuables : `MultiCodeResolutionContext`, `MultiCodeResolutionResult`, `MultiCodeResolutionStatus`, `DesignCodeResolutionSource`, `DesignCodeCandidateTrace`, `DesignCodeEditionEvidenceReport`, `DesignCodeCalculationAvailabilityReport`. |
| `src/pdi/normative/validators/multiCodeResolverValidator.ts` | Validateur structurel et anti-heuristique (`validateMultiCodeResolutionContext`, `FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS`). |
| `src/pdi/normative/engine/multiCodeResolver.ts` | Moteur de résolution déterministe (`MultiCodeResolver`, `defaultMultiCodeResolver`, `resolveApplicableDesignCode`). |
| `src/pdi/normative/tests/arch09MultiCodeResolverTests.ts` | Suite de tests canonique ARCH-09 (15 scénarios de test couvrant résolution, conflits, preuves, statuts et non-régression). |
| `src/pdi/normative/tests/arch09MultiCodeResolverTests.spec.ts` | Adaptateur Vitest exécutant `runArch09MultiCodeResolverTests()`. |
| `src/pdi/normative/index.ts` | Réexport public des types, validateur, moteur et tests ARCH-09. |

### 2.2 Référentiels existants réutilisés (sans duplication)

| Fichier existant | Utilisation par le Multi-Code Resolver |
| :--- | :--- |
| `src/pdi/engineering/registry/engineeringDomainRegistry.ts` | Lecture des descripteurs de domaines (`PIPING`, `PIPELINE`, `PACKAGE`, `EQUIPMENT`) et de leurs références `defaultNormativeDesignCodeRefs` (ARCH-08). |
| `src/pdi/normative/registry/standardsRegistry.ts` | Vérification de l'existence du standard dans `PDI_STANDARDS_REGISTRY` et contrôle que `standardType === "DESIGN_CODE"` (NORM-01). |
| `src/pdi/normative/registry/designCodeRegistry.ts` | Lecture de `DESIGN_CODE_CALCULATION_REGISTRY` via `getDesignCodeCalculationEntry` pour connaître le statut réel (`PARTIAL`, `NOT_IMPLEMENTED`), les types de calculs supportés et les références de formules (NORM-08). |
| `src/pdi/normative/validators/designCodeValidator.ts` | Réutilisation de `validateDesignCodeFormulaReference`, `isFormulaQualified`, `isEngineeringCalculationType`, `isEngineeringUnitSystem` (NORM-08). |
| `src/pdi/normative/registry/pipingSpecRegistry.ts` | Résolution structurée d'une spécification de tuyauterie via `getPipingSpecById` / `getPipingSpecByCode` (ou `specLookup` injecté). |
| `src/pdi/normative/registry/normativeEvidenceResolver.ts` | Vérification des preuves documentaires via `defaultEvidenceResolver.resolveEvidenceSet(evidenceIds)` (NORM-13). |

---

## 3. CONTRAT D'ENTRÉE : `MultiCodeResolutionContext`

Défini dans `src/pdi/normative/types/multiCodeResolverTypes.ts` :

```ts
export interface MultiCodeResolutionContext {
  readonly engineeringDomain?: EngineeringDomainId;
  readonly explicitDesignCodeId?: DesignCodeId;
  readonly pipingSpecId?: string;
  readonly projectDefaultDesignCodeId?: DesignCodeId;
  readonly candidateDesignCodeIds?: readonly DesignCodeId[];
  readonly requestedEdition?: StandardEdition;
  readonly requestedCalculationType?: EngineeringCalculationType;
  readonly unitSystem?: EngineeringUnitSystem;
  readonly evidenceIds?: readonly string[];
  readonly enforceDomainCompatibility?: boolean;
}
```

### Règles de validation (`validateMultiCodeResolutionContext`)
1. **Objet valide requis** : Rejette `null`, les primitifs et les tableaux (`INVALID_CONTEXT_OBJECT`).
2. **Interdiction des champs heuristiques ou liés au client** : Tout champ présent dans `FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS` (`clientName`, `client`, `companyName`, `organizationName`, `customerName`, `freeText`, `freeTextHint`, `heuristicHint`, `queryText`, `prompt`, `naturalLanguageQuery`, `descriptionHint`, `projectDescription`) provoque le rejet immédiat avec `DISALLOWED_CLIENT_NAME_INFLUENCE` ou `DISALLOWED_HEURISTIC_OR_FREE_TEXT_INPUT`.
3. **Interdiction des tokens heuristiques et chaînes libres dans les identifiants** : Les champs `explicitDesignCodeId`, `projectDefaultDesignCodeId`, `pipingSpecId`, `candidateDesignCodeIds` et `evidenceIds` sont contrôlés contre `isDisallowedTokenHeuristic` (ex: `MAT_CS_*`), contre les espaces/phrases libres et contre `FORBIDDEN_HISTORICAL_CLIENT_PATTERNS`.
4. **Validation des énumérations et formats** :
   - `engineeringDomain` : doit appartenir à `"PIPING" | "PIPELINE" | "PACKAGE" | "EQUIPMENT"`.
   - `requestedCalculationType` : validé par `isEngineeringCalculationType`.
   - `unitSystem` : validé par `isEngineeringUnitSystem` (`"SI"` ou `"US_CUSTOMARY"`).
   - `requestedEdition.year` : s'il est fourni, doit être une chaîne à 4 chiffres (`^\d{4}$`).

---

## 4. RÉSULTATS POSSIBLES (`MultiCodeResolutionStatus`)

Le resolver retourne un objet immuable (`Object.freeze`) de type `MultiCodeResolutionResult` dont le champ `status` prend exactement l'une des 5 valeurs suivantes :

| Statut (`MultiCodeResolutionStatus`) | Condition de déclenchement exacte dans le code | `resolvedDesignCodeId` | `isUsableForCalculation` |
| :--- | :--- | :--- | :--- |
| **`RESOLVED`** | Un code candidat unique a été identifié sans conflit entre sources structurées, existe dans `PDI_STANDARDS_REGISTRY`, possède `standardType === "DESIGN_CODE"`, et est compatible avec le domaine d'ingénierie déclaré. | Défini (`DesignCodeId`) | `true` **uniquement** si la capacité de calcul demandée a le statut `AVAILABLE` ; `false` sinon. |
| **`AMBIGUOUS`** | Plusieurs codes candidats distincts sont en compétition (conflit entre `explicitDesignCodeId`, `pipingSpecId`, `projectDefaultDesignCodeId`, plusieurs `candidateDesignCodeIds`, ou domaine seul référençant plusieurs codes sans sélection explicite). | `undefined` | `false` |
| **`INSUFFICIENT_DATA`** | Le contexte est syntaxiquement valide mais aucune source structurée ne fournit de code candidat (ex: contexte `{}` ou `pipingSpecId` introuvable sans autre source). | `undefined` | `false` |
| **`UNSUPPORTED_CODE`** | Le ou les candidats identifiés sont absents de `PDI_STANDARDS_REGISTRY` (ex: `ASME-B31.1` ou code inconnu), ou ne sont pas de type `DESIGN_CODE` (ex: `ASME-B16.5`, `ASME-B36.10M`, `API-5L`, `API-6D`), ou ne sont pas déclarés dans le domaine d'ingénierie lorsque `enforceDomainCompatibility` est actif (ex: `ASME-B31.8` dans `EQUIPMENT`). | `undefined` | `false` |
| **`INVALID_CONTEXT`** | `validateMultiCodeResolutionContext(context)` échoue (contexte non-objet, domaine invalide, système d'unités invalide, champ client, texte libre ou token heuristique interdit). | `undefined` | `false` |

---

## 5. SOURCES STRUCTURÉES ET RÈGLES DE RÉSOLUTION / GESTION DES CONFLITS

### 5.1 Sources structurées (`DesignCodeResolutionSource`)
Le resolver identifie les codes candidats uniquement à partir des sources suivantes :
1. **`EXPLICIT_DESIGN_CODE`** : champ `context.explicitDesignCodeId`.
2. **`PIPING_SPECIFICATION`** : champ `designCodeId` d'une `PipingSpecification` résolue à partir de `context.pipingSpecId` via le registre de spécifications ou `specLookup`.
3. **`PROJECT_NORMATIVE_REF`** : champ `context.projectDefaultDesignCodeId` et/ou éléments de `context.candidateDesignCodeIds`.
4. **`DOMAIN_SINGLE_REGISTERED_CANDIDATE`** : références `defaultNormativeDesignCodeRefs` du descripteur de domaine (`EngineeringDomainDescriptor`), inspectées **uniquement** si aucune sélection directe (`explicitDesignCodeId`, `pipingSpecId` valide, `projectDefaultDesignCodeId`, `candidateDesignCodeIds`) n'est présente dans le contexte.
5. **`NONE`** : utilisé lorsque aucun code n'est résolu (`INVALID_CONTEXT`, `INSUFFICIENT_DATA`, `AMBIGUOUS`, `UNSUPPORTED_CODE`).

### 5.2 Traitement des conflits et interdiction d'arbitrage silencieux
- **Concordance unanime** : Si plusieurs sources structurées sont fournies (ex: `explicitDesignCodeId: "ASME-B31.3"` et `pipingSpecId` pointant aussi sur `"ASME-B31.3"`), `activeAuthoritativeSelections.size === 1` et le code est résolu sans conflit (`RESOLVED`). La source primaire rapportée suit l'ordre de traçabilité `EXPLICIT_DESIGN_CODE` > `PIPING_SPECIFICATION` > `PROJECT_NORMATIVE_REF` > `DOMAIN_SINGLE_REGISTERED_CANDIDATE`.
- **Conflit entre sources explicites** : Dès que deux sources structurées désignent des codes différents (`activeAuthoritativeSelections.size > 1`), le resolver refuse tout arbitrage ou écrasement silencieux et retourne **`AMBIGUOUS`** avec les codes diagnostics précis :
  - `CONFLICT_EXPLICIT_VS_PIPING_SPEC`
  - `CONFLICT_EXPLICIT_VS_PROJECT_REF`
  - `CONFLICT_PIPING_SPEC_VS_PROJECT_REF`
  - `MULTIPLE_CANDIDATE_CODES_UNDISCRIMINATED`
  - `AMBIGUOUS_DESIGN_CODE_CANDIDATES`
- **Domaine fourni seul** : Tous les domaines enregistrés dans ARCH-08 déclarent plusieurs codes possibles dans `defaultNormativeDesignCodeRefs` :
  - `PIPING` : `["ASME-B31.3", "EN-13480", "ASME-B31.1"]`
  - `PIPELINE` : `["ASME-B31.4", "ASME-B31.8", "ASME-B31.12", "ISO-13623"]`
  - `PACKAGE` : `["ASME-B31.3", "EN-13480"]`
  - `EQUIPMENT` : `["ASME-B31.3", "EN-13480"]`
  Lorsque seul `engineeringDomain` est fourni sans sélection explicite, le resolver refuse de sélectionner `defaultNormativeDesignCodeRefs[0]` par défaut et retourne **`AMBIGUOUS`** avec le diagnostic `AMBIGUOUS_DOMAIN_MULTIPLE_CODES`.

---

## 6. SÉPARATION STRICTE DES 5 NIVEAUX NORMATIFS

Le code de `MultiCodeResolver` matérialise la séparation étanche entre les 5 niveaux exigés par ARCH-09 :

| Niveau | Responsabilité | Implémentation et champs associés dans `MultiCodeResolutionResult` |
| :--- | :--- | :--- |
| **1. Identification du code applicable** | Déterminer quel `DesignCodeId` unique s'applique au contexte structuré. | `status` (`RESOLVED`, `AMBIGUOUS`, `INSUFFICIENT_DATA`, `UNSUPPORTED_CODE`, `INVALID_CONTEXT`), `resolvedDesignCodeId`, `resolvedStandard`, `resolutionSource`, `candidateTraces`. |
| **2. Vérification de l'édition et de ses preuves** | Déterminer l'édition effective et vérifier si des preuves documentaires `NormativeEvidence` de statut `VERIFIED` couvrent ce standard et cette édition. | `editionReport` (`effectiveEdition`, `standardRegistryEdition`, `formulaEditions`, `editionVerificationStatus`: `"VERIFIED" \| "UNVERIFIED" \| "MISSING_EDITION"`, `verifiedEvidenceIds`). **Règle** : une édition présente dans `PDI_STANDARDS_REGISTRY` sans preuve `NormativeEvidence` `VERIFIED` associée reste `UNVERIFIED`. |
| **3. Qualification normative** | Vérifier si les références de formules enregistrées pour ce code possèdent clause, édition, source et statut `VERIFIED`/`LICENSED` (`validateDesignCodeFormulaReference` + `isFormulaQualified`). | `calculationAvailability.qualificationStatus` (`"QUALIFIED" \| "PARTIALLY_QUALIFIED" \| "UNVERIFIED" \| "NOT_QUALIFIED"`) et `calculationAvailability.matchedFormulaReference`. |
| **4. Disponibilité réelle des calculs** | Vérifier si le code résolu implémente réellement `requestedCalculationType` dans `DESIGN_CODE_CALCULATION_REGISTRY` pour l'édition et le système d'unités demandés. | `implementationStatus` (`DesignCodeSupportStatus`), `isUsableForCalculation`, et `calculationAvailability.availabilityStatus` (`"AVAILABLE" \| "NOT_IMPLEMENTED" \| "EDITION_MISMATCH" \| "UNVERIFIED_UNIT_SYSTEM" \| "FORMULA_UNVERIFIED" \| "NOT_EVALUATED" \| "CODE_NOT_RESOLVED"`). |
| **5. Exécution d'un calcul** | Évaluer numériquement une équation d'ingénierie sur des entrées physiques vérifiées. | **Jamais exécutée dans `MultiCodeResolver`**. Réservée exclusivement à `executeEngineeringCalculation` dans `src/pdi/normative/engine/designCodeEngine.ts`. |

> **Conséquence fondamentale** : Un code tel que `ASME-B31.8` dans le domaine `PIPELINE` ou `EN-13480` dans le domaine `PIPING` est légitimement identifié (`status: "RESOLVED"`), mais le resolver indique simultanément `implementationStatus: "NOT_IMPLEMENTED"`, `calculationAvailability.availabilityStatus: "NOT_IMPLEMENTED"` et `isUsableForCalculation: false`.

---

## 7. STATUTS DE CALCUL RÉELLEMENT DÉCLARÉS DANS `designCodeRegistry.ts`

Conformément à `src/pdi/normative/registry/designCodeRegistry.ts` (`DESIGN_CODE_CALCULATION_REGISTRY`), l'état exact des codes de conception dans le repository est le suivant :

| `DesignCodeId` | Statut (`DesignCodeSupportStatus`) | Calculs supportés (`supportedCalculationTypes`) | Formules qualifiées (`formulaReferences`) | Conditions d'utilisabilité (`isUsableForCalculation: true`) |
| :--- | :--- | :--- | :--- | :--- |
| **`ASME-B31.3`** | **`PARTIAL`** | `["PRESSURE_WALL_THICKNESS"]` | `NORM-08-F01-ASME-B31.3-2024-PRESSURE-WALL-THICKNESS` — Clause `para. 304.1.2(a) Eq. (3a) / Eq. (3b)`, Édition `2024`, Statut `VERIFIED`, Régime `THIN_WALL`, Unités `SI` (`MPa`, `mm`, `C`). | `requestedCalculationType === "PRESSURE_WALL_THICKNESS"`, édition `2024` (ou non contradictoire), `unitSystem === "SI"` (ou non contradictoire). Tout autre calcul (`HOOP_STRESS`, `ALLOWABLE_PRESSURE`, etc.), édition (`2018`) ou système d'unités (`US_CUSTOMARY`) retourne `isUsableForCalculation: false`. |
| **`ASME-B31.4`** | **`NOT_IMPLEMENTED`** | `[]` | `[]` | Toujours `false` (`availabilityStatus: "NOT_IMPLEMENTED"`). |
| **`ASME-B31.8`** | **`NOT_IMPLEMENTED`** | `[]` | `[]` | Toujours `false` (`availabilityStatus: "NOT_IMPLEMENTED"`). |
| **`ASME-B31.12`** | **`NOT_IMPLEMENTED`** | `[]` | `[]` | Toujours `false` (`availabilityStatus: "NOT_IMPLEMENTED"`). |
| **`EN-13480`** | **`NOT_IMPLEMENTED`** | `[]` | `[]` | Toujours `false` (`availabilityStatus: "NOT_IMPLEMENTED"`). |
| **`ISO-13623`** | **`NOT_IMPLEMENTED`** | `[]` | `[]` | Toujours `false` (`availabilityStatus: "NOT_IMPLEMENTED"`). |

Note : `ASME-B31.1` est mentionné comme référence dans `pipingDomain.ts` (`defaultNormativeDesignCodeRefs`), mais n'est enregistré ni dans `PDI_STANDARDS_REGISTRY` ni dans `DESIGN_CODE_CALCULATION_REGISTRY`. Toute tentative de résolution explicite de `ASME-B31.1` retourne donc `status: "UNSUPPORTED_CODE"` avec le diagnostic `DESIGN_CODE_NOT_FOUND`.

---

## 8. TESTS ET LIMITES CONNUES

### 8.1 Couverture de tests (`src/pdi/normative/tests/arch09MultiCodeResolverTests.ts`)
La suite de tests est exécutée par Vitest via `src/pdi/normative/tests/arch09MultiCodeResolverTests.spec.ts` et couvre 15 scénarios vérifiables :

| ID Test | Scénario vérifié |
| :--- | :--- |
| **TEST 01** | Préservation stricte des statuts réels dans `DESIGN_CODE_CALCULATION_REGISTRY` (`ASME-B31.3` = `PARTIAL`, `ASME-B31.4` / `B31.8` / `B31.12` / `EN-13480` / `ISO-13623` = `NOT_IMPLEMENTED`). |
| **TEST 02** | Résolution nominale de `ASME-B31.3` dans `PIPING` avec `PRESSURE_WALL_THICKNESS` (édition `2024`, `SI`) -> `RESOLVED`, `AVAILABLE`, `isUsableForCalculation: true`, absence de calcul numérique dans le résultat. |
| **TEST 03** | `ASME-B31.3` résolu (`RESOLVED`) mais non utilisable (`isUsableForCalculation: false`, `NOT_IMPLEMENTED`) pour un calcul non implémenté (`HOOP_STRESS`). |
| **TEST 04** | Résolution dans `PIPELINE` (`ASME-B31.4`, `ASME-B31.8`, `ASME-B31.12`, `ISO-13623`) distinguant identification (`RESOLVED`) et capacité (`NOT_IMPLEMENTED`, `isUsableForCalculation: false`). |
| **TEST 05** | Résolution de `EN-13480` dans `PIPING`, `PACKAGE` et `EQUIPMENT` avec maintien de `NOT_IMPLEMENTED`. |
| **TEST 06** | Refus d'arbitrage silencieux lorsqu'un domaine multi-code (`PIPING`, `PIPELINE`, `PACKAGE`, `EQUIPMENT`) est fourni seul -> `AMBIGUOUS` (`AMBIGUOUS_DOMAIN_MULTIPLE_CODES`). |
| **TEST 07** | Détection d'ambiguïté (`AMBIGUOUS`) lors de conflits entre `explicitDesignCodeId`, `pipingSpecId`, `projectDefaultDesignCodeId` ou `candidateDesignCodeIds` multiples. |
| **TEST 08** | Résolution nominale par `pipingSpecId` seul et par concordance unanime entre `explicitDesignCodeId`, `pipingSpecId` et `projectDefaultDesignCodeId` -> `RESOLVED`. |
| **TEST 09** | Contexte vide `{}` ou `pipingSpecId` introuvable seul -> `INSUFFICIENT_DATA` (`INSUFFICIENT_STRUCTURED_CONTEXT`, `PIPING_SPEC_NOT_FOUND`). |
| **TEST 10** | Rejet des codes inconnus, de `ASME-B31.1` (absent de `PDI_STANDARDS_REGISTRY`), des standards non-`DESIGN_CODE` (`ASME-B16.5`, `ASME-B36.10M`, `API-5L`, `API-6D`) et des codes incompatibles avec le domaine (`ASME-B31.8` dans `EQUIPMENT`) -> `UNSUPPORTED_CODE`. |
| **TEST 11** | Vérification de l'édition et des preuves : édition `2022` de `ASME-B31.8` sans preuve `VERIFIED` reste `UNVERIFIED` ; `EN-13480` sans édition retourne `MISSING_EDITION` ; preuve `NormativeEvidence` `VERIFIED` produit `VERIFIED` ; preuve `UNVERIFIED` reste `UNVERIFIED`. |
| **TEST 12** | Contrôle strict de l'édition (`2018` -> `EDITION_MISMATCH`) et du système d'unités (`US_CUSTOMARY` -> `UNVERIFIED_UNIT_SYSTEM`) sur la disponibilité de la formule `F01` de `ASME-B31.3`. |
| **TEST 13** | Anti-heuristique stricte : rejet (`INVALID_CONTEXT`) de `clientName`, `freeText`, chaîne libre avec espaces, token heuristique (`MAT_CS_B313`), `null` et tableaux. |
| **TEST 14** | Déterminisme strict (sortie JSON identique sur appels répétés) et immutabilité complète (`Object.isFrozen`) de toutes les structures retournées. |
| **TEST 15** | Non-régression complète : exécution intégrale des suites `ARCH-08`, `ARCH-07`, `NORM-08` et `NORM-01..14 Global Integration`. |

### 8.2 Limites connues et honnêteté normative
1. **Couverture de calcul actuelle** : Seul `ASME-B31.3` (édition `2024`, système `SI`, régime `THIN_WALL`) dispose d'une formule qualifiée et implémentée (`PRESSURE_WALL_THICKNESS`). Tous les autres codes de conception (`ASME-B31.4`, `ASME-B31.8`, `ASME-B31.12`, `EN-13480`, `ISO-13623`) sont uniquement identifiables par le resolver mais ont le statut `NOT_IMPLEMENTED` pour le calcul.
2. **Registre de spécifications de tuyauterie par défaut** : `PIPING_SPECS_REGISTRY` (`src/pdi/normative/registry/pipingSpecRegistry.ts`) est vide par défaut tant qu'aucune spécification projet vérifiée n'est chargée ou injectée via `MultiCodeResolverConfig.specLookup`.
3. **Registre de preuves normatives par défaut** : Tant qu'aucune preuve `NormativeEvidence` de statut `VERIFIED` n'est enregistrée et fournie via `evidenceIds`, le statut de vérification documentaire de l'édition (`editionReport.editionVerificationStatus`) demeure `UNVERIFIED` (ou `MISSING_EDITION`), même lorsque la formule de calcul est qualifiée dans `DESIGN_CODE_CALCULATION_REGISTRY`.
4. **Domaines tous multi-codes par défaut** : Les 4 domaines d'ingénierie actuels déclarant chacun plusieurs codes dans `defaultNormativeDesignCodeRefs`, un appel au resolver avec uniquement `engineeringDomain` retourne systématiquement `AMBIGUOUS` tant qu'une source explicite (`explicitDesignCodeId`, `pipingSpecId` ou `projectDefaultDesignCodeId`) ne précise pas le code retenu.
