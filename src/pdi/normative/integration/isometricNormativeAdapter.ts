/**
 * PDI NORMATIVE ENGINE — ISOMETRIC TO NORMATIVE DOMAIN ADAPTER
 * Reference: ARCH-01 (Architectural Unification & Normative Bridge)
 *
 * Deterministic, side-effect-free adapter transforming Isometric Editor entities
 * (IsoNode, IsoSegment, IsoFitting, IsoPipingSupport, PdiUniversalEntity)
 * into a normalized `IsometricNormativeContext`.
 *
 * STRICT ADAPTER RULES (ARCH-01 Section 7 & 8):
 * 1. Never mutates the source object.
 * 2. Never invents default values when fields are missing.
 * 3. Never silently converts NPS <-> DN.
 * 4. Never silently converts ASME Class <-> EN PN.
 * 5. Never deduces a material identifier from descriptive free text.
 * 6. Never deduces compatibility or fabricates evidenceIds.
 * 7. Uses structured component types ("PIPE" | "FITTING" | "FLANGE" | "VALVE" | "SUPPORT").
 */

import type {
  IsoNode,
  IsoSegment,
  IsoFitting,
  IsoFittingType,
} from "../../isometric/types/isoGraphTypes";
import type { IsoPipingSupport } from "../../isometric/supports/pdiMssSupportEngine";
import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";
import type {
  IsometricNormativeComponentType,
  IsometricNormativeContext,
} from "./isometricNormativeContext";

const STRUCTURED_COMPONENT_TYPES: ReadonlySet<IsometricNormativeComponentType> = new Set([
  "PIPE",
  "FITTING",
  "FLANGE",
  "VALVE",
  "SUPPORT",
]);

const VALVE_EQUIPMENT_TYPES: ReadonlySet<IsoFittingType> = new Set([
  "vanne_passage_total",
  "vanne_opercule",
  "vanne_soupape",
  "vanne_boisseau",
  "vanne_papillon",
  "clapet",
  "clapet_bille",
  "soupape",
  "robinet_pointeau",
]);

const FLANGE_EQUIPMENT_TYPES: ReadonlySet<IsoFittingType> = new Set([
  "bride_wn",
  "bride_so",
  "bride_pleine",
  "bride_sw",
  "bride_lap_joint",
]);

const FITTING_EQUIPMENT_TYPES: ReadonlySet<IsoFittingType> = new Set([
  "te_egal",
  "te_reduit",
  "te_barre",
  "croix",
  "weldolet",
  "threadolet",
  "sockolet",
  "reduction_concentrique",
  "reduction_excentrique",
  "fond_bombe",
  "coude_90",
  "coude_90_sr",
  "coude_45",
  "coude_30",
  "coude_22_5",
  "coude_3d",
  "coude_5d",
  "coude_180",
  "piquage",
]);

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Extracts nominalSize without ANY unit or standard conversion (no NPS <-> DN math).
 */
function extractNominalSizeVerbatim(raw: Record<string, unknown>, specificProps?: Record<string, unknown>): string | undefined {
  const directNominal =
    readNonEmptyString(raw.nominalSize) ??
    readNonEmptyString(raw.DN) ??
    readNonEmptyString(raw.dn) ??
    readNonEmptyString(specificProps?.nominalSize);

  if (directNominal !== undefined) {
    return directNominal;
  }

  if (typeof raw.DN === "number" && Number.isFinite(raw.DN) && raw.DN > 0) {
    return String(raw.DN);
  }

  if (typeof raw.dn === "number" && Number.isFinite(raw.dn) && raw.dn > 0) {
    return String(raw.dn);
  }

  return undefined;
}

/**
 * Resolves a structured IsometricNormativeComponentType from an editor equipmentType or explicit field.
 * Does not guess from free-text labels.
 */
