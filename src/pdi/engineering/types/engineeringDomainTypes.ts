/**
 * PDI ENGINEERING PLATFORM — MULTI-DOMAIN ENGINEERING ARCHITECTURE (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Defines the core domain and capability identifiers, domain descriptors,
 * and context contracts for multi-domain engineering across PD&I:
 * - PIPING (In-plant process & utility piping)
 * - PIPELINE (Cross-country & regional transmission)
 * - PACKAGE (Modular process skids & packaged units)
 * - EQUIPMENT (Static & rotating equipment, pressure vessels)
 *
 * CRITICAL ARCHITECTURAL INVARIANTS:
 * 1. EngineeringDomain != NormativeQualification (no hardcoded normative rules).
 * 2. EngineeringDomain != PdiOrganizationProfile (strictly client-neutral).
 * 3. EngineeringDomain != CommercialCosting (no unit rates, prices or currencies).
 * 4. All domains share the Common Engineering Model (PdiUniversalEntity).
 */

import type { UniversalEntityCategory } from "../../model/pdiUniversalEntity";

/**
 * Identifiants normalisés des domaines d'ingénierie supportés par PD&I.
 */
export type EngineeringDomainId =
  | "PIPING"
  | "PIPELINE"
  | "PACKAGE"
  | "EQUIPMENT";

/** Alias sémantique du domaine d'ingénierie */
export type EngineeringDomain = EngineeringDomainId;

/**
 * Capacités d'ingénierie orthogonales pouvant être déclarées et activées
 * indépendamment par chaque domaine technique.
 */
export type EngineeringCapabilityId =
  | "2D"
  | "3D"
  | "ISOMETRIC"
  | "ALIGNMENT"
  | "STATIONS"
  | "COMPONENT_SELECTION"
  | "NORMATIVE_VALIDATION"
  | "CALCULATION"
  | "BOM"
  | "MTO"
  | "WELD"
  | "SPOOL"
  | "COSTING"
  | "DELIVERABLES";

/** Alias sémantique de la capacité d'ingénierie */
export type EngineeringCapability = EngineeringCapabilityId;

/**
 * Contrat d'un domaine d'ingénierie PD&I.
 * Chaque domaine déclare son identité internationale, ses capacités supportées,
 * ses catégories d'entités permises et ses références normatives par défaut.
 */
export interface EngineeringDomainDescriptor {
  readonly id: EngineeringDomainId;
  readonly label: string;
  readonly description: string;
  /** Liste des capacités formellement prises en charge par ce domaine */
  readonly capabilities: readonly EngineeringCapabilityId[];
  /** Catégories d'objets du modèle universel autorisées dans ce domaine */
  readonly allowedEntityCategories: readonly UniversalEntityCategory[];
  /**
   * Références textuelles aux codes de conception applicables par défaut.
   * ATTENTION : Références d'identifiants uniquement (ex: 'ASME-B31.3'),
   * JAMAIS de logique ou de formules normatives codées en dur dans le domaine.
   */
  readonly defaultNormativeDesignCodeRefs: readonly string[];
}

/**
 * Contexte opérationnel actif d'un domaine d'ingénierie dans un projet ou workspace.
 */
export interface EngineeringDomainContext {
  readonly domainId: EngineeringDomainId;
  readonly activeCapabilities: readonly EngineeringCapabilityId[];
  readonly projectId?: string;
  readonly activeStandardCodeRef?: string;
}

/**
 * Garde de type vérifiant si une chaîne est un identifiant de domaine valide.
 */
export function isEngineeringDomainId(value: unknown): value is EngineeringDomainId {
  return (
    typeof value === "string" &&
    ["PIPING", "PIPELINE", "PACKAGE", "EQUIPMENT"].includes(value)
  );
}

/**
 * Garde de type vérifiant si une chaîne est un identifiant de capacité valide.
 */
export function isEngineeringCapabilityId(value: unknown): value is EngineeringCapabilityId {
  return (
    typeof value === "string" &&
    [
      "2D",
      "3D",
      "ISOMETRIC",
      "ALIGNMENT",
      "STATIONS",
      "COMPONENT_SELECTION",
      "NORMATIVE_VALIDATION",
      "CALCULATION",
      "BOM",
      "MTO",
      "WELD",
      "SPOOL",
      "COSTING",
      "DELIVERABLES",
    ].includes(value)
  );
}
