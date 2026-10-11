/**
 * PDI ENGINEERING PLATFORM — PIPELINE ENGINEERING MODEL VALIDATOR (ARCH-10)
 * Reference: ARCH-10 (Pipeline Engineering Model)
 *
 * Validateur déterministe, sans effet de bord et sans mutation des entrées
 * pour `PipelineSystem`, `PipelineSegment`, `PipelineNode` et `PipelineServiceFluidDeclaration`.
 *
 * CONTRÔLES EFFECTUÉS (ARCH-10 §4.5 & §5) :
 * 1. Intégrité des identifiants obligatoires et détection des doublons (`DUPLICATE_NODE_ID`, `DUPLICATE_SEGMENT_ID`).
 * 2. Cohérence d'appartenance au système (`NODE_SYSTEM_ID_MISMATCH`, `SEGMENT_SYSTEM_ID_MISMATCH`).
 * 3. Intégrité référentielle nœuds <-> tronçons (`SEGMENT_REFERENCES_UNKNOWN_START_NODE`,
 *    `SEGMENT_REFERENCES_UNKNOWN_END_NODE`, `NODE_REFERENCES_UNKNOWN_SEGMENT`,
 *    `NODE_SEGMENT_INCIDENCE_MISMATCH`, `SEGMENT_SELF_LOOP_NOT_ALLOWED`).
 * 4. Validation stricte des grandeurs physiques et de leurs unités explicites :
 *    - Rejet des nombres non finis (`NaN`, `Infinity`, `-Infinity` -> `NON_FINITE_NUMERIC_VALUE`).
 *    - Rejet des longueurs de tronçons négatives ou nulles (`NEGATIVE_OR_ZERO_SEGMENT_LENGTH`).
 *    - Rejet des diamètres ou épaisseurs négatifs ou nuls (`INVALID_PHYSICAL_QUANTITY`).
 *    - Rejet de toute grandeur physique sans unité explicite reconnue (`MISSING_EXPLICIT_PHYSICAL_UNIT`, `UNSUPPORTED_PHYSICAL_UNIT`).
 * 5. Validation de la déclaration de fluide/service (`PipelineFluidCategory`, fraction H2).
 *    - Rejet de toute auto-qualification normative ou auto-vérification (`DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM`,
 *      `DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION`).
 * 6. Isolation des couches (Couche A Engineering vs Couche C Commercial vs Couche D Client) :
 *    - Rejet des champs commerciaux/prix et des identités de clients historiques.
 * 7. Analyse topologique non destructive :
 *    - Les nœuds isolés, sous-réseaux déconnectés et boucles maillées sont **autorisés**
 *      (topologies industrielles valides en cours de conception ou réseaux maillés)
 *      et signalés explicitement dans `topologyNotices` et `topologySummary`.
 * 8. Zéro mutation : les objets reçus en entrée ne sont jamais modifiés ni réparés silencieusement.
 */

import type {
  PipelineDimensionUnit,
  PipelineFluidCategory,
  PipelineFluidPhase,
  PipelineLengthUnit,
  PipelineModelValidationError,
  PipelineModelValidationErrorCode,
  PipelineNetworkTopologySummary,
  PipelineNode,
  PipelineNodeKind,
  PipelinePressureUnit,
  PipelineSegment,
  PipelineServiceFluidDeclaration,
  PipelineSystem,
  PipelineSystemValidationResult,
  PipelineTemperatureUnit,
  PipelineTopologyNotice,
} from "../types/pipelineEngineeringModelTypes";
import { FORBIDDEN_HISTORICAL_CLIENT_PATTERNS } from "../../model/pdiIndustrialArchitectureAdapter";

export const ALLOWED_PIPELINE_LENGTH_UNITS: readonly PipelineLengthUnit[] = Object.freeze([
  "m",
  "km",
  "ft",
  "mi",
]);

export const ALLOWED_PIPELINE_DIMENSION_UNITS: readonly PipelineDimensionUnit[] = Object.freeze([
  "mm",
  "in",
]);

export const ALLOWED_PIPELINE_PRESSURE_UNITS: readonly PipelinePressureUnit[] = Object.freeze([
  "bar",
  "MPa",
  "kPa",
  "psi",
]);

export const ALLOWED_PIPELINE_TEMPERATURE_UNITS: readonly PipelineTemperatureUnit[] = Object.freeze([
  "C",
  "F",
  "K",
]);

export const ALLOWED_PIPELINE_FLUID_CATEGORIES: readonly PipelineFluidCategory[] = Object.freeze([
  "NATURAL_GAS",
  "HYDROGEN",
  "NATURAL_GAS_HYDROGEN_BLEND",
  "LIQUID_HYDROCARBON",
  "MULTIPHASE",
  "WATER",
  "CO2",
  "OTHER",
]);

export const ALLOWED_PIPELINE_FLUID_PHASES: readonly PipelineFluidPhase[] = Object.freeze([
  "GAS",
  "LIQUID",
  "MULTIPHASE",
  "SUPERCRITICAL",
]);

export const ALLOWED_PIPELINE_NODE_KINDS: readonly PipelineNodeKind[] = Object.freeze([
  "TERMINAL_INLET",
  "TERMINAL_OUTLET",
  "JUNCTION",
  "BLOCK_VALVE_STATION",
  "COMPRESSOR_STATION",
  "PUMP_STATION",
  "METERING_REGULATING_STATION",
  "PIG_TRAP_LAUNCHER",
  "PIG_TRAP_RECEIVER",
  "FIELD_BEND",
  "TRANSITION_POINT",
  "GENERIC_NODE",
]);

