/**
 * PDI ENGINEERING PLATFORM — COMMON ENGINEERING ENTITY MODEL (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Provides domain-specific entity projections and typed attributes built on top
 * of the canonical PdiUniversalEntity contract (ARCH-03 / ARCH-07).
 *
 * RULE DE CONCEPTION FONDAMENTALE :
 * - Aucune duplication du modèle universel (INTERDICTION de créer PipelineUniversalEntity,
 *   PipingUniversalEntity, PackageUniversalEntity, etc.).
 * - Tous les domaines partagent le Common Engineering Model (PdiUniversalEntity).
 * - Les particularités de chaque domaine sont injectées via des attributs typés
 *   non destructifs portés dans les métadonnées de l'entité universelle.
 */

import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";
import type { EngineeringDomainId } from "./engineeringDomainTypes";

/**
 * Entité d'ingénierie commune PD&I : alias strict du modèle universel canonique.
 * Garantit l'absence totale de modèle concurrent ou divergent.
 */
export type CommonEngineeringEntity = PdiUniversalEntity;

/**
 * Attributs spécifiques au domaine PIPING (Tuyauteries d'usines et installations).
 */
export interface PipingDomainAttributes {
  readonly lineTag?: string;
  readonly serviceCategory?: "process" | "utility" | "flare" | "drain" | "blowdown";
  readonly insulationRequired?: boolean;
  readonly heatTracingRequired?: boolean;
  readonly slopeDirection?: "up" | "down" | "flat";
  readonly slopePercentage?: number;
  readonly testMedium?: "water" | "air" | "nitrogen";
}

/**
 * Attributs spécifiques au domaine PIPELINE (Réseaux de transport & distribution).
 */
export interface PipelineDomainAttributes {
  readonly kilometerPointStart?: number; // KP / Point kilométrique de départ
  readonly kilometerPointEnd?: number;   // KP d'arrivée
  readonly burialDepthMeters?: number;  // Profondeur d'enfouissement
  readonly classLocation?: 1 | 2 | 3 | 4; // Classe d'emplacement de sécurité (ASME B31.8)
  readonly designFactorF?: number;      // Facteur de construction (ex: 0.72, 0.60, 0.50, 0.40)
  readonly crossingType?: "road" | "railway" | "river" | "cased" | "open_trench" | "hdd";
  readonly cathodicProtectionZone?: string;
}

/**
 * Attributs spécifiques au domaine PACKAGE (Skids modulaires & unités pré-assemblées).
 */
export interface PackageDomainAttributes {
  readonly skidModuleId?: string;
  readonly skidTag?: string;
  readonly structuralBaseType?: "skid_metallique" | "dalle_beton" | "fosse";
  readonly transportEnvelope?: {
    readonly lengthMeters: number;
    readonly widthMeters: number;
    readonly heightMeters: number;
  };
  readonly liftingLugIds?: readonly string[];
  readonly batteryLimitTieIns?: readonly string[];
}

/**
 * Attributs spécifiques au domaine EQUIPMENT (Équipements sous pression, cuves, machines).
 */
export interface EquipmentDomainAttributes {
  readonly equipmentTag?: string;
  readonly equipmentCategory?: "vessel" | "column" | "pump" | "compressor" | "heat_exchanger" | "tank" | "reactor";
  readonly nozzleTags?: readonly string[];
  readonly dryWeightKg?: number;
  readonly operatingWeightKg?: number;
  readonly foundationElevationMeters?: number;
}

/**
 * Clé normalisée pour stocker les attributs de domaine dans la documentation/métadonnées de l'entité.
 */
export const DOMAIN_ATTRIBUTES_METADATA_KEY = "pdiEngineeringDomainAttributes";

/**
 * Attache des attributs de domaine typés à une entité universelle sans en altérer la structure.
 */
export function attachDomainAttributes<T extends object>(
  entity: PdiUniversalEntity,
  domainId: EngineeringDomainId,
  attributes: T
): PdiUniversalEntity {
  return {
    ...entity,
    domainAttributes: {
      ...(entity.domainAttributes || {}),
      [domainId]: Object.freeze({ ...attributes } as unknown as Record<string, unknown>),
    },
  };
}

/**
 * Récupère les attributs d'un domaine attaché à une entité universelle.
 */
export function getDomainAttributes<T extends object>(
  entity: PdiUniversalEntity,
  domainId: EngineeringDomainId
): T | undefined {
  if (!entity.domainAttributes) return undefined;
  return entity.domainAttributes[domainId] as T | undefined;
}