export function resolveStructuredComponentType(
  explicitComponentType?: unknown,
  equipmentType?: IsoFittingType,
  nodeType?: string
): IsometricNormativeComponentType | undefined {
  const explicitStr = readNonEmptyString(explicitComponentType);
  if (explicitStr !== undefined) {
    if (STRUCTURED_COMPONENT_TYPES.has(explicitStr as IsometricNormativeComponentType)) {
      return explicitStr as IsometricNormativeComponentType;
    }
    return undefined;
  }

  if (equipmentType) {
    if (VALVE_EQUIPMENT_TYPES.has(equipmentType)) return "VALVE";
    if (FLANGE_EQUIPMENT_TYPES.has(equipmentType)) return "FLANGE";
    if (FITTING_EQUIPMENT_TYPES.has(equipmentType)) return "FITTING";
  }

  if (nodeType === "tee" || nodeType === "piquage") {
    return "FITTING";
  }

  return undefined;
}

function extractEvidenceIds(raw: Record<string, unknown>, specificProps?: Record<string, unknown>): readonly string[] | undefined {
  const candidate = Array.isArray(raw.evidenceIds)
    ? raw.evidenceIds
    : Array.isArray(specificProps?.evidenceIds)
      ? specificProps?.evidenceIds
      : undefined;

  if (!candidate) return undefined;

  const filtered = candidate
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());

  return Object.freeze(filtered);
}

/**
 * Deterministically converts an `IsoNode` (or editor node-like entity) into an `IsometricNormativeContext`.
 * Never mutates the input node.
 */
export function adaptIsoNodeToNormativeContext(
  node: IsoNode | ( Partial<IsoNode> & Record<string, unknown> )
): IsometricNormativeContext {
  if (!node || typeof node !== "object") {
    return Object.freeze({
      entityId: "",
    });
  }

  const raw = node as Record<string, unknown>;
  const specificProps =
    raw.specificProps && typeof raw.specificProps === "object" && !Array.isArray(raw.specificProps)
      ? (raw.specificProps as Record<string, unknown>)
      : undefined;

  const entityId = readNonEmptyString(raw.id) ?? readNonEmptyString(raw.entityId) ?? "";

  const componentType = resolveStructuredComponentType(
    raw.componentType ?? specificProps?.componentType,
    raw.equipmentType as IsoFittingType | undefined,
    readNonEmptyString(raw.type)
  );

  const nominalSize = extractNominalSizeVerbatim(raw, specificProps);

  const dimensionalStandard =
    readNonEmptyString(raw.dimensionalStandard) ??
    readNonEmptyString(raw.dimensionalStandardId) ??
    readNonEmptyString(specificProps?.dimensionalStandard) ??
    readNonEmptyString(specificProps?.dimensionalStandardId);

  const productStandard =
    readNonEmptyString(raw.productStandard) ??
    readNonEmptyString(raw.productStandardId) ??
    readNonEmptyString(specificProps?.productStandard) ??
    readNonEmptyString(specificProps?.productStandardId);

  const schedule =
    readNonEmptyString(raw.schedule) ??
    readNonEmptyString(specificProps?.schedule);

  const pressureRating =
    readNonEmptyString(raw.pressureRating) ??
    readNonEmptyString(raw.rating) ??
    readNonEmptyString(raw.pn) ??
    readNonEmptyString(raw.pressureClass) ??
    readNonEmptyString(specificProps?.pressureRating) ??
    readNonEmptyString(specificProps?.rating);

  const ratingSystem =
    readNonEmptyString(raw.ratingSystem) ??
    readNonEmptyString(specificProps?.ratingSystem);

  const materialId =
    readNonEmptyString(raw.materialId) ??
    readNonEmptyString(raw.material) ??
    readNonEmptyString(specificProps?.materialId);

  const connectionType =
    readNonEmptyString(raw.connectionType) ??
    readNonEmptyString(specificProps?.connectionType);

  const fittingType =
    readNonEmptyString(raw.fittingType) ??
    readNonEmptyString(specificProps?.fittingType);

  const valveType =
    readNonEmptyString(raw.valveType) ??
    readNonEmptyString(specificProps?.valveType);

  const pipingSpecId =
    readNonEmptyString(raw.pipingSpecId) ??
    readNonEmptyString(raw.specificationId) ??
    readNonEmptyString(raw.spec) ??
    readNonEmptyString(specificProps?.pipingSpecId) ??
    readNonEmptyString(specificProps?.specificationId);

  const designCodeId =
    readNonEmptyString(raw.designCodeId) ??
    readNonEmptyString(specificProps?.designCodeId);

  const evidenceIds = extractEvidenceIds(raw, specificProps);

  const context: IsometricNormativeContext = {
    entityId,
    ...(componentType !== undefined ? { componentType } : {}),
    ...(nominalSize !== undefined ? { nominalSize } : {}),
    ...(dimensionalStandard !== undefined ? { dimensionalStandard } : {}),
    ...(productStandard !== undefined ? { productStandard } : {}),
    ...(schedule !== undefined ? { schedule } : {}),
    ...(pressureRating !== undefined ? { pressureRating } : {}),
    ...(ratingSystem !== undefined ? { ratingSystem } : {}),
    ...(materialId !== undefined ? { materialId } : {}),
    ...(connectionType !== undefined ? { connectionType } : {}),
    ...(fittingType !== undefined ? { fittingType } : {}),
    ...(valveType !== undefined ? { valveType } : {}),
    ...(pipingSpecId !== undefined ? { pipingSpecId } : {}),
    ...(designCodeId !== undefined ? { designCodeId } : {}),
    ...(evidenceIds !== undefined ? { evidenceIds } : {}),
  };

  return Object.freeze(context);
}

