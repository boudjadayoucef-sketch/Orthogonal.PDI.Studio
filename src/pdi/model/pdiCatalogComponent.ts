/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * CATALOG & COMPONENT SELECTION & COMPATIBILITY CONTRACT
 * Reference: ARCH-06 (Component Selection + Catalog + Compatibility)
 * 
 * SÉPARATION CLAIRE DES RESPONSABILITÉS :
 * 1. CATALOG MODEL (PdiCatalogComponent)
 *    - Fournit uniquement les données techniques et références qu'il possède réellement.
 *    - Tous les champs techniques non garantis restent optionnels (undefined).
 *    - Zéro valeur technique inventée (aucun DN par défaut, aucun NPS par défaut, aucun Class/PN par défaut).
 * 
 * 2. COMPONENT SELECTION (PdiComponentSelectionRequest / Result)
 *    - Sépare strictement l'input du besoin d'ingénierie du résultat de sélection.
 *    - Distingue : SELECTED, ELIGIBLE, NO_CANDIDATE, INCOMPATIBLE, INSUFFICIENT_DATA, UNVERIFIED, INVALID.
 *    - Ne transforme JAMAIS UNVERIFIED en COMPATIBLE.
 * 
 * 3. MULTI-DIMENSIONAL COMPATIBILITY ENGINE (PdiCompatibilityCheckResult)
 *    - Évalue indépendamment : connection, nominalSize, pressureRating, material, standard, faceType, pipingSpec, evidence.
 *    - Traçabilité et non-fabrication (aucune conversion DN ↔ NPS, Class ↔ PN, aucune auto-qualification matière).
 * 
 * 4. NORMATIVE AUTHORITY & EVIDENCE CHAIN
 *    - Le moteur normatif existant (NORM-01..14) reste l'autorité pour toute règle ou preuve normative.
 *    - Présence dans un catalogue ≠ Qualification normative automatique.
 */

import type { PdiProjectId, PdiEntityId } from "./pdiProjectContext";
import { isValidStableId, parseOptionalNumeric } from "./pdiProjectAdapter";

/**
 * Familles de composants de tuyauterie contrôlées.
 */
export type PdiCatalogComponentType =
  | "PIPE"
  | "ELBOW"
  | "TEE"
  | "REDUCER"
  | "FLANGE"
  | "VALVE"
  | "GASKET"
  | "BOLT"
  | "CAP"
  | "INSTRUMENT"
  | "SUPPORT"
  | "OTHER";

/**
 * Modèle de composant de catalogue (ARCH-06 §6).
 * Tous les attributs techniques non explicitement présents doivent rester undefined.
 */