const FORBIDDEN_COMMERCIAL_FIELDS: readonly string[] = Object.freeze([
  "unitPrice",
  "unitRate",
  "price",
  "prix",
  "currency",
  "currencyCode",
  "devise",
  "costEstimation",
  "amountExclTax",
  "totalHt",
  "totalTtc",
  "supplierPrice",
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushError(
  errors: PipelineModelValidationError[],
  code: PipelineModelValidationErrorCode,
  path: string,
  message: string,
  entityId?: string
): void {
  errors.push(
    Object.freeze({
      code,
      path,
      entityId,
      message,
    })
  );
}

function inspectLayerViolations(
  raw: Record<string, unknown>,
  path: string,
  entityId: string | undefined,
  errors: PipelineModelValidationError[]
): void {
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_COMMERCIAL_FIELDS.includes(key) && raw[key] !== undefined) {
      pushError(
        errors,
        "DISALLOWED_COMMERCIAL_FIELD_IN_ENGINEERING_MODEL",
        `${path}.${key}`,
        `Interdiction (ARCH-10 §5 Couche A vs Couche C) : le champ commercial '${key}' est interdit dans le modèle d'ingénierie Pipeline.`,
        entityId
      );
    }
  }

  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
        if (pattern.test(val)) {
          pushError(
            errors,
            "DISALLOWED_CLIENT_IDENTITY_IN_ENGINEERING_MODEL",
            `${path}.${key}`,
            `Interdiction (ARCH-07 / ARCH-10 §5) : référence client historique interdite détectée dans '${path}.${key}'.`,
            entityId
          );
          break;
        }
      }
    }
  }
}

function validateExplicitQuantity<U extends string>(
  rawQuantity: unknown,
  allowedUnits: readonly U[],
  path: string,
  entityId: string | undefined,
  errors: PipelineModelValidationError[],
  options: {
    readonly allowZero?: boolean;
    readonly allowNegative?: boolean;
    readonly isSegmentLength?: boolean;
  } = {}
): void {
  if (!isPlainRecord(rawQuantity)) {
    pushError(
      errors,
      "INVALID_PHYSICAL_QUANTITY",
      path,
      `La grandeur physique '${path}' doit être un objet { value, unit } explicite.`,
      entityId
    );
    return;
  }

  const rawValue = rawQuantity.value;
  const rawUnit = rawQuantity.unit;

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    pushError(
      errors,
      "NON_FINITE_NUMERIC_VALUE",
      `${path}.value`,
      `La valeur numérique de '${path}.value' doit être un nombre fini (reçu: ${String(rawValue)}).`,
      entityId
    );
  } else {
    const allowZero = options.allowZero ?? false;
    const allowNegative = options.allowNegative ?? false;

    if (!allowNegative && rawValue < 0) {
      pushError(
        errors,
        options.isSegmentLength ? "NEGATIVE_OR_ZERO_SEGMENT_LENGTH" : "INVALID_PHYSICAL_QUANTITY",
        `${path}.value`,
        `La valeur physique '${path}.value' ne peut pas être négative (${rawValue}).`,
        entityId
      );
    } else if (!allowZero && rawValue === 0) {
      pushError(
        errors,
        options.isSegmentLength ? "NEGATIVE_OR_ZERO_SEGMENT_LENGTH" : "INVALID_PHYSICAL_QUANTITY",
        `${path}.value`,
        `La valeur physique '${path}.value' doit être strictement positive (${rawValue}).`,
        entityId
      );
    }
  }

  if (!isNonEmptyString(rawUnit)) {
    pushError(
      errors,
      "MISSING_EXPLICIT_PHYSICAL_UNIT",
      `${path}.unit`,
      `L'unité explicite '${path}.unit' est obligatoire (aucune supposition d'unité implicite n'est autorisée).`,
      entityId
    );
  } else if (!allowedUnits.includes(rawUnit as U)) {
    pushError(
      errors,
      "UNSUPPORTED_PHYSICAL_UNIT",
      `${path}.unit`,
      `Unité '${rawUnit}' non supportée pour '${path}'. Unités admises: ${allowedUnits.join(", ")}.`,
      entityId
    );
  }
}

/**
 * Valide une déclaration de fluide / service (`PipelineServiceFluidDeclaration`).
 */