/**
 * Deterministically converts an `IsoSegment` into an `IsometricNormativeContext`.
 * Never mutates the input segment.
 */
export function adaptIsoSegmentToNormativeContext(
  segment: IsoSegment | ( Partial<IsoSegment> & Record<string, unknown> )
): IsometricNormativeContext {
  if (!segment || typeof segment !== "object") {
    return Object.freeze({
      entityId: "",
    });
  }

  const raw = segment as Record<string, unknown>;
  const specificProps =
    raw.specificProps && typeof raw.specificProps === "object" && !Array.isArray(raw.specificProps)
      ? (raw.specificProps as Record<string, unknown>)
      : undefined;

  const entityId = readNonEmptyString(raw.id) ?? readNonEmptyString(raw.entityId) ?? "";

  const explicitType = raw.componentType ?? specificProps?.componentType;
  const componentType: IsometricNormativeComponentType | undefined =
    explicitType !== undefined
      ? resolveStructuredComponentType(explicitType)
      : "PIPE";

  const nominalSize = extractNominalSizeVerbatim(raw, specificProps);

  const dimensionalStandard =
    readNonEmptyString(raw.dimensionalStandard) ??
    readNonEmptyString(raw.dimensionalStandardId) ??
    readNonEmptyString(specificProps?.dimensionalStandard) ??
    readNonEmptyString(specificProps?.dimensionalStandardId);

  const productStandard =
    readNonEmptyString(raw.productStandard) ??
    readNonEmptyString(raw.productStandardId) ??
    readNonEmptyString(specificProps?.productStandard) ??
    readNonEmptyString(specificProps?.productStandardId);

  const schedule =
    readNonEmptyString(raw.schedule) ??
    readNonEmptyString(specificProps?.schedule);

  const pressureRating =
    readNonEmptyString(raw.pressureRating) ??
    readNonEmptyString(raw.rating) ??
    readNonEmptyString(raw.pn) ??
    readNonEmptyString(raw.pressureClass) ??
    readNonEmptyString(specificProps?.pressureRating);

  const ratingSystem =
    readNonEmptyString(raw.ratingSystem) ??
    readNonEmptyString(specificProps?.ratingSystem);

  const materialId =
    readNonEmptyString(raw.materialId) ??
    readNonEmptyString(raw.material) ??
    readNonEmptyString(specificProps?.materialId);

  const connectionType =
    readNonEmptyString(raw.connectionType) ??
    readNonEmptyString(specificProps?.connectionType);

  const pipingSpecId =
    readNonEmptyString(raw.pipingSpecId) ??
    readNonEmptyString(raw.specificationId) ??
    readNonEmptyString(raw.spec) ??
    readNonEmptyString(specificProps?.pipingSpecId) ??
    readNonEmptyString(specificProps?.specificationId);

  const designCodeId =
    readNonEmptyString(raw.designCodeId) ??
    readNonEmptyString(specificProps?.designCodeId);

  const evidenceIds = extractEvidenceIds(raw, specificProps);

  const context: IsometricNormativeContext = {
    entityId,
    ...(componentType !== undefined ? { componentType } : {}),
    ...(nominalSize !== undefined ? { nominalSize } : {}),
    ...(dimensionalStandard !== undefined ? { dimensionalStandard } : {}),
    ...(productStandard !== undefined ? { productStandard } : {}),
    ...(schedule !== undefined ? { schedule } : {}),
    ...(pressureRating !== undefined ? { pressureRating } : {}),
    ...(ratingSystem !== undefined ? { ratingSystem } : {}),
    ...(materialId !== undefined ? { materialId } : {}),
    ...(connectionType !== undefined ? { connectionType } : {}),
    ...(pipingSpecId !== undefined ? { pipingSpecId } : {}),
    ...(designCodeId !== undefined ? { designCodeId } : {}),
    ...(evidenceIds !== undefined ? { evidenceIds } : {}),
  };

  return Object.freeze(context);
}

