/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * COMPONENT SELECTION + CATALOG + COMPATIBILITY ADAPTER
 * Reference: ARCH-06 (Component Selection + Catalog + Compatibility Architecture)
 *
 * RÈGLES STRICTES DU MASTER-ARCH-06 :
 * 1. Absence de donnée technique = Absence de donnée (undefined).
 * 2. Zéro valeur technique inventée (aucun DN/NPS/OD/Sch/Class/PN/Matériau par défaut).
 * 3. Aucune conversion implicite DN ↔ NPS ou Class ↔ PN.
 * 4. La compatibilité est multi-dimensionnelle et ne se résume pas à un booléen.
 * 5. Présence dans un catalogue ≠ Qualification normative automatique.
 * 6. Les preuves normatives (evidenceIds) proviennent exclusivement du moteur normatif.
 * 7. Aucune mutation des objets sources.
 */

import type {
  PdiCatalogComponent,
  PdiCatalogComponentType,
  PdiCatalogRegistry,
} from "./pdiCatalogComponent";
import {
  createCatalogComponent,
} from "./pdiCatalogComponent";
import type {
  PdiUniversalEntity,
  UniversalEntityCategory,
} from "./pdiUniversalEntity";
import { isValidStableId, parseOptionalNumeric } from "./pdiProjectAdapter";
import {
  PDI_INTERNATIONAL_PIPING_CATALOG,
} from "../catalog/trouvayCauvinCatalog";
import type { IsoFittingType, JointConnectionType } from "../isometric/types/isoGraphTypes";
import type { ComponentCandidate, ComponentType } from "../normative/types/componentSelectionTypes";
import type { INormativeCompatibilityEngine } from "../normative/engine/normativeCompatibilityEngine";
import type { INormativeCompatibilityRegistry } from "../normative/registry/normativeCompatibilityRegistry";
import type { INormativeEvidenceResolver } from "../normative/registry/normativeEvidenceResolver";

/**
 * Statuts d'évaluation de compatibilité industrielle (ARCH-06 §10 / FIX-01).
 */
export type PdiCompatibilityStatus =
  | "COMPATIBLE"
  | "INCOMPATIBLE"
  | "UNVERIFIED"
  | "INSUFFICIENT_DATA"
  | "INVALID";

/**
 * Nature de l'observation sur une dimension technique (ARCH-06-FIX-01 §13).
 */
export type PdiCompatibilityObservation =
  | "DATA_MATCH"
  | "DATA_MISMATCH"
  | "MISSING_DATA"
  | "NORMATIVE_DECISION";

/**
 * Dimensions indépendantes d'évaluation de la compatibilité (ARCH-06 §9 & §20).
 */
export type PdiCompatibilityDimension =
  | "connection"
  | "nominalSize"
  | "pressureRating"
  | "material"
  | "standard"
  | "faceType"
  | "pipingSpecification"
  | "normativeEvidence";

/**
 * Résultat détaillé par dimension technique.
 */
export interface PdiDimensionCompatibilityResult {
  readonly dimension: PdiCompatibilityDimension;
  readonly status: PdiCompatibilityStatus;
  readonly observation?: PdiCompatibilityObservation;
  readonly leftValue?: unknown;
  readonly rightValue?: unknown;
  readonly reason?: string;
  readonly evidenceIds?: readonly string[];
  readonly matchedRuleId?: string;
  readonly ruleId?: string;
  readonly matchedRuleIds?: readonly string[];
}

/**
 * Résultat complet et traçable de compatibilité entre deux composants (ARCH-06 §9 & §10 / FIX-01 / FIX-03).
 */
export interface PdiCompatibilityCheckResult {
  readonly overallStatus: PdiCompatibilityStatus;
  readonly leftComponentId: string;
  readonly rightComponentId: string;
  readonly dimensions: readonly PdiDimensionCompatibilityResult[];
  readonly evidenceIds: readonly string[];
  readonly ruleId?: string;
  readonly matchedRuleIds?: readonly string[];
  readonly reasons: readonly string[];
  readonly message: string;
}

/**
 * Contraintes provenant d'une Piping Material Specification (PMS) (ARCH-06 §15).
 */
export interface PdiPipingSpecConstraint {
  readonly pipingSpecId?: string;
  readonly designCodeId?: string;
  readonly materialGrade?: string;
  readonly pressureClass?: string;
  readonly connectionType?: string;
  readonly standard?: string;
  readonly schedule?: string;
  readonly allowedNominalDiameters?: readonly number[];
  readonly allowedNominalSizes?: readonly string[];
  readonly evidenceIds?: readonly string[];
}

/**
 * Options d'évaluation de compatibilité avec injection d'autorité normative (ARCH-06-FIX-01 §3 & §12).
 */
export interface CompatibilityOptions {
  readonly normativeCompatibilityEngine?: INormativeCompatibilityEngine;
  readonly normativeRegistry?: INormativeCompatibilityRegistry;
  readonly normativeEvidenceResolver?: INormativeEvidenceResolver;
  readonly pipingSpecConstraint?: PdiPipingSpecConstraint;
  readonly normativeEvidenceIds?: readonly string[];
  readonly allowPartialVerification?: boolean;
}

/**
 * Statuts de sélection de composant (ARCH-06 §8).
 */
export type PdiComponentSelectionStatus =
  | "SELECTED"
  | "ELIGIBLE"
  | "NO_CANDIDATE"
  | "INCOMPATIBLE"
  | "INSUFFICIENT_DATA"
  | "UNVERIFIED"
  | "INVALID";

/**
 * Requête d'entrée utilisateur ou de ligne pour la sélection d'un composant de catalogue (ARCH-06 §8).
 */
export interface PdiComponentSelectionRequest {
  readonly componentType: PdiCatalogComponentType;
  readonly nominalDiameter?: number | string;
  readonly nominalDiameterUnit?: "mm" | "in";
  readonly nominalSize?: string;
  readonly material?: string;
  readonly pressureClass?: string;
  readonly schedule?: string;
  readonly connectionType?: string;
  readonly faceType?: string;
  readonly standard?: string;
  readonly manufacturer?: string;
  readonly pipingSpecId?: string;
  readonly designCodeId?: string;
  readonly pipingSpecConstraint?: PdiPipingSpecConstraint;
}