export function validatePipelineServiceFluidDeclaration(
  rawService: unknown,
  path: string,
  entityId: string | undefined,
  errors: PipelineModelValidationError[]
): void {
  if (!isPlainRecord(rawService)) {
    pushError(
      errors,
      "INVALID_SERVICE_FLUID_CATEGORY",
      path,
      `La déclaration de service '${path}' doit être un objet structuré.`,
      entityId
    );
    return;
  }

  inspectLayerViolations(rawService, path, entityId, errors);

  if (
    !isNonEmptyString(rawService.fluidCategory) ||
    !ALLOWED_PIPELINE_FLUID_CATEGORIES.includes(
      rawService.fluidCategory as PipelineFluidCategory
    )
  ) {
    pushError(
      errors,
      "INVALID_SERVICE_FLUID_CATEGORY",
      `${path}.fluidCategory`,
      `Catégorie de fluide invalide ou manquante dans '${path}.fluidCategory'. Attendu l'un de: ${ALLOWED_PIPELINE_FLUID_CATEGORIES.join(", ")}.`,
      entityId
    );
  }

  if (
    rawService.phase !== undefined &&
    (!isNonEmptyString(rawService.phase) ||
      !ALLOWED_PIPELINE_FLUID_PHASES.includes(rawService.phase as PipelineFluidPhase))
  ) {
    pushError(
      errors,
      "INVALID_SERVICE_FLUID_CATEGORY",
      `${path}.phase`,
      `Phase de fluide invalide dans '${path}.phase'.`,
      entityId
    );
  }

  if (rawService.fluidCategory === "NATURAL_GAS_HYDROGEN_BLEND") {
    const h2 = rawService.hydrogenMoleFractionPercent;
    if (h2 === undefined) {
      pushError(
        errors,
        "INVALID_HYDROGEN_BLEND_FRACTION",
        `${path}.hydrogenMoleFractionPercent`,
        "Pour un mélange NATURAL_GAS_HYDROGEN_BLEND, hydrogenMoleFractionPercent est obligatoire et doit appartenir à ]0, 100[.",
        entityId
      );
    } else if (typeof h2 !== "number" || !Number.isFinite(h2)) {
      pushError(
        errors,
        "NON_FINITE_NUMERIC_VALUE",
        `${path}.hydrogenMoleFractionPercent`,
        "hydrogenMoleFractionPercent doit être un nombre fini.",
        entityId
      );
    } else if (h2 <= 0 || h2 >= 100) {
      pushError(
        errors,
        "INVALID_HYDROGEN_BLEND_FRACTION",
        `${path}.hydrogenMoleFractionPercent`,
        `Pour un mélange NATURAL_GAS_HYDROGEN_BLEND, hydrogenMoleFractionPercent doit appartenir à ]0, 100[ (reçu: ${h2}).`,
        entityId
      );
    }
  } else if (rawService.hydrogenMoleFractionPercent !== undefined) {
    const h2 = rawService.hydrogenMoleFractionPercent;
    if (typeof h2 !== "number" || !Number.isFinite(h2)) {
      pushError(
        errors,
        "NON_FINITE_NUMERIC_VALUE",
        `${path}.hydrogenMoleFractionPercent`,
        "hydrogenMoleFractionPercent doit être un nombre fini.",
        entityId
      );
    } else if (h2 < 0 || h2 > 100) {
      pushError(
        errors,
        "INVALID_HYDROGEN_BLEND_FRACTION",
        `${path}.hydrogenMoleFractionPercent`,
        `hydrogenMoleFractionPercent doit être compris entre 0 et 100 (reçu: ${h2}).`,
        entityId
      );
    } else if (rawService.fluidCategory === "HYDROGEN" && h2 < 100) {
      pushError(
        errors,
        "INVALID_HYDROGEN_BLEND_FRACTION",
        `${path}.hydrogenMoleFractionPercent`,
        `Un fluide déclaré HYDROGEN pur ne peut pas déclarer hydrogenMoleFractionPercent < 100 (reçu: ${h2}). Pour un mélange, utiliser NATURAL_GAS_HYDROGEN_BLEND ou OTHER.`,
        entityId
      );
    } else if (
      (rawService.fluidCategory === "NATURAL_GAS" ||
        rawService.fluidCategory === "LIQUID_HYDROCARBON" ||
        rawService.fluidCategory === "WATER" ||
        rawService.fluidCategory === "CO2") &&
      h2 > 0
    ) {
      pushError(
        errors,
        "INVALID_HYDROGEN_BLEND_FRACTION",
        `${path}.hydrogenMoleFractionPercent`,
        `Un fluide déclaré ${String(
          rawService.fluidCategory
        )} ne peut pas déclarer une fraction d'hydrogène > 0 (reçu: ${h2}).`,
        entityId
      );
    }
  }

  // Interdiction d'auto-certification de la donnée déclarée
  if (
    rawService.verificationState !== undefined &&
    rawService.verificationState !== "DECLARED_UNVERIFIED"
  ) {
    pushError(
      errors,
      "DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM",
      `${path}.verificationState`,
      `Interdiction (ARCH-10 §5) : une donnée déclarée dans le modèle d'ingénierie ne peut pas être marquée '${String(
        rawService.verificationState
      )}'. Seul 'DECLARED_UNVERIFIED' est autorisé.`,
      entityId
    );
  }

  if ("verified" in rawService && rawService.verified === true) {
    pushError(
      errors,
      "DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM",
      `${path}.verified`,
      "Interdiction (ARCH-10 §5) : le modèle métier ne peut pas déclarer une donnée comme automatiquement vérifiée.",
      entityId
    );
  }

  if (rawService.designPressure !== undefined) {
    validateExplicitQuantity(
      rawService.designPressure,
      ALLOWED_PIPELINE_PRESSURE_UNITS,
      `${path}.designPressure`,
      entityId,
      errors,
      { allowZero: true, allowNegative: false }
    );
  }

  if (rawService.operatingPressure !== undefined) {
    validateExplicitQuantity(
      rawService.operatingPressure,
      ALLOWED_PIPELINE_PRESSURE_UNITS,
      `${path}.operatingPressure`,
      entityId,
      errors,
      { allowZero: true, allowNegative: false }
    );
  }

  if (rawService.designTemperature !== undefined) {
    validateExplicitQuantity(
      rawService.designTemperature,
      ALLOWED_PIPELINE_TEMPERATURE_UNITS,
      `${path}.designTemperature`,
      entityId,
      errors,
      { allowZero: true, allowNegative: true }
    );
  }

  if (rawService.operatingTemperature !== undefined) {
    validateExplicitQuantity(
      rawService.operatingTemperature,
      ALLOWED_PIPELINE_TEMPERATURE_UNITS,
      `${path}.operatingTemperature`,
      entityId,
      errors,
      { allowZero: true, allowNegative: true }
    );
  }
}

function validateTraceabilityRefs(
  rawRefs: unknown,
  path: string,
  entityId: string | undefined,
  errors: PipelineModelValidationError[]
): void {
  if (!isPlainRecord(rawRefs)) {
    pushError(
      errors,
      "INVALID_TRACEABILITY_REFS",
      path,
      `Les références de traçabilité '${path}' doivent être un objet structuré.`,
      entityId
    );
    return;
  }

  if (rawRefs.designCodeRef !== undefined && !isNonEmptyString(rawRefs.designCodeRef)) {
    pushError(
      errors,
      "INVALID_TRACEABILITY_REFS",
      `${path}.designCodeRef`,
      "designCodeRef doit être une chaîne non vide lorsqu'il est renseigné.",
      entityId
    );
  }

  if (rawRefs.pipingSpecId !== undefined && !isNonEmptyString(rawRefs.pipingSpecId)) {
    pushError(
      errors,
      "INVALID_TRACEABILITY_REFS",
      `${path}.pipingSpecId`,
      "pipingSpecId doit être une chaîne non vide lorsqu'il est renseigné.",
      entityId
    );
  }

  if (rawRefs.sourceDocumentIds !== undefined) {
    if (
      !Array.isArray(rawRefs.sourceDocumentIds) ||
      rawRefs.sourceDocumentIds.some((id) => !isNonEmptyString(id))
    ) {
      pushError(
        errors,
        "INVALID_TRACEABILITY_REFS",
        `${path}.sourceDocumentIds`,
        "sourceDocumentIds doit être un tableau de chaînes non vides.",
        entityId
      );
    }
  }

  if (rawRefs.evidenceIds !== undefined) {
    if (
      !Array.isArray(rawRefs.evidenceIds) ||
      rawRefs.evidenceIds.some((id) => !isNonEmptyString(id))
    ) {
      pushError(
        errors,
        "INVALID_TRACEABILITY_REFS",
        `${path}.evidenceIds`,
        "evidenceIds doit être un tableau de chaînes non vides.",
        entityId
      );
    }
  }
}