/**
 * Deterministically converts an `IsoFitting` into an `IsometricNormativeContext`.
 */
export function adaptIsoFittingToNormativeContext(
  fitting: IsoFitting | ( Partial<IsoFitting> & Record<string, unknown> )
): IsometricNormativeContext {
  if (!fitting || typeof fitting !== "object") {
    return Object.freeze({
      entityId: "",
    });
  }

  const raw = fitting as Record<string, unknown>;
  const specificProps =
    raw.specificProps && typeof raw.specificProps === "object" && !Array.isArray(raw.specificProps)
      ? (raw.specificProps as Record<string, unknown>)
      : undefined;

  const entityId = readNonEmptyString(raw.id) ?? readNonEmptyString(raw.entityId) ?? "";
  const componentType = resolveStructuredComponentType(
    raw.componentType ?? specificProps?.componentType,
    raw.type as IsoFittingType | undefined
  );
  const nominalSize = extractNominalSizeVerbatim(raw, specificProps);
  const schedule = readNonEmptyString(raw.schedule) ?? readNonEmptyString(specificProps?.schedule);
  const pressureRating =
    readNonEmptyString(raw.pressureRating) ??
    readNonEmptyString(raw.rating) ??
    readNonEmptyString(raw.pn) ??
    readNonEmptyString(specificProps?.pressureRating);
  const materialId =
    readNonEmptyString(raw.materialId) ??
    readNonEmptyString(raw.material) ??
    readNonEmptyString(specificProps?.materialId);
  const pipingSpecId =
    readNonEmptyString(raw.pipingSpecId) ??
    readNonEmptyString(raw.specificationId) ??
    readNonEmptyString(raw.spec) ??
    readNonEmptyString(specificProps?.pipingSpecId);
  const dimensionalStandard =
    readNonEmptyString(raw.dimensionalStandard) ??
    readNonEmptyString(raw.dimensionalStandardId) ??
    readNonEmptyString(specificProps?.dimensionalStandard);
  const productStandard =
    readNonEmptyString(raw.productStandard) ??
    readNonEmptyString(raw.productStandardId) ??
    readNonEmptyString(specificProps?.productStandard);
  const connectionType =
    readNonEmptyString(raw.connectionType) ??
    readNonEmptyString(specificProps?.connectionType);
  const fittingType =
    readNonEmptyString(raw.fittingType) ??
    readNonEmptyString(specificProps?.fittingType);
  const evidenceIds = extractEvidenceIds(raw, specificProps);

  return Object.freeze({
    entityId,
    ...(componentType !== undefined ? { componentType } : {}),
    ...(nominalSize !== undefined ? { nominalSize } : {}),
    ...(dimensionalStandard !== undefined ? { dimensionalStandard } : {}),
    ...(productStandard !== undefined ? { productStandard } : {}),
    ...(schedule !== undefined ? { schedule } : {}),
    ...(pressureRating !== undefined ? { pressureRating } : {}),
    ...(materialId !== undefined ? { materialId } : {}),
    ...(connectionType !== undefined ? { connectionType } : {}),
    ...(fittingType !== undefined ? { fittingType } : {}),
    ...(pipingSpecId !== undefined ? { pipingSpecId } : {}),
    ...(evidenceIds !== undefined ? { evidenceIds } : {}),
  });
}