/**
 * Résultat auditable de la sélection de composant de catalogue (ARCH-06 §8).
 */
export interface PdiComponentSelectionResult {
  readonly status: PdiComponentSelectionStatus;
  readonly selectedComponent?: PdiCatalogComponent;
  readonly candidateComponents: readonly PdiCatalogComponent[];
  readonly evaluatedCount: number;
  readonly matchedRules: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly message: string;
  readonly pipingSpecConstraintsApplied?: boolean;
  readonly dimensionResults?: readonly PdiDimensionCompatibilityResult[];
}

// ============================================================================
// MOTEUR DE COMPATIBILITÉ MULTI-DIMENSIONNEL (ARCH-06 §9..13 & FIX-01)
// ============================================================================

/**
 * Validation stricte et déterministe d'une décision normative bilatérale (ARCH-06-FIX-04).
 *
 * Garantit que `observation = "NORMATIVE_DECISION"` ne peut être produit que si la réponse
 * de NORM-13 démontre explicitement que la règle retournée (`matchedRule`) correspond
 * exactement à la relation complète comparée LEFT ↔ RIGHT pour la dimension concernée :
 * - `matchedRule` doit exister et posséder un `ruleId` valide ;
 * - `matchedRule.status` doit concorder avec le statut retourné (`COMPATIBLE` ou `INCOMPATIBLE`) ;
 * - `matchedRule.componentType` doit être strictement égal au couple bilatéral `${left.componentType}_TO_${right.componentType}` ;
 * - `matchedRule[dimensionField]` doit être strictement égal à la relation bilatérale `${leftValue}_TO_${rightValue}`.
 *
 * Une règle générique (ex: `{ connectionType: "butt_weld" }`), partielle ou unilatérale (LEFT-only)
 * est systématiquement rejetée (`false` → `UNVERIFIED`).
 */
function verifyExplicitBilateralRuleMatch(
  normRes: ReturnType<INormativeCompatibilityEngine["evaluate"]> | undefined,
  expectedBilateralComponentType: string,
  dimensionField: "connectionType" | "nominalSize" | "pressureRating" | "materialId" | "standardId",
  expectedBilateralDimensionValue: string
): boolean {
  if (!normRes) {
    return false;
  }
  if (normRes.status !== "COMPATIBLE" && normRes.status !== "INCOMPATIBLE") {
    return false;
  }
  const matchedRule = normRes.matchedRule;
  if (!matchedRule || typeof matchedRule !== "object") {
    return false;
  }
  if (typeof matchedRule.ruleId !== "string" || matchedRule.ruleId.trim().length === 0) {
    return false;
  }
  if (matchedRule.status !== normRes.status) {
    return false;
  }
  if (
    typeof matchedRule.componentType !== "string" ||
    matchedRule.componentType !== expectedBilateralComponentType
  ) {
    return false;
  }
  const ruleDimensionValue = matchedRule[dimensionField];
  if (
    typeof ruleDimensionValue !== "string" ||
    ruleDimensionValue !== expectedBilateralDimensionValue
  ) {
    return false;
  }
  return true;
}

/**
 * Évalue la compatibilité de connexion entre deux composants (ARCH-06-FIX-01 §5 / FIX-02 / FIX-04).
 * RÈGLE FIX-02 : DATA_MATCH = UNVERIFIED sans décision normative vérifiée.
 * RÈGLE FIX-04 : NORMATIVE_DECISION exige une correspondance bilatérale explicite vérifiée sur matchedRule.
 */
function evaluateConnectionDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const leftConn = typeof left.connectionType === "string" && left.connectionType.trim().length > 0
    ? left.connectionType.trim()
    : undefined;
  const rightConn = typeof right.connectionType === "string" && right.connectionType.trim().length > 0
    ? right.connectionType.trim()
    : undefined;

  if (leftConn === undefined || rightConn === undefined) {
    return Object.freeze({
      dimension: "connection",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: leftConn,
      rightValue: rightConn,
      reason: "Missing connection type on one or both components.",
      evidenceIds: Object.freeze([]),
    });
  }

  // Délégation exclusive à l'autorité normative NORM-13 si disponible
  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralConnectionValue = `${leftConn}_TO_${rightConn}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      connectionType: bilateralConnectionValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "connectionType",
        bilateralConnectionValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "connection",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftConn,
        rightValue: rightConn,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Normative connection compatibility evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  // Sans décision NORM-13 bilatérale vérifiée : DATA_MATCH ne produit pas COMPATIBLE
  if (leftConn === rightConn) {
    return Object.freeze({
      dimension: "connection",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: leftConn,
      rightValue: rightConn,
      reason: `Matching connection types: ${leftConn}. Normative status remains UNVERIFIED without verified normative rule.`,
      evidenceIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    dimension: "connection",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftConn,
    rightValue: rightConn,
    reason: `Connection types differ ('${leftConn}' vs '${rightConn}'). Requires an applicable compatibility rule from the normative authority.`,
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la compatibilité dimensionnelle nominale (ARCH-06 §11 / FIX-02 / FIX-04).
 * RÈGLE ABSOLUE : Zéro conversion implicite DN ↔ NPS.
 * DATA_MATCH = UNVERIFIED sans décision normative bilatérale explicite.
 */
function evaluateNominalSizeDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const leftDn = left.nominalDiameter;
  const rightDn = right.nominalDiameter;
  const leftNps = typeof left.nominalSize === "string" && left.nominalSize.trim().length > 0
    ? left.nominalSize.trim()
    : undefined;
  const rightNps = typeof right.nominalSize === "string" && right.nominalSize.trim().length > 0
    ? right.nominalSize.trim()
    : undefined;

  if (leftDn === undefined && leftNps === undefined) {
    return Object.freeze({
      dimension: "nominalSize",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: undefined,
      rightValue: rightDn !== undefined ? `DN${rightDn}` : rightNps,
      reason: "Missing nominal diameter or nominal size on left component.",
      evidenceIds: Object.freeze([]),
    });
  }

  if (rightDn === undefined && rightNps === undefined) {
    return Object.freeze({
      dimension: "nominalSize",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: leftDn !== undefined ? `DN${leftDn}` : leftNps,
      rightValue: undefined,
      reason: "Missing nominal diameter or nominal size on right component.",
      evidenceIds: Object.freeze([]),
    });
  }

  const leftSizeVal = leftDn !== undefined ? `DN${leftDn}` : leftNps;
  const rightSizeVal = rightDn !== undefined ? `DN${rightDn}` : rightNps;

  // Délégation NORM-13 si disponible
  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine && leftSizeVal !== undefined && rightSizeVal !== undefined) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralSizeValue = `${leftSizeVal}_TO_${rightSizeVal}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      nominalSize: bilateralSizeValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "nominalSize",
        bilateralSizeValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "nominalSize",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftSizeVal,
        rightValue: rightSizeVal,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Nomative size evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  // Si les deux possèdent un DN numérique
  if (leftDn !== undefined && rightDn !== undefined) {
    if (leftDn === rightDn) {
      return Object.freeze({
        dimension: "nominalSize",
        status: "UNVERIFIED",
        observation: "DATA_MATCH",
        leftValue: `DN${leftDn}`,
        rightValue: `DN${rightDn}`,
        reason: `Matching nominal diameter DN${leftDn}. Data match observed, normative status is UNVERIFIED.`,
        evidenceIds: Object.freeze([]),
      });
    }
    return Object.freeze({
      dimension: "nominalSize",
      status: "UNVERIFIED",
      observation: "DATA_MISMATCH",
      leftValue: `DN${leftDn}`,
      rightValue: `DN${rightDn}`,
      reason: `Mismatched nominal diameters: DN${leftDn} !== DN${rightDn}.`,
      evidenceIds: Object.freeze([]),
    });
  }

  // Si les deux possèdent un NPS textuel
  if (leftNps !== undefined && rightNps !== undefined) {
    if (leftNps === rightNps) {
      return Object.freeze({
        dimension: "nominalSize",
        status: "UNVERIFIED",
        observation: "DATA_MATCH",
        leftValue: leftNps,
        rightValue: rightNps,
        reason: `Matching nominal size ${leftNps}. Data match observed, normative status is UNVERIFIED.`,
        evidenceIds: Object.freeze([]),
      });
    }
    return Object.freeze({
      dimension: "nominalSize",
      status: "UNVERIFIED",
      observation: "DATA_MISMATCH",
      leftValue: leftNps,
      rightValue: rightNps,
      reason: `Mismatched nominal sizes: '${leftNps}' !== '${rightNps}'.`,
      evidenceIds: Object.freeze([]),
    });
  }

  // Cas hétérogène DN vs NPS sans conversion implicite
  return Object.freeze({
    dimension: "nominalSize",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftDn !== undefined ? `DN${leftDn}` : leftNps,
    rightValue: rightDn !== undefined ? `DN${rightDn}` : rightNps,
    reason: "Heterogeneous nominal size representations (DN vs NPS) without normative bridge.",
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la compatibilité de classe de pression / rating (ARCH-06 §12 / FIX-01 §9 / FIX-02 §2 / FIX-04).
 * RÈGLE ABSOLUE : Zéro équivalence implicite Class ↔ PN et aucun INCOMPATIBLE fabriqué.
 */
function evaluatePressureRatingDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const leftClass = typeof left.pressureClass === "string" && left.pressureClass.trim().length > 0
    ? left.pressureClass.trim()
    : undefined;
  const rightClass = typeof right.pressureClass === "string" && right.pressureClass.trim().length > 0
    ? right.pressureClass.trim()
    : undefined;

  if (leftClass === undefined || rightClass === undefined) {
    return Object.freeze({
      dimension: "pressureRating",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: leftClass,
      rightValue: rightClass,
      reason: "Missing pressure class or rating on one or both components.",
      evidenceIds: Object.freeze([]),
    });
  }

  // Délégation NORM-13 si disponible
  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralRatingValue = `${leftClass}_TO_${rightClass}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      pressureRating: bilateralRatingValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "pressureRating",
        bilateralRatingValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "pressureRating",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftClass,
        rightValue: rightClass,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Pressure rating compatibility evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  if (leftClass === rightClass) {
    return Object.freeze({
      dimension: "pressureRating",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: leftClass,
      rightValue: rightClass,
      reason: `Matching pressure class: ${leftClass}. Normative compatibility remains UNVERIFIED without verified normative rule.`,
      evidenceIds: Object.freeze([]),
    });
  }

  // FIX-02 §2 : Un mismatch Class/PN sans décision NORM-13 reste UNVERIFIED (jamais INCOMPATIBLE inventé)
  return Object.freeze({
    dimension: "pressureRating",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftClass,
    rightValue: rightClass,
    reason: `Mismatched pressure ratings ('${leftClass}' vs '${rightClass}'). Requires normative evaluation by NORM-13.`,
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la compatibilité matière (ARCH-06 §13 / FIX-01 §7 / FIX-02 §1 / FIX-04).
 * RÈGLE ABSOLUE : Une égalité de chaîne = DATA_MATCH, pas COMPATIBLE.
 */
function evaluateMaterialDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const leftMat = typeof left.material === "string" && left.material.trim().length > 0
    ? left.material.trim()
    : undefined;
  const rightMat = typeof right.material === "string" && right.material.trim().length > 0
    ? right.material.trim()
    : undefined;

  if (leftMat === undefined || rightMat === undefined) {
    return Object.freeze({
      dimension: "material",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: leftMat,
      rightValue: rightMat,
      reason: "Missing material designation on one or both components.",
      evidenceIds: Object.freeze([]),
    });
  }

  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralMaterialValue = `${leftMat}_TO_${rightMat}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      materialId: bilateralMaterialValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "materialId",
        bilateralMaterialValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "material",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftMat,
        rightValue: rightMat,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Material metallurgical compatibility evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  if (leftMat === rightMat) {
    return Object.freeze({
      dimension: "material",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: leftMat,
      rightValue: rightMat,
      reason: `Matching material grade string: ${leftMat}. Data match observed, normative status remains UNVERIFIED.`,
      evidenceIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    dimension: "material",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftMat,
    rightValue: rightMat,
    reason: `Different material grades ('${leftMat}' vs '${rightMat}') require explicit metallurgical compatibility qualification from the normative engine.`,
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la compatibilité des standards (ARCH-06-FIX-01 §8 / FIX-02 §3 / FIX-04).
 * RÈGLE FIX-02 : Ni PIPE+FITTING ni égalité de standard ne créent de COMPATIBLE automatique.
 */
function evaluateStandardDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const leftStd = typeof left.standard === "string" && left.standard.trim().length > 0
    ? left.standard.trim()
    : undefined;
  const rightStd = typeof right.standard === "string" && right.standard.trim().length > 0
    ? right.standard.trim()
    : undefined;

  if (leftStd === undefined && rightStd === undefined) {
    return Object.freeze({
      dimension: "standard",
      status: "UNVERIFIED",
      observation: "MISSING_DATA",
      leftValue: undefined,
      rightValue: undefined,
      reason: "Standard unconstrained on both components.",
      evidenceIds: Object.freeze([]),
    });
  }

  if (leftStd === undefined || rightStd === undefined) {
    return Object.freeze({
      dimension: "standard",
      status: "UNVERIFIED",
      observation: "MISSING_DATA",
      leftValue: leftStd,
      rightValue: rightStd,
      reason: "Standard designation absent on one component.",
      evidenceIds: Object.freeze([]),
    });
  }

  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralStandardValue = `${leftStd}_TO_${rightStd}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      standardId: bilateralStandardValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "standardId",
        bilateralStandardValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "standard",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftStd,
        rightValue: rightStd,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Standard compatibility evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  if (leftStd === rightStd) {
    return Object.freeze({
      dimension: "standard",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: leftStd,
      rightValue: rightStd,
      reason: `Matching standard string: ${leftStd}. Normative qualification remains UNVERIFIED without verified normative rule.`,
      evidenceIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    dimension: "standard",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftStd,
    rightValue: rightStd,
    reason: `Different standards ('${leftStd}' vs '${rightStd}') require normative compatibility evaluation.`,
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la compatibilité de face pour raccordements à brides (ARCH-06 §9 / FIX-01 §6 / FIX-02 / FIX-04).
 */
function evaluateFaceTypeDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiDimensionCompatibilityResult {
  const isLeftFlanged = left.componentType === "FLANGE" || left.connectionType === "flanged";
  const isRightFlanged = right.componentType === "FLANGE" || right.connectionType === "flanged";

  if (!isLeftFlanged && !isRightFlanged) {
    return Object.freeze({
      dimension: "faceType",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: undefined,
      rightValue: undefined,
      reason: "Not applicable (non-flanged components).",
      evidenceIds: Object.freeze([]),
    });
  }

  const leftFace = typeof left.faceType === "string" && left.faceType.trim().length > 0
    ? left.faceType.trim()
    : undefined;
  const rightFace = typeof right.faceType === "string" && right.faceType.trim().length > 0
    ? right.faceType.trim()
    : undefined;

  if (leftFace === undefined || rightFace === undefined) {
    return Object.freeze({
      dimension: "faceType",
      status: "INSUFFICIENT_DATA",
      observation: "MISSING_DATA",
      leftValue: leftFace,
      rightValue: rightFace,
      reason: "Missing flange face type on flanged component.",
      evidenceIds: Object.freeze([]),
    });
  }

  // RÈGLE FIX-04 : Vérification stricte de correspondance bilatérale exacte sur matchedRule
  if (options?.normativeCompatibilityEngine) {
    const bilateralComponentType = `${left.componentType}_TO_${right.componentType}`;
    const bilateralFaceValue = `${leftFace}_TO_${rightFace}`;
    const normRes = options.normativeCompatibilityEngine.evaluate({
      componentType: bilateralComponentType,
      connectionType: bilateralFaceValue,
      evidenceIds: options.normativeEvidenceIds,
    });
    if (
      verifyExplicitBilateralRuleMatch(
        normRes,
        bilateralComponentType,
        "connectionType",
        bilateralFaceValue
      )
    ) {
      const resolvedRuleId = normRes.ruleId ?? normRes.matchedRule?.ruleId;
      const ruleIds = normRes.matchedRuleIds
        ? Object.freeze([...normRes.matchedRuleIds])
        : resolvedRuleId
          ? Object.freeze([resolvedRuleId])
          : undefined;
      return Object.freeze({
        dimension: "faceType",
        status: normRes.status as PdiCompatibilityStatus,
        observation: "NORMATIVE_DECISION",
        leftValue: leftFace,
        rightValue: rightFace,
        matchedRuleId: resolvedRuleId,
        ruleId: resolvedRuleId,
        matchedRuleIds: ruleIds,
        reason: normRes.message || `Flange facing compatibility evaluated by NORM-13 (${normRes.status}).`,
        evidenceIds: normRes.evidenceIds ? Object.freeze([...normRes.evidenceIds]) : Object.freeze([]),
      });
    }
  }

  if (leftFace === rightFace) {
    return Object.freeze({
      dimension: "faceType",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: leftFace,
      rightValue: rightFace,
      reason: `Matching flange facing: ${leftFace}. Normative status remains UNVERIFIED without verified normative rule.`,
      evidenceIds: Object.freeze([]),
    });
  }

  return Object.freeze({
    dimension: "faceType",
    status: "UNVERIFIED",
    observation: "DATA_MISMATCH",
    leftValue: leftFace,
    rightValue: rightFace,
    reason: `Different flange face types ('${leftFace}' vs '${rightFace}') require compatibility evaluation by normative authority.`,
    evidenceIds: Object.freeze([]),
  });
}

/**
 * Évalue la conformité des deux composants à une Piping Specification (ARCH-06 §15 / FIX-01 §11 / FIX-02).
 */
function evaluatePipingSpecDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  spec?: PdiPipingSpecConstraint
): PdiDimensionCompatibilityResult {
  if (!spec || !spec.pipingSpecId) {
    return Object.freeze({
      dimension: "pipingSpecification",
      status: "UNVERIFIED",
      observation: "DATA_MATCH",
      leftValue: undefined,
      rightValue: undefined,
      reason: "No piping specification constraint specified (unconstrained).",
      evidenceIds: Object.freeze([]),
    });
  }

  const issues: string[] = [];

  if (spec.pressureClass) {
    if (left.pressureClass && left.pressureClass !== spec.pressureClass) {
      issues.push(`Left component pressure class '${left.pressureClass}' does not match spec '${spec.pressureClass}'.`);
    }
    if (right.pressureClass && right.pressureClass !== spec.pressureClass) {
      issues.push(`Right component pressure class '${right.pressureClass}' does not match spec '${spec.pressureClass}'.`);
    }
  }

  if (spec.materialGrade) {
    if (left.material && left.material !== spec.materialGrade) {
      issues.push(`Left component material '${left.material}' does not match spec material '${spec.materialGrade}'.`);
    }
    if (right.material && right.material !== spec.materialGrade) {
      issues.push(`Right component material '${right.material}' does not match spec material '${spec.materialGrade}'.`);
    }
  }

  if (issues.length > 0) {
    return Object.freeze({
      dimension: "pipingSpecification",
      status: "INCOMPATIBLE",
      observation: "DATA_MISMATCH",
      leftValue: left.pressureClass || left.material,
      rightValue: right.pressureClass || right.material,
      reason: issues.join(" "),
      evidenceIds: spec.evidenceIds ? Object.freeze([...spec.evidenceIds]) : Object.freeze([]),
    });
  }

  return Object.freeze({
    dimension: "pipingSpecification",
    status: "UNVERIFIED",
    observation: "DATA_MATCH",
    leftValue: spec.pipingSpecId,
    rightValue: spec.pipingSpecId,
    reason: `Both components conform to selection filters of Piping Specification ${spec.pipingSpecId}. Normative qualification remains under normative engine authority.`,
    evidenceIds: spec.evidenceIds ? Object.freeze([...spec.evidenceIds]) : Object.freeze([]),
  });
}

/**
 * Évalue la dimension de traçabilité des preuves normatives (ARCH-06 §14 / FIX-02).
 */
function evaluateNormativeEvidenceDimension(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  optionsEvidence?: readonly string[]
): PdiDimensionCompatibilityResult {
  const combinedEvidence = new Set<string>();

  if (Array.isArray(left.evidenceIds)) {
    left.evidenceIds.forEach((id) => combinedEvidence.add(id));
  }
  if (Array.isArray(right.evidenceIds)) {
    right.evidenceIds.forEach((id) => combinedEvidence.add(id));
  }
  if (Array.isArray(optionsEvidence)) {
    optionsEvidence.forEach((id) => combinedEvidence.add(id));
  }

  const list = Object.freeze(Array.from(combinedEvidence).sort());

  return Object.freeze({
    dimension: "normativeEvidence",
    status: "UNVERIFIED",
    observation: "DATA_MATCH",
    leftValue: Array.isArray(left.evidenceIds) ? left.evidenceIds.length : 0,
    rightValue: Array.isArray(right.evidenceIds) ? right.evidenceIds.length : 0,
    reason: list.length > 0 ? `${list.length} normative evidence references traced.` : "No specific normative evidence required or attached.",
    evidenceIds: list,
  });
}

/**
 * Moteur principal de vérification de compatibilité structurée entre deux composants catalogue (ARCH-06 §9 & §10 / FIX-01 / FIX-02).
 */
export function checkComponentCompatibility(
  left: PdiCatalogComponent,
  right: PdiCatalogComponent,
  options?: CompatibilityOptions
): PdiCompatibilityCheckResult {
  if (!left || typeof left !== "object" || !isValidStableId(left.id)) {
    return Object.freeze({
      overallStatus: "INVALID",
      leftComponentId: left?.id || "unknown",
      rightComponentId: right?.id || "unknown",
      dimensions: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      reasons: Object.freeze(["Left component is invalid or missing stable ID."]),
      message: "Invalid left component.",
    });
  }
  if (!right || typeof right !== "object" || !isValidStableId(right.id)) {
    return Object.freeze({
      overallStatus: "INVALID",
      leftComponentId: left.id,
      rightComponentId: right?.id || "unknown",
      dimensions: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      reasons: Object.freeze(["Right component is invalid or missing stable ID."]),
      message: "Invalid right component.",
    });
  }

  // ARCH-06-FIX-03 : Aucune évaluation normative globale unilatérale (LEFT-only) ne doit être
  // exécutée pour promouvoir overallStatus. Seules les décisions normatives explicites
  // obtenues sur les dimensions comparées LEFT ↔ RIGHT (NORMATIVE_DECISION) peuvent qualifier
  // la compatibilité globale.
  const dimensions: PdiDimensionCompatibilityResult[] = [
    evaluateConnectionDimension(left, right, options),
    evaluateNominalSizeDimension(left, right, options),
    evaluatePressureRatingDimension(left, right, options),
    evaluateMaterialDimension(left, right, options),
    evaluateStandardDimension(left, right, options),
    evaluateFaceTypeDimension(left, right, options),
    evaluatePipingSpecDimension(left, right, options?.pipingSpecConstraint),
    evaluateNormativeEvidenceDimension(left, right, options?.normativeEvidenceIds),
  ];

  // Détermination de l'état global avec hiérarchie stricte FIX-02 / FIX-03 :
  // INVALID > INCOMPATIBLE > INSUFFICIENT_DATA > UNVERIFIED > COMPATIBLE (uniquement si décision normative vérifiée LEFT ↔ RIGHT)
  let overallStatus: PdiCompatibilityStatus = "UNVERIFIED";

  const hasInvalid = dimensions.some((d) => d.status === "INVALID");
  const hasIncompatible = dimensions.some((d) => d.status === "INCOMPATIBLE");
  const hasInsufficient = dimensions.some((d) => d.status === "INSUFFICIENT_DATA");
  const hasVerifiedDimensionCompatible = dimensions.some(
    (d) => d.observation === "NORMATIVE_DECISION" && d.status === "COMPATIBLE"
  );

  if (hasInvalid) {
    overallStatus = "INVALID";
  } else if (hasIncompatible) {
    overallStatus = "INCOMPATIBLE";
  } else if (hasVerifiedDimensionCompatible) {
    overallStatus = "COMPATIBLE";
  } else if (hasInsufficient) {
    overallStatus = "INSUFFICIENT_DATA";
  } else {
    overallStatus = "UNVERIFIED";
  }

  const reasons: string[] = [];
  const allEvidenceIds = new Set<string>();
  const allMatchedRuleIds = new Set<string>();

  for (const d of dimensions) {
    if (d.reason) reasons.push(`[${d.dimension}] ${d.reason}`);
    if (d.evidenceIds) {
      d.evidenceIds.forEach((eid) => allEvidenceIds.add(eid));
    }
    if (d.observation === "NORMATIVE_DECISION") {
      if (d.matchedRuleId) {
        allMatchedRuleIds.add(d.matchedRuleId);
      }
      if (d.matchedRuleIds) {
        d.matchedRuleIds.forEach((rid) => allMatchedRuleIds.add(rid));
      }
    }
  }

  const sortedMatchedRuleIds = Object.freeze(Array.from(allMatchedRuleIds).sort());

  const message = overallStatus === "COMPATIBLE"
    ? `Components '${left.id}' and '${right.id}' are verified compatible by normative authority.`
    : `Compatibility check between '${left.id}' and '${right.id}' evaluated to ${overallStatus}.`;

  return Object.freeze({
    overallStatus,
    leftComponentId: left.id,
    rightComponentId: right.id,
    dimensions: Object.freeze(dimensions),
    evidenceIds: Object.freeze(Array.from(allEvidenceIds).sort()),
    ...(sortedMatchedRuleIds.length > 0
      ? { ruleId: sortedMatchedRuleIds[0], matchedRuleIds: sortedMatchedRuleIds }
      : {}),
    reasons: Object.freeze(reasons),
    message,
  });
}

// ============================================================================
// MOTEUR DE SÉLECTION DE COMPOSANTS CATALOGUE (ARCH-06 §8 / FIX-01 §14)
// ============================================================================

/**
 * Sélectionne de manière déterministe et auditable un composant du catalogue
 * selon une requête d'ingénierie et des contraintes PMS optionnelles.
 */
export function selectCatalogComponent(
  catalog: PdiCatalogRegistry | readonly PdiCatalogComponent[],
  request: PdiComponentSelectionRequest
): PdiComponentSelectionResult {
  if (!request || typeof request !== "object") {
    return Object.freeze({
      status: "INVALID",
      candidateComponents: Object.freeze([]),
      evaluatedCount: 0,
      matchedRules: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      message: "Selection request must be a non-null object.",
    });
  }

  const allComponents: readonly PdiCatalogComponent[] = Array.isArray(catalog)
    ? catalog
    : (catalog as PdiCatalogRegistry).list();

  const matchedRules: string[] = [];
  const evidenceIds = new Set<string>();

  // 1. Filtrage strict par componentType
  const typeCandidates = allComponents.filter((c) => c.componentType === request.componentType);
  if (typeCandidates.length === 0) {
    return Object.freeze({
      status: "NO_CANDIDATE",
      candidateComponents: Object.freeze([]),
      evaluatedCount: allComponents.length,
      matchedRules: Object.freeze([]),
      evidenceIds: Object.freeze([]),
      message: `No catalog component found for type '${request.componentType}'.`,
    });
  }

  matchedRules.push(`filter_by_type:${request.componentType}`);

  const reqDn = parseOptionalNumeric(request.nominalDiameter);
  const reqNps = typeof request.nominalSize === "string" && request.nominalSize.trim().length > 0
    ? request.nominalSize.trim()
    : undefined;
  const reqMaterial = typeof request.material === "string" && request.material.trim().length > 0
    ? request.material.trim()
    : undefined;
  const reqPressureClass = typeof request.pressureClass === "string" && request.pressureClass.trim().length > 0
    ? request.pressureClass.trim()
    : undefined;
  const reqSchedule = typeof request.schedule === "string" && request.schedule.trim().length > 0
    ? request.schedule.trim()
    : undefined;
  const reqConnectionType = typeof request.connectionType === "string" && request.connectionType.trim().length > 0
    ? request.connectionType.trim()
    : undefined;
  const reqStandard = typeof request.standard === "string" && request.standard.trim().length > 0
    ? request.standard.trim()
    : undefined;

  // 2. Évaluation des contraintes requises
  const eligibleCandidates: PdiCatalogComponent[] = [];
  let unverifiedFound = false;

  for (const candidate of typeCandidates) {
    let eligible = true;

    // Comparaison DN
    if (reqDn !== undefined) {
      if (candidate.nominalDiameter !== undefined) {
        if (candidate.nominalDiameter !== reqDn) {
          eligible = false;
        }
      } else if (candidate.nominalSize === undefined) {
        // Donnée de taille absente sur le candidat
        unverifiedFound = true;
        eligible = false;
      } else {
        // Candidat a seulement nominalSize (NPS) et requête a DN -> Pas de conversion implicite
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison NPS
    if (eligible && reqNps !== undefined) {
      if (candidate.nominalSize !== undefined) {
        if (candidate.nominalSize !== reqNps) {
          eligible = false;
        }
      } else if (candidate.nominalDiameter === undefined) {
        unverifiedFound = true;
        eligible = false;
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison Matériau
    if (eligible && reqMaterial !== undefined) {
      if (candidate.material !== undefined) {
        if (candidate.material !== reqMaterial) {
          eligible = false;
        }
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison Classe de pression
    if (eligible && reqPressureClass !== undefined) {
      if (candidate.pressureClass !== undefined) {
        if (candidate.pressureClass !== reqPressureClass) {
          eligible = false;
        }
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison Schedule
    if (eligible && reqSchedule !== undefined) {
      if (candidate.schedule !== undefined) {
        if (candidate.schedule !== reqSchedule) {
          eligible = false;
        }
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison Connexion
    if (eligible && reqConnectionType !== undefined) {
      if (candidate.connectionType !== undefined) {
        if (candidate.connectionType !== reqConnectionType) {
          eligible = false;
        }
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Comparaison Standard
    if (eligible && reqStandard !== undefined) {
      if (candidate.standard !== undefined) {
        if (candidate.standard !== reqStandard) {
          eligible = false;
        }
      } else {
        unverifiedFound = true;
        eligible = false;
      }
    }

    // Contrainte Piping Spec
    if (eligible && request.pipingSpecConstraint) {
      const spec = request.pipingSpecConstraint;
      if (spec.pressureClass && candidate.pressureClass && candidate.pressureClass !== spec.pressureClass) {
        eligible = false;
      }
      if (spec.materialGrade && candidate.material && candidate.material !== spec.materialGrade) {
        eligible = false;
      }
      if (spec.evidenceIds) {
        spec.evidenceIds.forEach((eid) => evidenceIds.add(eid));
      }
    }

    if (eligible) {
      eligibleCandidates.push(candidate);
      if (candidate.evidenceIds) {
        candidate.evidenceIds.forEach((eid) => evidenceIds.add(eid));
      }
    }
  }

  // Tri déterministe par ID
  const sortedCandidates = Object.freeze(
    [...eligibleCandidates].sort((a, b) => a.id.localeCompare(b.id))
  );

  if (sortedCandidates.length === 1) {
    return Object.freeze({
      status: "SELECTED",
      selectedComponent: sortedCandidates[0],
      candidateComponents: sortedCandidates,
      evaluatedCount: typeCandidates.length,
      matchedRules: Object.freeze(matchedRules),
      evidenceIds: Object.freeze(Array.from(evidenceIds).sort()),
      pipingSpecConstraintsApplied: Boolean(request.pipingSpecConstraint),
      message: `Component '${sortedCandidates[0].id}' uniquely selected.`,
    });
  }

  if (sortedCandidates.length > 1) {
    return Object.freeze({
      status: "ELIGIBLE",
      selectedComponent: sortedCandidates[0], // Choix déterministe du premier candidat trié
      candidateComponents: sortedCandidates,
      evaluatedCount: typeCandidates.length,
      matchedRules: Object.freeze(matchedRules),
      evidenceIds: Object.freeze(Array.from(evidenceIds).sort()),
      pipingSpecConstraintsApplied: Boolean(request.pipingSpecConstraint),
      message: `${sortedCandidates.length} eligible candidates found.`,
    });
  }

  if (unverifiedFound) {
    return Object.freeze({
      status: "UNVERIFIED",
      candidateComponents: Object.freeze([]),
      evaluatedCount: typeCandidates.length,
      matchedRules: Object.freeze(matchedRules),
      evidenceIds: Object.freeze(Array.from(evidenceIds).sort()),
      pipingSpecConstraintsApplied: Boolean(request.pipingSpecConstraint),
      message: "No candidate could be fully verified due to missing technical parameters on candidate components.",
    });
  }

  return Object.freeze({
    status: "NO_CANDIDATE",
    candidateComponents: Object.freeze([]),
    evaluatedCount: typeCandidates.length,
    matchedRules: Object.freeze(matchedRules),
    evidenceIds: Object.freeze(Array.from(evidenceIds).sort()),
    pipingSpecConstraintsApplied: Boolean(request.pipingSpecConstraint),
    message: "No eligible component matches all requested criteria.",
  });
}

// ============================================================================
// PASSERELLES VERS UNIVERSAL MODEL & CATALOGUES EXTERNES (ARCH-06 §16 & §17)
// ============================================================================

/**
 * Mappe un type de composant de catalogue vers une catégorie Universal Model.
 */
function mapCatalogTypeToUniversalCategory(type: PdiCatalogComponentType): UniversalEntityCategory {
  switch (type) {
    case "PIPE":
      return "pipe";
    case "VALVE":
      return "valve";
    case "FLANGE":
      return "flange";
    case "SUPPORT":
      return "support";
    case "ELBOW":
    case "TEE":
    case "REDUCER":
    case "CAP":
    case "GASKET":
    case "BOLT":
    case "OTHER":
    case "INSTRUMENT":
    default:
      return "fitting";
  }
}

/**
 * Adapte un PdiCatalogComponent en PdiUniversalEntity (ARCH-06 §17).
 * Conserve la séparation : le Universal Model reste le modèle d'instance CAO sans devenir un catalogue.
 */
export function adaptCatalogComponentToUniversalEntity(
  component: PdiCatalogComponent,
  options?: { projectId?: string; entityId?: string }
): PdiUniversalEntity {
  if (!component || !isValidStableId(component.id)) {
    throw new Error("[ARCH-06] Cannot adapt invalid catalog component to universal entity.");
  }

  const category = mapCatalogTypeToUniversalCategory(component.componentType);
  const id = options?.entityId ? options.entityId.trim() : `entity_${component.id}`;
  const labelFr = component.shortName || component.description || component.id;

  return Object.freeze({
    identity: Object.freeze({
      id,
      type: component.componentType.toLowerCase(),
      category,
      name: component.description || component.id,
      labelFr,
      description: component.description,
      projectId: options?.projectId,
      source: "CATALOG",
    }),
    geometry: Object.freeze({
      x: 0,
      y: 0,
      z: 0,
    }),
    connection: {
      ports: [],
      connectionType: (component.connectionType as any) || "inline",
    },
    dn: Object.freeze({
      dn: component.nominalDiameter,
      inch: component.nominalSize,
      outerDiameterMm: component.outerDiameterMm,
      unit: component.nominalDiameterUnit,
    }),
    pn: Object.freeze({
      rating: component.pressureClass,
    }),
    material: Object.freeze({
      grade: component.material,
      standard: component.standard,
      schedule: component.schedule,
      wallThicknessMm: component.wallThicknessMm,
    }),
    service: Object.freeze({}),
    spec: Object.freeze({
      classRating: component.pressureClass,
    }),
    tag: Object.freeze({}),
    fabrication: Object.freeze({}),
    documentation: Object.freeze({
      catalogRef: component.manufacturerPartNumber || component.id,
      manufacturer: component.manufacturer,
    }),
    specific: Object.freeze({}),
  });
}

/**
 * Adapte une PdiUniversalEntity en PdiCatalogComponent.
 */
export function adaptUniversalEntityToCatalogComponent(
  entity: PdiUniversalEntity
): PdiCatalogComponent {
  if (!entity || !entity.identity || !isValidStableId(entity.identity.id)) {
    throw new Error("[ARCH-06] Cannot adapt invalid universal entity to catalog component.");
  }

  let componentType: PdiCatalogComponentType = "OTHER";
  const cat = entity.identity.category;
  if (cat === "pipe") componentType = "PIPE";
  else if (cat === "valve") componentType = "VALVE";
  else if (cat === "flange") componentType = "FLANGE";
  else if (cat === "support") componentType = "SUPPORT";
  else if (cat === "fitting") {
    const rawType = typeof entity.identity.type === "string" ? entity.identity.type.toLowerCase() : "";
    if (rawType.includes("elbow") || rawType.includes("coude")) componentType = "ELBOW";
    else if (rawType.includes("tee") || rawType.includes("te")) componentType = "TEE";
    else if (rawType.includes("reducer") || rawType.includes("reduction")) componentType = "REDUCER";
    else if (rawType.includes("cap")) componentType = "CAP";
    else componentType = "TEE";
  }

  return createCatalogComponent({
    id: entity.identity.id,
    componentType,
    description: entity.identity.name,
    shortName: entity.identity.labelFr,
    manufacturer: entity.documentation?.manufacturer,
    manufacturerPartNumber: entity.documentation?.catalogRef,
    standard: entity.material?.standard,
    material: entity.material?.grade,
    nominalDiameter: entity.dn?.dn,
    nominalDiameterUnit: entity.dn?.unit,
    nominalSize: entity.dn?.inch,
    outerDiameterMm: entity.dn?.outerDiameterMm,
    pressureClass: entity.pn?.rating || entity.spec?.classRating,
    schedule: entity.material?.schedule,
    wallThicknessMm: entity.material?.wallThicknessMm,
    connectionType: entity.connection?.connectionType,
  });
}

/**
 * Adapte le catalogue standardisé Trouvay & Cauvin en collection de PdiCatalogComponent (ARCH-06 §16).
 * RÈGLE : Préserve strictement les données sans inventer de preuve normative ou de conformité automatique.
 */
export function adaptTrouvayCauvinCatalogToPdiCatalog(
  catalogMap: Record<IsoFittingType, any> = PDI_INTERNATIONAL_PIPING_CATALOG
): readonly PdiCatalogComponent[] {
  const result: PdiCatalogComponent[] = [];

  for (const [key, compDef] of Object.entries(catalogMap)) {
    if (!compDef || !Array.isArray(compDef.dimensions)) continue;

    let componentType: PdiCatalogComponentType = "OTHER";
    if (compDef.category === "Tés & Piquages") componentType = "TEE";
    else if (compDef.category === "Coudes & Cintres") componentType = "ELBOW";
    else if (compDef.category === "Réductions & Fonds") componentType = "REDUCER";
    else if (compDef.category === "Robinetterie Industrielle") componentType = "VALVE";
    else if (compDef.category === "Brides & Raccordements") componentType = "FLANGE";
    else if (compDef.category === "Instrumentation & Ligne") componentType = "INSTRUMENT";

    for (const dim of compDef.dimensions) {
      const id = `${compDef.code}_DN${dim.dn}_${dim.nps.replace(/[^a-zA-Z0-9]/g, "")}`;
      
      const comp = createCatalogComponent({
        id,
        componentType,
        description: `${compDef.labelFr} DN${dim.dn} (${dim.nps})`,
        shortName: compDef.shortName,
        standard: compDef.standard,
        material: compDef.materialDefault,
        nominalDiameter: dim.dn,
        nominalDiameterUnit: "mm",
        nominalSize: dim.nps,
        outerDiameterMm: dim.odMm,
        pressureClass: Array.isArray(compDef.pressureClasses) && compDef.pressureClasses.length > 0 ? compDef.pressureClasses[0] : undefined,
        connectionType: compDef.connectionDefault,
        weightKg: dim.weightKg,
        evidenceIds: undefined, // ARCH-06 §16 : Catalogue ≠ Preuve normative automatique
      });

      result.push(comp);
    }
  }

  return Object.freeze(result);
}

/**
 * Adapte un PdiCatalogComponent en ComponentCandidate pour intégration dans NORM-14 / COMPONENT-01..05.
 */
export function adaptCatalogComponentToCandidate(
  component: PdiCatalogComponent
): ComponentCandidate {
  if (!component || !isValidStableId(component.id)) {
    throw new Error("[ARCH-06] Cannot adapt invalid catalog component to normative candidate.");
  }

  let compType: ComponentType = "FITTING";
  if (component.componentType === "PIPE") compType = "PIPE";
  else if (component.componentType === "FLANGE") compType = "FLANGE";
  else if (component.componentType === "VALVE") compType = "VALVE";

  return Object.freeze({
    candidateId: component.id,
    componentType: compType,
    productStandardId: component.standard,
    dimensionalStandardId: component.standard,
    fittingType: component.componentType === "TEE" ? "TEE" : component.componentType === "ELBOW" ? "ELBOW" : undefined,
    valveType: component.componentType === "VALVE" ? "GATE" : undefined,
    connectionType: component.connectionType,
    nominalSize: component.nominalSize || (component.nominalDiameter !== undefined ? `DN${component.nominalDiameter}` : undefined),
    schedule: component.schedule,
    ratingSystem: component.pressureClass ? "ASME_CLASS" : undefined,
    ratingValue: component.pressureClass,
    materialId: component.material,
    evidenceIds: component.evidenceIds,
    sourceReference: component.manufacturer ? `Catalog: ${component.manufacturer}` : undefined,
  });
}