/**
 * Valide un nœud individuel `PipelineNode`.
 */
export function validatePipelineNode(
  rawNode: unknown,
  expectedSystemId?: string,
  path: string = "node"
): readonly PipelineModelValidationError[] {
  const errors: PipelineModelValidationError[] = [];
  validatePipelineNodeInternal(rawNode, expectedSystemId, path, errors);
  return Object.freeze(errors);
}

function validatePipelineNodeInternal(
  rawNode: unknown,
  expectedSystemId: string | undefined,
  path: string,
  errors: PipelineModelValidationError[]
): string | undefined {
  if (!isPlainRecord(rawNode)) {
    pushError(
      errors,
      "INVALID_NODE_OBJECT",
      path,
      "Chaque nœud du pipeline doit être un objet structuré non-null."
    );
    return undefined;
  }

  const nodeId = isNonEmptyString(rawNode.id) ? rawNode.id.trim() : undefined;
  inspectLayerViolations(rawNode, path, nodeId, errors);

  if (!nodeId) {
    pushError(
      errors,
      "MISSING_NODE_ID",
      `${path}.id`,
      "L'identifiant du nœud (node.id) est obligatoire et doit être une chaîne non vide."
    );
  }

  if (!isNonEmptyString(rawNode.name)) {
    pushError(
      errors,
      "MISSING_NODE_NAME",
      `${path}.name`,
      "Le nom ou libellé du nœud (node.name) est obligatoire.",
      nodeId
    );
  }

  if (!isNonEmptyString(rawNode.systemId)) {
    pushError(
      errors,
      "MISSING_NODE_SYSTEM_ID",
      `${path}.systemId`,
      "Le champ node.systemId est obligatoire.",
      nodeId
    );
  } else if (expectedSystemId && rawNode.systemId.trim() !== expectedSystemId) {
    pushError(
      errors,
      "NODE_SYSTEM_ID_MISMATCH",
      `${path}.systemId`,
      `Le nœud '${nodeId ?? "?"}' référence le système '${rawNode.systemId}' au lieu du système attendu '${expectedSystemId}'.`,
      nodeId
    );
  }

  if (
    rawNode.kind !== undefined &&
    (!isNonEmptyString(rawNode.kind) ||
      !ALLOWED_PIPELINE_NODE_KINDS.includes(rawNode.kind as PipelineNodeKind))
  ) {
    pushError(
      errors,
      "INVALID_NODE_OBJECT",
      `${path}.kind`,
      `Type de nœud invalide: '${String(rawNode.kind)}'.`,
      nodeId
    );
  }

  if (rawNode.connectedSegmentIds !== undefined) {
    if (
      !Array.isArray(rawNode.connectedSegmentIds) ||
      rawNode.connectedSegmentIds.some((sid) => !isNonEmptyString(sid))
    ) {
      pushError(
        errors,
        "INVALID_NODE_OBJECT",
        `${path}.connectedSegmentIds`,
        "connectedSegmentIds doit être un tableau d'identifiants de tronçons non vides.",
        nodeId
      );
    } else {
      const seenSegRefs = new Set<string>();
      for (let idx = 0; idx < rawNode.connectedSegmentIds.length; idx++) {
        const trimmedRef = rawNode.connectedSegmentIds[idx].trim();
        if (seenSegRefs.has(trimmedRef)) {
          pushError(
            errors,
            "NODE_SEGMENT_INCIDENCE_MISMATCH",
            `${path}.connectedSegmentIds[${idx}]`,
            `Le nœud '${nodeId ?? "?"}' contient une référence dupliquée au tronçon '${trimmedRef}' dans connectedSegmentIds.`,
            nodeId
          );
        } else {
          seenSegRefs.add(trimmedRef);
        }
      }
    }
  }

  if (rawNode.stationPoint !== undefined) {
    validateExplicitQuantity(
      rawNode.stationPoint,
      ALLOWED_PIPELINE_LENGTH_UNITS,
      `${path}.stationPoint`,
      nodeId,
      errors,
      { allowZero: true, allowNegative: false }
    );
  }

  if (rawNode.coordinates !== undefined) {
    if (!isPlainRecord(rawNode.coordinates)) {
      pushError(
        errors,
        "INVALID_NODE_COORDINATES",
        `${path}.coordinates`,
        "coordinates doit être un objet structuré { x, y, z?, elevation?, unit }.",
        nodeId
      );
    } else {
      const coords = rawNode.coordinates;
      if (typeof coords.x !== "number" || !Number.isFinite(coords.x)) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.coordinates.x`,
          "coordinates.x doit être un nombre fini.",
          nodeId
        );
      }
      if (typeof coords.y !== "number" || !Number.isFinite(coords.y)) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.coordinates.y`,
          "coordinates.y doit être un nombre fini.",
          nodeId
        );
      }
      if (coords.z !== undefined && (typeof coords.z !== "number" || !Number.isFinite(coords.z))) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.coordinates.z`,
          "coordinates.z doit être un nombre fini.",
          nodeId
        );
      }
      if (
        coords.elevation !== undefined &&
        (typeof coords.elevation !== "number" || !Number.isFinite(coords.elevation))
      ) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.coordinates.elevation`,
          "coordinates.elevation doit être un nombre fini.",
          nodeId
        );
      }
      if (!isNonEmptyString(coords.unit)) {
        pushError(
          errors,
          "MISSING_EXPLICIT_PHYSICAL_UNIT",
          `${path}.coordinates.unit`,
          "coordinates.unit est obligatoire.",
          nodeId
        );
      } else if (!ALLOWED_PIPELINE_LENGTH_UNITS.includes(coords.unit as PipelineLengthUnit)) {
        pushError(
          errors,
          "UNSUPPORTED_PHYSICAL_UNIT",
          `${path}.coordinates.unit`,
          `Unité de coordonnées non supportée: '${String(coords.unit)}'.`,
          nodeId
        );
      }
    }
  }

  if (rawNode.traceabilityRefs !== undefined) {
    validateTraceabilityRefs(
      rawNode.traceabilityRefs,
      `${path}.traceabilityRefs`,
      nodeId,
      errors
    );
  }

  return nodeId;
}

/**
 * Valide un tronçon individuel `PipelineSegment` (hors contrôle d'existence des nœuds dans le système).
 */