export interface PdiCatalogComponent {
  readonly id: string;
  readonly componentType: PdiCatalogComponentType;
  readonly description?: string;
  readonly shortName?: string;
  readonly manufacturer?: string;
  readonly manufacturerPartNumber?: string;
  readonly standard?: string;
  readonly material?: string;
  readonly nominalDiameter?: number;
  readonly nominalDiameterUnit?: "mm" | "in";
  readonly nominalSize?: string;
  readonly outerDiameterMm?: number;
  readonly pressureClass?: string;
  readonly schedule?: string;
  readonly wallThicknessMm?: number;
  readonly faceType?: string;
  readonly connectionType?: string;
  readonly weightKg?: number;
  readonly evidenceIds?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Paramètres pour instancier un PdiCatalogComponent de manière sécurisée et non-fabricante.
 */
export interface CreateCatalogComponentParams {
  readonly id: string;
  readonly componentType: PdiCatalogComponentType;
  readonly description?: string;
  readonly shortName?: string;
  readonly manufacturer?: string;
  readonly manufacturerPartNumber?: string;
  readonly standard?: string;
  readonly material?: string;
  readonly nominalDiameter?: number | string;
  readonly nominalDiameterUnit?: "mm" | "in";
  readonly nominalSize?: string;
  readonly outerDiameterMm?: number | string;
  readonly pressureClass?: string;
  readonly schedule?: string;
  readonly wallThicknessMm?: number | string;
  readonly faceType?: string;
  readonly connectionType?: string;
  readonly weightKg?: number | string;
  readonly evidenceIds?: readonly string[];
  readonly metadata?: Readonly<Record<string, unknown>>;
}

const VALID_COMPONENT_TYPES: readonly PdiCatalogComponentType[] = Object.freeze([
  "PIPE",
  "ELBOW",
  "TEE",
  "REDUCER",
  "FLANGE",
  "VALVE",
  "GASKET",
  "BOLT",
  "CAP",
  "INSTRUMENT",
  "SUPPORT",
  "OTHER",
]);

/**
 * Crée un composant catalogue valide et immuable.
 * RÈGLE ABSOLUE : Zéro valeur technique inventée.
 */
export function createCatalogComponent(params: CreateCatalogComponentParams): PdiCatalogComponent {
  if (!params || typeof params !== "object") {
    throw new Error("[ARCH-06] Parameters for createCatalogComponent must be a non-null object.");
  }
  if (!isValidStableId(params.id)) {
    throw new Error("[ARCH-06] Catalog component requires a valid non-empty id.");
  }
  if (!VALID_COMPONENT_TYPES.includes(params.componentType)) {
    throw new Error(`[ARCH-06] Invalid componentType: '${params.componentType}'.`);
  }

  const cleanDescription = typeof params.description === "string" && params.description.trim().length > 0
    ? params.description.trim()
    : undefined;

  const cleanShortName = typeof params.shortName === "string" && params.shortName.trim().length > 0
    ? params.shortName.trim()
    : undefined;

  const cleanManufacturer = typeof params.manufacturer === "string" && params.manufacturer.trim().length > 0
    ? params.manufacturer.trim()
    : undefined;

  const cleanManufacturerPartNumber = typeof params.manufacturerPartNumber === "string" && params.manufacturerPartNumber.trim().length > 0
    ? params.manufacturerPartNumber.trim()
    : undefined;

  const cleanStandard = typeof params.standard === "string" && params.standard.trim().length > 0
    ? params.standard.trim()
    : undefined;

  const cleanMaterial = typeof params.material === "string" && params.material.trim().length > 0
    ? params.material.trim()
    : undefined;

  const cleanNominalSize = typeof params.nominalSize === "string" && params.nominalSize.trim().length > 0
    ? params.nominalSize.trim()
    : undefined;

  const cleanPressureClass = typeof params.pressureClass === "string" && params.pressureClass.trim().length > 0
    ? params.pressureClass.trim()
    : undefined;

  const cleanSchedule = typeof params.schedule === "string" && params.schedule.trim().length > 0
    ? params.schedule.trim()
    : undefined;

  const cleanFaceType = typeof params.faceType === "string" && params.faceType.trim().length > 0
    ? params.faceType.trim()
    : undefined;

  const cleanConnectionType = typeof params.connectionType === "string" && params.connectionType.trim().length > 0
    ? params.connectionType.trim()
    : undefined;

  const nominalDiameter = parseOptionalNumeric(params.nominalDiameter);
  const outerDiameterMm = parseOptionalNumeric(params.outerDiameterMm);
  const wallThicknessMm = parseOptionalNumeric(params.wallThicknessMm);
  const weightKg = parseOptionalNumeric(params.weightKg);

  const nominalDiameterUnit = params.nominalDiameterUnit === "in" ? "in" : params.nominalDiameterUnit === "mm" ? "mm" : undefined;

  const evidenceIds = Array.isArray(params.evidenceIds) && params.evidenceIds.length > 0
    ? Object.freeze([...params.evidenceIds.filter((id) => typeof id === "string" && id.trim().length > 0)])
    : undefined;

  const metadata = params.metadata && typeof params.metadata === "object"
    ? Object.freeze({ ...params.metadata })
    : undefined;

  return Object.freeze({
    id: params.id.trim(),
    componentType: params.componentType,
    description: cleanDescription,
    shortName: cleanShortName,
    manufacturer: cleanManufacturer,
    manufacturerPartNumber: cleanManufacturerPartNumber,
    standard: cleanStandard,
    material: cleanMaterial,
    nominalDiameter,
    nominalDiameterUnit,
    nominalSize: cleanNominalSize,
    outerDiameterMm,
    pressureClass: cleanPressureClass,
    schedule: cleanSchedule,
    wallThicknessMm,
    faceType: cleanFaceType,
    connectionType: cleanConnectionType,
    weightKg,
    evidenceIds,
    metadata,
  });
}

/**
 * Interface du registre de composants catalogue en mémoire.
 */
export interface PdiCatalogRegistry {
  register(component: PdiCatalogComponent): void;
  registerBatch(components: readonly PdiCatalogComponent[]): void;
  get(id: string): PdiCatalogComponent | undefined;
  has(id: string): boolean;
  list(): readonly PdiCatalogComponent[];
  findByType(type: PdiCatalogComponentType): readonly PdiCatalogComponent[];
  filter(predicate: (c: PdiCatalogComponent) => boolean): readonly PdiCatalogComponent[];
  count(): number;
  clear(): void;
}

/**
 * Fabrique d'un registre de catalogue déterministe en mémoire.
 */
export function createCatalogRegistry(initialComponents?: readonly PdiCatalogComponent[]): PdiCatalogRegistry {
  const store = new Map<string, PdiCatalogComponent>();

  if (Array.isArray(initialComponents)) {
    for (const comp of initialComponents) {
      if (comp && isValidStableId(comp.id)) {
        store.set(comp.id, comp);
      }
    }
  }

  return {
    register(component: PdiCatalogComponent): void {
      if (!component || !isValidStableId(component.id)) {
        throw new Error("[ARCH-06] Cannot register catalog component with invalid ID.");
      }
      if (store.has(component.id)) {
        throw new Error(`[ARCH-06] Duplicate catalog component ID: '${component.id}'.`);
      }
      store.set(component.id, Object.freeze({ ...component }));
    },

    registerBatch(components: readonly PdiCatalogComponent[]): void {
      for (const comp of components) {
        this.register(comp);
      }
    },

    get(id: string): PdiCatalogComponent | undefined {
      if (typeof id !== "string") return undefined;
      return store.get(id.trim());
    },

    has(id: string): boolean {
      if (typeof id !== "string") return false;
      return store.has(id.trim());
    },

    list(): readonly PdiCatalogComponent[] {
      return Object.freeze(Array.from(store.values()));
    },

    findByType(type: PdiCatalogComponentType): readonly PdiCatalogComponent[] {
      const result: PdiCatalogComponent[] = [];
      for (const comp of store.values()) {
        if (comp.componentType === type) {
          result.push(comp);
        }
      }
      return Object.freeze(result);
    },

    filter(predicate: (c: PdiCatalogComponent) => boolean): readonly PdiCatalogComponent[] {
      const result: PdiCatalogComponent[] = [];
      for (const comp of store.values()) {
        if (predicate(comp)) {
          result.push(comp);
        }
      }
      return Object.freeze(result);
    },

    count(): number {
      return store.size;
    },

    clear(): void {
      store.clear();
    },
  };
}