/**
 * Deterministically converts an `IsoPipingSupport` into an `IsometricNormativeContext`.
 */
export function adaptIsoSupportToNormativeContext(
  support: IsoPipingSupport | ( Partial<IsoPipingSupport> & Record<string, unknown> )
): IsometricNormativeContext {
  if (!support || typeof support !== "object") {
    return Object.freeze({
      entityId: "",
    });
  }

  const raw = support as Record<string, unknown>;
  const entityId = readNonEmptyString(raw.id) ?? "";
  const nominalSize = extractNominalSizeVerbatim(raw);
  const materialId = readNonEmptyString(raw.materialId) ?? readNonEmptyString(raw.material);
  const pipingSpecId = readNonEmptyString(raw.pipingSpecId) ?? readNonEmptyString(raw.spec);

  return Object.freeze({
    entityId,
    componentType: "SUPPORT",
    ...(nominalSize !== undefined ? { nominalSize } : {}),
    ...(materialId !== undefined ? { materialId } : {}),
    ...(pipingSpecId !== undefined ? { pipingSpecId } : {}),
  });
}

/**
 * Deterministically converts a `PdiUniversalEntity` into an `IsometricNormativeContext`
 * without inventing defaults or converting units.
 */
export function adaptUniversalEntityToNormativeContext(
  entity: PdiUniversalEntity
): IsometricNormativeContext {
  if (!entity || typeof entity !== "object") {
    return Object.freeze({
      entityId: "",
    });
  }

  const categoryMap: Record<string, IsometricNormativeComponentType | undefined> = {
    pipe: "PIPE",
    fitting: "FITTING",
    flange: "FLANGE",
    valve: "VALVE",
    support: "SUPPORT",
  };

  const componentType = categoryMap[entity.identity?.category];
  const nominalSize =
    readNonEmptyString(entity.normative?.nominalSize) ??
    (entity.dn && typeof entity.dn.dn === "number" && Number.isFinite(entity.dn.dn) && entity.dn.dn > 0
      ? String(entity.dn.dn)
      : undefined);
  const pressureRating =
    readNonEmptyString(entity.normative?.pressureRating) ??
    readNonEmptyString(entity.pn?.rating) ??
    readNonEmptyString(entity.spec?.classRating);
  const materialId =
    readNonEmptyString(entity.normative?.materialId) ??
    readNonEmptyString(entity.material?.grade);
  const schedule =
    readNonEmptyString(entity.normative?.schedule) ??
    readNonEmptyString(entity.material?.schedule);
  const pipingSpecId =
    readNonEmptyString(entity.normative?.pipingSpecId) ??
    readNonEmptyString(entity.spec?.pmsCode);
  const dimensionalStandard =
    readNonEmptyString(entity.normative?.dimensionalStandard) ??
    readNonEmptyString(entity.material?.standard);
  const productStandard = readNonEmptyString(entity.normative?.productStandard);
  const designCodeId = readNonEmptyString(entity.normative?.designCodeId);
  const connectionType =
    readNonEmptyString(entity.normative?.connectionType) ??
    readNonEmptyString(entity.connection?.connectionType);
  const evidenceIds = entity.normative?.evidenceIds ? [...entity.normative.evidenceIds] : undefined;

  return Object.freeze({
    entityId: readNonEmptyString(entity.identity?.id) ?? "",
    ...(componentType !== undefined ? { componentType } : {}),
    ...(nominalSize !== undefined ? { nominalSize } : {}),
    ...(dimensionalStandard !== undefined ? { dimensionalStandard } : {}),
    ...(productStandard !== undefined ? { productStandard } : {}),
    ...(designCodeId !== undefined ? { designCodeId } : {}),
    ...(schedule !== undefined ? { schedule } : {}),
    ...(pressureRating !== undefined ? { pressureRating } : {}),
    ...(materialId !== undefined ? { materialId } : {}),
    ...(connectionType !== undefined ? { connectionType } : {}),
    ...(pipingSpecId !== undefined ? { pipingSpecId } : {}),
    ...(evidenceIds !== undefined ? { evidenceIds } : {}),
  });
}