export function validatePipelineSegment(
  rawSegment: unknown,
  expectedSystemId?: string,
  path: string = "segment"
): readonly PipelineModelValidationError[] {
  const errors: PipelineModelValidationError[] = [];
  validatePipelineSegmentInternal(rawSegment, expectedSystemId, path, errors);
  return Object.freeze(errors);
}

function validatePipelineSegmentInternal(
  rawSegment: unknown,
  expectedSystemId: string | undefined,
  path: string,
  errors: PipelineModelValidationError[]
): string | undefined {
  if (!isPlainRecord(rawSegment)) {
    pushError(
      errors,
      "INVALID_SEGMENT_OBJECT",
      path,
      "Chaque tronçon du pipeline doit être un objet structuré non-null."
    );
    return undefined;
  }

  const segId = isNonEmptyString(rawSegment.id) ? rawSegment.id.trim() : undefined;
  inspectLayerViolations(rawSegment, path, segId, errors);

  if (!segId) {
    pushError(
      errors,
      "MISSING_SEGMENT_ID",
      `${path}.id`,
      "L'identifiant du tronçon (segment.id) est obligatoire et doit être une chaîne non vide."
    );
  }

  if (!isNonEmptyString(rawSegment.name)) {
    pushError(
      errors,
      "MISSING_SEGMENT_NAME",
      `${path}.name`,
      "Le nom ou libellé du tronçon (segment.name) est obligatoire.",
      segId
    );
  }

  if (!isNonEmptyString(rawSegment.systemId)) {
    pushError(
      errors,
      "MISSING_SEGMENT_SYSTEM_ID",
      `${path}.systemId`,
      "Le champ segment.systemId est obligatoire.",
      segId
    );
  } else if (expectedSystemId && rawSegment.systemId.trim() !== expectedSystemId) {
    pushError(
      errors,
      "SEGMENT_SYSTEM_ID_MISMATCH",
      `${path}.systemId`,
      `Le tronçon '${segId ?? "?"}' référence le système '${rawSegment.systemId}' au lieu du système attendu '${expectedSystemId}'.`,
      segId
    );
  }

  const startNodeId = isNonEmptyString(rawSegment.startNodeId)
    ? rawSegment.startNodeId.trim()
    : undefined;
  const endNodeId = isNonEmptyString(rawSegment.endNodeId)
    ? rawSegment.endNodeId.trim()
    : undefined;

  if (!startNodeId) {
    pushError(
      errors,
      "MISSING_SEGMENT_START_NODE_ID",
      `${path}.startNodeId`,
      "Le nœud de départ (segment.startNodeId) est obligatoire.",
      segId
    );
  }

  if (!endNodeId) {
    pushError(
      errors,
      "MISSING_SEGMENT_END_NODE_ID",
      `${path}.endNodeId`,
      "Le nœud d'arrivée (segment.endNodeId) est obligatoire.",
      segId
    );
  }

  if (startNodeId && endNodeId && startNodeId === endNodeId) {
    pushError(
      errors,
      "SEGMENT_SELF_LOOP_NOT_ALLOWED",
      path,
      `Le tronçon '${segId ?? "?"}' a le même nœud de départ et d'arrivée ('${startNodeId}'). Un tronçon doit relier deux nœuds distincts.`,
      segId
    );
  }

  // Validation de la longueur si fournie
  if (rawSegment.length !== undefined) {
    validateExplicitQuantity(
      rawSegment.length,
      ALLOWED_PIPELINE_LENGTH_UNITS,
      `${path}.length`,
      segId,
      errors,
      { allowZero: false, allowNegative: false, isSegmentLength: true }
    );
  }

  // Validation des dimensions physiques si fournies
  if (rawSegment.dimensions !== undefined) {
    if (!isPlainRecord(rawSegment.dimensions)) {
      pushError(
        errors,
        "INVALID_PHYSICAL_QUANTITY",
        `${path}.dimensions`,
        "dimensions doit être un objet structuré.",
        segId
      );
    } else {
      const dims = rawSegment.dimensions;
      inspectLayerViolations(dims, `${path}.dimensions`, segId, errors);

      if (dims.nominalDiameter !== undefined) {
        validateExplicitQuantity(
          dims.nominalDiameter,
          ALLOWED_PIPELINE_DIMENSION_UNITS,
          `${path}.dimensions.nominalDiameter`,
          segId,
          errors,
          { allowZero: false, allowNegative: false }
        );
      }

      if (dims.outerDiameter !== undefined) {
        validateExplicitQuantity(
          dims.outerDiameter,
          ALLOWED_PIPELINE_DIMENSION_UNITS,
          `${path}.dimensions.outerDiameter`,
          segId,
          errors,
          { allowZero: false, allowNegative: false }
        );
      }

      if (dims.wallThickness !== undefined) {
        validateExplicitQuantity(
          dims.wallThickness,
          ALLOWED_PIPELINE_DIMENSION_UNITS,
          `${path}.dimensions.wallThickness`,
          segId,
          errors,
          { allowZero: false, allowNegative: false }
        );
      }

      if (dims.corrosionAllowance !== undefined) {
        validateExplicitQuantity(
          dims.corrosionAllowance,
          ALLOWED_PIPELINE_DIMENSION_UNITS,
          `${path}.dimensions.corrosionAllowance`,
          segId,
          errors,
          { allowZero: true, allowNegative: false }
        );
      }

      // Cohérence géométrique élémentaire lorsque outerDiameter et wallThickness sont dans la même unité :
      // 2 * wallThickness < outerDiameter
      if (
        isPlainRecord(dims.outerDiameter) &&
        isPlainRecord(dims.wallThickness) &&
        typeof dims.outerDiameter.value === "number" &&
        typeof dims.wallThickness.value === "number" &&
        Number.isFinite(dims.outerDiameter.value) &&
        Number.isFinite(dims.wallThickness.value) &&
        dims.outerDiameter.value > 0 &&
        dims.wallThickness.value > 0 &&
        dims.outerDiameter.unit === dims.wallThickness.unit &&
        2 * dims.wallThickness.value >= dims.outerDiameter.value
      ) {
        pushError(
          errors,
          "INVALID_PHYSICAL_QUANTITY",
          `${path}.dimensions.wallThickness`,
          `Incohérence dimensionnelle : 2 × wallThickness (${2 * dims.wallThickness.value} ${String(
            dims.wallThickness.unit
          )}) >= outerDiameter (${dims.outerDiameter.value} ${String(dims.outerDiameter.unit)}).`,
          segId
        );
      }
    }
  }

  // Validation du matériau déclaré (interdiction d'auto-qualification ou de compatibilité H2 implicite)
  if (rawSegment.material !== undefined) {
    if (!isPlainRecord(rawSegment.material)) {
      pushError(
        errors,
        "INVALID_SEGMENT_OBJECT",
        `${path}.material`,
        "material doit être un objet structuré.",
        segId
      );
    } else {
      const mat = rawSegment.material;
      inspectLayerViolations(mat, `${path}.material`, segId, errors);

      if (
        mat.normativeQualificationStatus !== undefined &&
        mat.normativeQualificationStatus !== "NOT_EVALUATED_IN_ENGINEERING_MODEL"
      ) {
        pushError(
          errors,
          "DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION",
          `${path}.material.normativeQualificationStatus`,
          `Interdiction (ARCH-10 §4.2 & §5) : un matériau déclaré dans le modèle d'ingénierie ne peut pas revendiquer le statut '${String(
            mat.normativeQualificationStatus
          )}'.`,
          segId
        );
      }

      if (
        mat.fluidCompatibilityStatus !== undefined &&
        mat.fluidCompatibilityStatus !== "NOT_EVALUATED_IN_ENGINEERING_MODEL"
      ) {
        pushError(
          errors,
          "DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION",
          `${path}.material.fluidCompatibilityStatus`,
          `Interdiction (ARCH-10 §4.4 & §5) : aucune compatibilité fluide/matériau (notamment H2) ne peut être qualifiée dans le modèle d'ingénierie ('${String(
            mat.fluidCompatibilityStatus
          )}').`,
          segId
        );
      }

      if (
        ("isHydrogenCompatible" in mat && mat.isHydrogenCompatible === true) ||
        ("isNormativelyQualified" in mat && mat.isNormativelyQualified === true) ||
        ("verified" in mat && mat.verified === true)
      ) {
        pushError(
          errors,
          "DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION",
          `${path}.material`,
          "Interdiction (ARCH-10 §4.4) : un matériau déclaré ne peut pas être marqué compatible hydrogène ou normativement qualifié sans évaluation par le moteur normatif.",
          segId
        );
      }
    }
  }

  // Validation du service/fluide au niveau du tronçon
  if (rawSegment.service !== undefined) {
    validatePipelineServiceFluidDeclaration(
      rawSegment.service,
      `${path}.service`,
      segId,
      errors
    );
  }

  // Validation des attributs de domaine ARCH-08 s'ils sont fournis
  if (rawSegment.domainAttributes !== undefined) {
    if (!isPlainRecord(rawSegment.domainAttributes)) {
      pushError(
        errors,
        "INVALID_DOMAIN_ATTRIBUTES",
        `${path}.domainAttributes`,
        "domainAttributes doit être un objet structuré.",
        segId
      );
    } else {
      const da = rawSegment.domainAttributes;
      inspectLayerViolations(da, `${path}.domainAttributes`, segId, errors);

      if (
        da.kilometerPointStart !== undefined &&
        (typeof da.kilometerPointStart !== "number" || !Number.isFinite(da.kilometerPointStart) || da.kilometerPointStart < 0)
      ) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.domainAttributes.kilometerPointStart`,
          "kilometerPointStart doit être un nombre fini >= 0.",
          segId
        );
      }

      if (
        da.kilometerPointEnd !== undefined &&
        (typeof da.kilometerPointEnd !== "number" || !Number.isFinite(da.kilometerPointEnd) || da.kilometerPointEnd < 0)
      ) {
        pushError(
          errors,
          "NON_FINITE_NUMERIC_VALUE",
          `${path}.domainAttributes.kilometerPointEnd`,
          "kilometerPointEnd doit être un nombre fini >= 0.",
          segId
        );
      }

      if (
        da.burialDepthMeters !== undefined &&
        (typeof da.burialDepthMeters !== "number" || !Number.isFinite(da.burialDepthMeters) || da.burialDepthMeters < 0)
      ) {
        pushError(
          errors,
          "INVALID_DOMAIN_ATTRIBUTES",
          `${path}.domainAttributes.burialDepthMeters`,
          "burialDepthMeters doit être un nombre fini >= 0.",
          segId
        );
      }

      if (
        da.classLocation !== undefined &&
        da.classLocation !== 1 &&
        da.classLocation !== 2 &&
        da.classLocation !== 3 &&
        da.classLocation !== 4
      ) {
        pushError(
          errors,
          "INVALID_DOMAIN_ATTRIBUTES",
          `${path}.domainAttributes.classLocation`,
          "classLocation doit appartenir à { 1, 2, 3, 4 }.",
          segId
        );
      }
    }
  }

  if (rawSegment.traceabilityRefs !== undefined) {
    validateTraceabilityRefs(
      rawSegment.traceabilityRefs,
      `${path}.traceabilityRefs`,
      segId,
      errors
    );
  }

  return segId;
}

/**
 * Analyse topologique non bloquante (nœuds isolés, composantes connexes, boucles).
 */
function analyzeNetworkTopology(
  validNodes: ReadonlyMap<string, PipelineNode>,
  validSegments: ReadonlyMap<string, PipelineSegment>
): {
  readonly summary: PipelineNetworkTopologySummary;
  readonly notices: readonly PipelineTopologyNotice[];
} {
  const notices: PipelineTopologyNotice[] = [];
  const nodeIds = Array.from(validNodes.keys()).sort();
  const segmentList = Array.from(validSegments.values());

  if (nodeIds.length === 0 && segmentList.length === 0) {
    notices.push(
      Object.freeze({
        code: "EMPTY_PIPELINE_NETWORK",
        entityIds: Object.freeze([]),
        message: "Le système de pipeline ne contient actuellement aucun nœud ni tronçon.",
      })
    );
    return {
      summary: Object.freeze({
        nodeCount: 0,
        segmentCount: 0,
        isolatedNodeIds: Object.freeze([]),
        connectedComponentCount: 0,
        hasLoops: false,
      }),
      notices: Object.freeze(notices),
    };
  }

  const adjacency = new Map<string, Set<string>>();
  const incidentCount = new Map<string, number>();

  for (const nid of nodeIds) {
    adjacency.set(nid, new Set());
    incidentCount.set(nid, 0);
  }

  let validEdgeCount = 0;
  for (const seg of segmentList) {
    const u = seg.startNodeId?.trim();
    const v = seg.endNodeId?.trim();
    if (u && v && validNodes.has(u) && validNodes.has(v) && u !== v) {
      adjacency.get(u)!.add(v);
      adjacency.get(v)!.add(u);
      incidentCount.set(u, (incidentCount.get(u) ?? 0) + 1);
      incidentCount.set(v, (incidentCount.get(v) ?? 0) + 1);
      validEdgeCount++;
    }
  }

  const isolatedNodeIds = nodeIds.filter((nid) => (incidentCount.get(nid) ?? 0) === 0);
  if (isolatedNodeIds.length > 0) {
    notices.push(
      Object.freeze({
        code: "ISOLATED_NODE_DETECTED",
        entityIds: Object.freeze(isolatedNodeIds),
        message: `Nœud(s) isolé(s) sans tronçon connecté détecté(s) : ${isolatedNodeIds.join(", ")}.`,
      })
    );
  }

  // Calcul du nombre de composantes connexes par parcours en largeur (BFS)
  const visited = new Set<string>();
  let connectedComponentCount = 0;

  for (const nid of nodeIds) {
    if (visited.has(nid)) continue;
    connectedComponentCount++;
    const queue: string[] = [nid];
    visited.add(nid);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }

  if (connectedComponentCount > 1) {
    notices.push(
      Object.freeze({
        code: "DISCONNECTED_SUBNETWORKS_DETECTED",
        entityIds: Object.freeze(nodeIds),
        message: `Le réseau comporte ${connectedComponentCount} sous-ensembles topologiquement déconnectés.`,
      })
    );
  }

  // Dans un graphe non orienté à V sommets et C composantes connexes, un cycle existe ssi E > V - C
  const hasLoops =
    nodeIds.length > 0 && validEdgeCount > nodeIds.length - connectedComponentCount;

  if (hasLoops) {
    notices.push(
      Object.freeze({
        code: "LOOP_TOPOLOGY_DETECTED",
        entityIds: Object.freeze(segmentList.map((s) => s.id).sort()),
        message: "Une ou plusieurs boucles fermées (réseau maillé ou parallèle) sont présentes dans le système.",
      })
    );
  }

  return {
    summary: Object.freeze({
      nodeCount: nodeIds.length,
      segmentCount: segmentList.length,
      isolatedNodeIds: Object.freeze(isolatedNodeIds),
      connectedComponentCount,
      hasLoops,
    }),
    notices: Object.freeze(notices),
  };
}

/**
 * Valide intégralement un `PipelineSystem`, ses nœuds, ses tronçons et l'intégrité
 * de ses relations topologiques, sans jamais modifier l'objet d'entrée (ARCH-10 §4.5).
 */
export function validatePipelineSystem(rawSystem: unknown): PipelineSystemValidationResult {
  const errors: PipelineModelValidationError[] = [];

  if (!isPlainRecord(rawSystem)) {
    pushError(
      errors,
      "INVALID_SYSTEM_OBJECT",
      "system",
      "Le système de pipeline doit être un objet structuré non-null et non-tableau."
    );
    return Object.freeze({
      valid: false,
      structuralValidationState: "STRUCTURALLY_INVALID",
      errors: Object.freeze(errors),
      topologyNotices: Object.freeze([]),
      topologySummary: Object.freeze({
        nodeCount: 0,
        segmentCount: 0,
        isolatedNodeIds: Object.freeze([]),
        connectedComponentCount: 0,
        hasLoops: false,
      }),
      normativeQualificationPerformed: false,
      calculationExecuted: false,
    });
  }

  const systemId = isNonEmptyString(rawSystem.id) ? rawSystem.id.trim() : undefined;
  inspectLayerViolations(rawSystem, "system", systemId, errors);

  if (!systemId) {
    pushError(
      errors,
      "MISSING_SYSTEM_ID",
      "system.id",
      "L'identifiant du système (system.id) est obligatoire et doit être une chaîne non vide."
    );
  }

  if (!isNonEmptyString(rawSystem.name)) {
    pushError(
      errors,
      "MISSING_SYSTEM_NAME",
      "system.name",
      "Le nom du système (system.name) est obligatoire.",
      systemId
    );
  }

  // Le domaine d'ingénierie doit obligatoirement être "PIPELINE" (ARCH-10 §4.1)
  if (rawSystem.engineeringDomain !== "PIPELINE") {
    pushError(
      errors,
      "INVALID_ENGINEERING_DOMAIN",
      "system.engineeringDomain",
      `Domaine d'ingénierie invalide pour PipelineSystem: '${String(
        rawSystem.engineeringDomain
      )}'. Attendu obligatoirement: 'PIPELINE'.`,
      systemId
    );
  }

  if (rawSystem.service !== undefined) {
    validatePipelineServiceFluidDeclaration(
      rawSystem.service,
      "system.service",
      systemId,
      errors
    );
  }

  if (rawSystem.traceabilityRefs !== undefined) {
    validateTraceabilityRefs(
      rawSystem.traceabilityRefs,
      "system.traceabilityRefs",
      systemId,
      errors
    );
  }

  const rawNodes = rawSystem.nodes;
  const rawSegments = rawSystem.segments;

  if (!Array.isArray(rawNodes)) {
    pushError(
      errors,
      "INVALID_NODES_COLLECTION",
      "system.nodes",
      "system.nodes doit être un tableau de PipelineNode.",
      systemId
    );
  }

  if (!Array.isArray(rawSegments)) {
    pushError(
      errors,
      "INVALID_SEGMENTS_COLLECTION",
      "system.segments",
      "system.segments doit être un tableau de PipelineSegment.",
      systemId
    );
  }

  const nodeMap = new Map<string, PipelineNode>();
  const segmentMap = new Map<string, PipelineSegment>();

  // 1. Validation individuelle des nœuds et détection des identifiants dupliqués
  if (Array.isArray(rawNodes)) {
    for (let i = 0; i < rawNodes.length; i++) {
      const item = rawNodes[i];
      const path = `system.nodes[${i}]`;
      const nodeId = validatePipelineNodeInternal(item, systemId, path, errors);
      if (nodeId) {
        if (nodeMap.has(nodeId)) {
          pushError(
            errors,
            "DUPLICATE_NODE_ID",
            `${path}.id`,
            `Identifiant de nœud dupliqué '${nodeId}' dans le système '${systemId ?? "?"}'.`,
            nodeId
          );
        } else {
          nodeMap.set(nodeId, item as PipelineNode);
        }
      }
    }
  }

  // 2. Validation individuelle des tronçons et détection des identifiants dupliqués
  if (Array.isArray(rawSegments)) {
    for (let i = 0; i < rawSegments.length; i++) {
      const item = rawSegments[i];
      const path = `system.segments[${i}]`;
      const segId = validatePipelineSegmentInternal(item, systemId, path, errors);
      if (segId) {
        if (segmentMap.has(segId)) {
          pushError(
            errors,
            "DUPLICATE_SEGMENT_ID",
            `${path}.id`,
            `Identifiant de tronçon dupliqué '${segId}' dans le système '${systemId ?? "?"}'.`,
            segId
          );
        } else {
          segmentMap.set(segId, item as PipelineSegment);
        }

        // Identifiant partagé entre un nœud et un tronçon dans le même périmètre d'intégrité
        if (nodeMap.has(segId)) {
          pushError(
            errors,
            "DUPLICATE_SEGMENT_ID",
            `${path}.id`,
            `Conflit d'identifiant dans le même périmètre système : '${segId}' est déjà utilisé par un PipelineNode.`,
            segId
          );
        }
      }
    }
  }

  // 3. Vérification des références des tronçons vers les nœuds (startNodeId / endNodeId)
  if (Array.isArray(rawSegments)) {
    for (let i = 0; i < rawSegments.length; i++) {
      const item = rawSegments[i];
      if (!isPlainRecord(item)) continue;
      const segId = isNonEmptyString(item.id) ? item.id.trim() : undefined;
      const startNodeId = isNonEmptyString(item.startNodeId)
        ? item.startNodeId.trim()
        : undefined;
      const endNodeId = isNonEmptyString(item.endNodeId)
        ? item.endNodeId.trim()
        : undefined;

      if (startNodeId && !nodeMap.has(startNodeId)) {
        pushError(
          errors,
          "SEGMENT_REFERENCES_UNKNOWN_START_NODE",
          `system.segments[${i}].startNodeId`,
          `Le tronçon '${segId ?? "?"}' référence un nœud de départ inexistant '${startNodeId}'.`,
          segId
        );
      }

      if (endNodeId && !nodeMap.has(endNodeId)) {
        pushError(
          errors,
          "SEGMENT_REFERENCES_UNKNOWN_END_NODE",
          `system.segments[${i}].endNodeId`,
          `Le tronçon '${segId ?? "?"}' référence un nœud d'arrivée inexistant '${endNodeId}'.`,
          segId
        );
      }
    }
  }

  // 4. Vérification des références des nœuds vers les tronçons (connectedSegmentIds)
  //    et cohérence bidirectionnelle nœud <-> tronçon
  if (Array.isArray(rawNodes)) {
    for (let i = 0; i < rawNodes.length; i++) {
      const item = rawNodes[i];
      if (!isPlainRecord(item)) continue;
      const nodeId = isNonEmptyString(item.id) ? item.id.trim() : undefined;
      if (!nodeId || !Array.isArray(item.connectedSegmentIds)) continue;

      const declaredSet = new Set<string>();
      for (let j = 0; j < item.connectedSegmentIds.length; j++) {
        const rawSegRef = item.connectedSegmentIds[j];
        if (!isNonEmptyString(rawSegRef)) continue;
        const segRef = rawSegRef.trim();
        declaredSet.add(segRef);

        const targetSeg = segmentMap.get(segRef);
        if (!targetSeg) {
          pushError(
            errors,
            "NODE_REFERENCES_UNKNOWN_SEGMENT",
            `system.nodes[${i}].connectedSegmentIds[${j}]`,
            `Le nœud '${nodeId}' référence un tronçon inexistant '${segRef}'.`,
            nodeId
          );
        } else {
          const isIncident =
            targetSeg.startNodeId?.trim() === nodeId ||
            targetSeg.endNodeId?.trim() === nodeId;
          if (!isIncident) {
            pushError(
              errors,
              "NODE_SEGMENT_INCIDENCE_MISMATCH",
              `system.nodes[${i}].connectedSegmentIds[${j}]`,
              `Incohérence relationnelle : le nœud '${nodeId}' déclare le tronçon '${segRef}' dans connectedSegmentIds, mais le tronçon '${segRef}' relie '${targetSeg.startNodeId}' à '${targetSeg.endNodeId}'.`,
              nodeId
            );
          }
        }
      }

      // Si le nœud déclare explicitement sa liste connectedSegmentIds, tout tronçon
      // incident à ce nœud doit également y figurer
      for (const [segId, seg] of segmentMap.entries()) {
        const isIncident =
          seg.startNodeId?.trim() === nodeId || seg.endNodeId?.trim() === nodeId;
        if (isIncident && !declaredSet.has(segId)) {
          pushError(
            errors,
            "NODE_SEGMENT_INCIDENCE_MISMATCH",
            `system.nodes[${i}].connectedSegmentIds`,
            `Incohérence relationnelle : le tronçon '${segId}' est connecté au nœud '${nodeId}', mais '${segId}' est absent de connectedSegmentIds du nœud '${nodeId}'.`,
            nodeId
          );
        }
      }
    }
  }

  const topology = analyzeNetworkTopology(nodeMap, segmentMap);
  const valid = errors.length === 0;

  return Object.freeze({
    valid,
    systemId,
    structuralValidationState: valid ? "STRUCTURALLY_VALID" : "STRUCTURALLY_INVALID",
    errors: Object.freeze(errors),
    topologyNotices: topology.notices,
    topologySummary: topology.summary,
    normativeQualificationPerformed: false,
    calculationExecuted: false,
  });
}
