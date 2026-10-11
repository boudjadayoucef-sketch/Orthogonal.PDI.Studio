/**
 * PDI ENGINEERING PLATFORM — PIPELINE ENGINEERING MODEL TYPES (ARCH-10)
 * Reference: ARCH-10 (Pipeline Engineering Model)
 *
 * Modèle métier structuré, typé et immuable pour le domaine PIPELINE
 * (réseaux de transport et de distribution industrielle : gaz naturel,
 * hydrocarbures liquides, hydrogène, mélanges GN/H2, eau et fluides multiphasiques).
 *
 * INVARIANTS ARCHITECTURAUX ABSOLUS (ARCH-10 §4, §5, §6) :
 * 1. Couche A (Engineering / PRODUCT_CORE) :
 *    - Représente uniquement les entités métier du réseau de pipeline (PipelineSystem,
 *      PipelineSegment, PipelineNode), leurs relations topologiques, les services/fluides
 *      déclarés, les dimensions physiques avec unités explicites et les matériaux déclarés.
 * 2. Aucun modèle universel concurrent :
 *    - Ne crée jamais de `PipelineUniversalEntity` (interdit par ARCH-08 §22).
 *    - Reste 100% compatible avec `PdiUniversalEntity` et `PipelineDomainAttributes`.
 * 3. Indépendance vis-à-vis de la Couche B (Normative) :
 *    - Ne contient aucune formule, aucun calcul B31.8 / B31.12 / B31.4 / ISO-13623,
 *      aucune qualification normative automatique de matériau ou de compatibilité H2.
 *    - Toute donnée déclarée est considérée comme déclarative (`DECLARED_UNVERIFIED`)
 *      et n'est JAMAIS promue automatiquement au statut `VERIFIED`.
 * 4. Indépendance vis-à-vis des Couches C (Commercial) et D (Client / SaaS / Licences) :
 *    - Aucun prix, coût, devise, licence ou identité de client historique.
 *    - Le type de fluide n'est JAMAIS déduit du nom du système ou du projet.
 * 5. Contrat d'unités physiques explicite :
 *    - Aucune valeur physique par défaut arbitraire.
 *    - Aucune conversion d'unités silencieuse.
 */

import type { EngineeringDomainId } from "./engineeringDomainTypes";
import type { PipelineDomainAttributes } from "./engineeringEntityTypes";
import type { DesignCodeId } from "../../normative/types/normativeCoreTypes";

// ============================================================================
// 1. UNITÉS PHYSIQUES EXPLICITES (SANS CONVERSION NI SUPPOSITION IMPLICITE)
// ============================================================================

/**
 * Unités explicites de longueur de tronçon ou de point kilométrique.
 */
export type PipelineLengthUnit = "m" | "km" | "ft" | "mi";

/**
 * Unités explicites de diamètre ou d'épaisseur de paroi.
 */
export type PipelineDimensionUnit = "mm" | "in";

/**
 * Unités explicites de pression déclarée.
 */
export type PipelinePressureUnit = "bar" | "MPa" | "kPa" | "psi";

/**
 * Unités explicites de température déclarée.
 */
export type PipelineTemperatureUnit = "C" | "F" | "K";

/**
 * Grandeur physique déclarée avec son unité explicite obligatoire.
 * Interdit toute interprétation implicite d'un nombre nu.
 */
export interface PipelineExplicitQuantity<U extends string> {
  readonly value: number;
  readonly unit: U;
}

// ============================================================================
// 2. SERVICE ET FLUIDE DÉCLARÉ (ARCH-10 §4.4)
// ============================================================================

/**
 * Catégories de fluides de transport/distribution pipeline strictement distinguées (ARCH-10 §4.4).
 * Ne confond jamais gaz naturel, hydrogène pur, mélange GN/H2, hydrocarbures liquides et autres fluides.
 */
export type PipelineFluidCategory =
  | "NATURAL_GAS"
  | "HYDROGEN"
  | "NATURAL_GAS_HYDROGEN_BLEND"
  | "LIQUID_HYDROCARBON"
  | "MULTIPHASE"
  | "WATER"
  | "CO2"
  | "OTHER";

/**
 * Phase physique déclarée du fluide.
 */
export type PipelineFluidPhase = "GAS" | "LIQUID" | "MULTIPHASE" | "SUPERCRITICAL";

/**
 * Statut déclaratif d'une donnée d'ingénierie dans le modèle Pipeline (Couche A).
 * RÈGLE (ARCH-10 §5) : Une donnée déclarée dans le modèle d'ingénierie ne devient
 * JAMAIS automatiquement `VERIFIED`. La qualification normative relève exclusivement
 * de la Couche B (Normative Engine) avec preuves vérifiées.
 */
export type PipelineDeclarationVerificationState = "DECLARED_UNVERIFIED";

/**
 * Description structurée du service ou fluide véhiculé par un système ou un tronçon.
 * ATTENTION :
 * - Ne jamais déduire `fluidCategory` à partir du nom du projet ou du système.
 * - Pour `NATURAL_GAS_HYDROGEN_BLEND`, `hydrogenMoleFractionPercent` permet de déclarer
 *   le pourcentage molaire de H2 (dans ]0, 100[) sans exécuter de calcul de reconversion.
 */
export interface PipelineServiceFluidDeclaration {
  readonly fluidCategory: PipelineFluidCategory;
  readonly serviceCode?: string;
  readonly description?: string;
  readonly phase?: PipelineFluidPhase;
  /**
   * Fraction molaire d'hydrogène déclarée en % (0 <= x <= 100).
   * Purement déclaratif : n'entraîne aucune qualification H2 ou B31.12 automatique.
   */
  readonly hydrogenMoleFractionPercent?: number;
  readonly designPressure?: PipelineExplicitQuantity<PipelinePressureUnit>;
  readonly operatingPressure?: PipelineExplicitQuantity<PipelinePressureUnit>;
  readonly designTemperature?: PipelineExplicitQuantity<PipelineTemperatureUnit>;
  readonly operatingTemperature?: PipelineExplicitQuantity<PipelineTemperatureUnit>;
  /**
   * Statut de vérification : toujours `DECLARED_UNVERIFIED` au niveau du modèle métier.
   */
  readonly verificationState?: PipelineDeclarationVerificationState;
}

// ============================================================================
// 3. MATÉRIAU ET DIMENSIONS DÉCLARÉS SUR UN TRONÇON (ARCH-10 §4.2 & §4.4)
// ============================================================================

/**
 * Matériau déclaré sur un tronçon de pipeline (Couche A).
 * RÈGLE ABSOLUE (ARCH-10 §4.2 & §4.4) :
 * - Aucune qualification normative automatique.
 * - Aucune compatibilité matériau/fluide (notamment H2 / ASME B31.12) n'est déduite
 *   de l'identifiant, de la norme (ex: API 5L) ou de la nuance (ex: X52, X65).
 */
export interface PipelineDeclaredMaterial {
  /** Identifiant de référence vers un enregistrement matériau (ex: "MAT_API_5L_X65_PSL2") */
  readonly materialId?: string;
  /** Standard matériau déclaré (ex: "API-5L", "ASTM-A106") */
  readonly standardCode?: string;
  /** Nuance / Grade déclaré (ex: "X52", "X60", "X65", "Grade B") */
  readonly grade?: string;
  /** Désignation déclarative */
  readonly designation?: string;
  /** Spécification de niveau de produit (ex: "PSL1", "PSL2") */
  readonly productSpecificationLevel?: string;
  /**
   * État de qualification normative du matériau dans ce modèle :
   * Toujours non qualifié au niveau du modèle d'ingénierie (Couche A).
   */
  readonly normativeQualificationStatus?: "NOT_EVALUATED_IN_ENGINEERING_MODEL";
  /**
   * État de compatibilité fluide/matériau (ex: hydrogène) :
   * Toujours non évalué dans le modèle d'ingénierie (Couche A).
   */
  readonly fluidCompatibilityStatus?: "NOT_EVALUATED_IN_ENGINEERING_MODEL";
}

/**
 * Dimensions transversales physiques déclarées d'un tronçon de pipeline,
 * chacune accompagnée de son unité explicite.
 */
export interface PipelineSegmentDimensions {
  readonly nominalDiameter?: PipelineExplicitQuantity<PipelineDimensionUnit>;
  readonly outerDiameter?: PipelineExplicitQuantity<PipelineDimensionUnit>;
  readonly wallThickness?: PipelineExplicitQuantity<PipelineDimensionUnit>;
  readonly corrosionAllowance?: PipelineExplicitQuantity<PipelineDimensionUnit>;
  readonly schedule?: string;
}

/**
 * Références documentaires ou normatives déclaratives attachées à un élément.
 * S'appuie sur les identifiants de `NormativeSourceDocument` et `NormativeEvidence`
 * existants sans jamais auto-certifier leur statut.
 */
export interface PipelineTraceabilityRefs {
  readonly designCodeRef?: DesignCodeId;
  readonly pipingSpecId?: string;
  readonly sourceDocumentIds?: readonly string[];
  readonly evidenceIds?: readonly string[];
}

// ============================================================================
// 4. PIPELINE NODE — POINT DE CONNEXION DU RÉSEAU (ARCH-10 §4.3)
// ============================================================================

/**
 * Rôle fonctionnel industriel d'un nœud sur un réseau de pipeline.
 */
export type PipelineNodeKind =
  | "TERMINAL_INLET"
  | "TERMINAL_OUTLET"
  | "JUNCTION"
  | "BLOCK_VALVE_STATION"
  | "COMPRESSOR_STATION"
  | "PUMP_STATION"
  | "METERING_REGULATING_STATION"
  | "PIG_TRAP_LAUNCHER"
  | "PIG_TRAP_RECEIVER"
  | "FIELD_BEND"
  | "TRANSITION_POINT"
  | "GENERIC_NODE";

/**
 * Coordonnées spatiales locales/projet optionnelles compatibles avec le contrat
 * géométrique existant (`UniversalGeometry` / `IsoPoint3D`), avec unité explicite.
 * Ne constitue pas un moteur géométrique ou SIG.
 */
export interface PipelineNodeCoordinates {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
  readonly elevation?: number;
  readonly unit: PipelineLengthUnit;
}

/**
 * Nœud de connexion d'un système de pipeline (ARCH-10 §4.3).
 */
export interface PipelineNode {
  /** Identifiant stable et unique du nœud dans le système */
  readonly id: string;
  /** Identifiant du système PipelineSystem auquel appartient ce nœud */
  readonly systemId: string;
  /** Libellé ou nom du nœud */
  readonly name: string;
  /** Typologie fonctionnelle du nœud */
  readonly kind?: PipelineNodeKind;
  /**
   * Références explicites aux identifiants des tronçons (`PipelineSegment.id`)
   * connectés à ce nœud.
   * Si renseigné, doit être strictement cohérent avec `startNodeId` / `endNodeId` des tronçons.
   */
  readonly connectedSegmentIds?: readonly string[];
  /** Point kilométrique (KP / PK) déclaré avec son unité explicite */
  readonly stationPoint?: PipelineExplicitQuantity<PipelineLengthUnit>;
  /** Coordonnées géométriques optionnelles */
  readonly coordinates?: PipelineNodeCoordinates;
  /** Référence optionnelle vers une entité `PdiUniversalEntity.identity.id` */
  readonly universalEntityId?: string;
  /** Références documentaires ou preuves déclarées */
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
}

// ============================================================================
// 5. PIPELINE SEGMENT — TRONÇON PHYSIQUE OU LOGIQUE (ARCH-10 §4.2)
// ============================================================================

/**
 * Sens d'écoulement nominal déclaré sur le tronçon.
 */
export type PipelineFlowDirection =
  | "START_TO_END"
  | "END_TO_START"
  | "BIDIRECTIONAL"
  | "UNSPECIFIED";

/**
 * Tronçon physique ou logique d'un système de pipeline (ARCH-10 §4.2).
 */
export interface PipelineSegment {
  /** Identifiant stable et unique du tronçon dans le système */
  readonly id: string;
  /** Identifiant du système PipelineSystem auquel appartient ce tronçon */
  readonly systemId: string;
  /** Libellé ou désignation du tronçon */
  readonly name: string;
  /** Identifiant du nœud de départ (`PipelineNode.id`) */
  readonly startNodeId: string;
  /** Identifiant du nœud d'arrivée (`PipelineNode.id`) */
  readonly endNodeId: string;
  /**
   * Longueur déclarée du tronçon avec son unité explicite.
   * Doit être finie et strictement positive (> 0).
   */
  readonly length?: PipelineExplicitQuantity<PipelineLengthUnit>;
  /** Dimensions physiques déclarées avec leurs unités explicites */
  readonly dimensions?: PipelineSegmentDimensions;
  /** Matériau déclaré (sans qualification normative ni compatibilité H2 automatique) */
  readonly material?: PipelineDeclaredMaterial;
  /** Service ou fluide déclaré au niveau du tronçon */
  readonly service?: PipelineServiceFluidDeclaration;
  /** Sens d'écoulement déclaré */
  readonly flowDirection?: PipelineFlowDirection;
  /**
   * Attributs métier spécifiques au domaine PIPELINE issus d'ARCH-08
   * (`kilometerPointStart`, `kilometerPointEnd`, `burialDepthMeters`, `classLocation`, `crossingType`, etc.)
   */
  readonly domainAttributes?: PipelineDomainAttributes;
  /** Référence optionnelle vers une entité `PdiUniversalEntity.identity.id` */
  readonly universalEntityId?: string;
  /** Références aux documents sources ou preuves normatives */
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
}

// ============================================================================
// 6. PIPELINE SYSTEM — SYSTÈME DE PIPELINES IDENTIFIÉ (ARCH-10 §4.1)
// ============================================================================

/**
 * État de validation structurelle déclaré sur le système.
 */
export type PipelineSystemStructuralValidationState =
  | "UNVALIDATED"
  | "STRUCTURALLY_VALID"
  | "STRUCTURALLY_INVALID";

/**
 * Système de pipelines identifié (ARCH-10 §4.1).
 */
export interface PipelineSystem {
  /** Identifiant stable du système de pipeline */
  readonly id: string;
  /** Nom ou libellé du système (ex: "Mainline Transmission Section A") */
  readonly name: string;
  /**
   * Domaine d'ingénierie : obligatoirement `"PIPELINE"` (ARCH-08 / ARCH-10 §4.1).
   */
  readonly engineeringDomain: EngineeringDomainId;
  /** Identifiant optionnel du projet parent (`PdiProjectId`) */
  readonly projectId?: string;
  /** Description générale optionnelle */
  readonly description?: string;
  /**
   * Service ou fluide déclaré au niveau du système.
   * Ne jamais déduire ce champ à partir de `name` ou `description`.
   */
  readonly service?: PipelineServiceFluidDeclaration;
  /** Liste structurée des nœuds appartenant au système */
  readonly nodes: readonly PipelineNode[];
  /** Liste structurée des tronçons appartenant au système */
  readonly segments: readonly PipelineSegment[];
  /** Références documentaires ou de code de conception au niveau du système */
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
  /** État de validation structurelle (optionnel, purement informatif en entrée) */
  readonly structuralValidationState?: PipelineSystemStructuralValidationState;
}

// ============================================================================
// 7. DIAGNOSTICS, TOPOLOGIE ET RÉSULTAT DE VALIDATION (ARCH-10 §4.5)
// ============================================================================

/**
 * Codes d'erreurs déterministes du validateur du modèle Pipeline (ARCH-10 §4.5).
 */
export type PipelineModelValidationErrorCode =
  | "INVALID_SYSTEM_OBJECT"
  | "MISSING_SYSTEM_ID"
  | "MISSING_SYSTEM_NAME"
  | "INVALID_ENGINEERING_DOMAIN"
  | "INVALID_NODES_COLLECTION"
  | "INVALID_SEGMENTS_COLLECTION"
  | "INVALID_NODE_OBJECT"
  | "MISSING_NODE_ID"
  | "MISSING_NODE_NAME"
  | "MISSING_NODE_SYSTEM_ID"
  | "NODE_SYSTEM_ID_MISMATCH"
  | "DUPLICATE_NODE_ID"
  | "INVALID_NODE_COORDINATES"
  | "INVALID_NODE_STATION_POINT"
  | "NODE_REFERENCES_UNKNOWN_SEGMENT"
  | "NODE_SEGMENT_INCIDENCE_MISMATCH"
  | "INVALID_SEGMENT_OBJECT"
  | "MISSING_SEGMENT_ID"
  | "MISSING_SEGMENT_NAME"
  | "MISSING_SEGMENT_SYSTEM_ID"
  | "SEGMENT_SYSTEM_ID_MISMATCH"
  | "DUPLICATE_SEGMENT_ID"
  | "MISSING_SEGMENT_START_NODE_ID"
  | "MISSING_SEGMENT_END_NODE_ID"
  | "SEGMENT_SELF_LOOP_NOT_ALLOWED"
  | "SEGMENT_REFERENCES_UNKNOWN_START_NODE"
  | "SEGMENT_REFERENCES_UNKNOWN_END_NODE"
  | "INVALID_PHYSICAL_QUANTITY"
  | "NEGATIVE_OR_ZERO_SEGMENT_LENGTH"
  | "NON_FINITE_NUMERIC_VALUE"
  | "MISSING_EXPLICIT_PHYSICAL_UNIT"
  | "UNSUPPORTED_PHYSICAL_UNIT"
  | "INVALID_SERVICE_FLUID_CATEGORY"
  | "INVALID_HYDROGEN_BLEND_FRACTION"
  | "INVALID_DOMAIN_ATTRIBUTES"
  | "INVALID_TRACEABILITY_REFS"
  | "DISALLOWED_AUTOMATIC_VERIFICATION_CLAIM"
  | "DISALLOWED_AUTOMATIC_MATERIAL_QUALIFICATION"
  | "DISALLOWED_COMMERCIAL_FIELD_IN_ENGINEERING_MODEL"
  | "DISALLOWED_CLIENT_IDENTITY_IN_ENGINEERING_MODEL";

/**
 * Codes d'avertissements topologiques non bloquants (ARCH-10 §4.5).
 * Documentent les particularités topologiques (nœud isolé, sous-réseaux déconnectés, boucles)
 * sans rejeter arbitrairement une topologie industrielle valide.
 */
export type PipelineTopologyNoticeCode =
  | "ISOLATED_NODE_DETECTED"
  | "DISCONNECTED_SUBNETWORKS_DETECTED"
  | "LOOP_TOPOLOGY_DETECTED"
  | "EMPTY_PIPELINE_NETWORK";

export interface PipelineModelValidationError {
  readonly code: PipelineModelValidationErrorCode;
  readonly path: string;
  readonly entityId?: string;
  readonly message: string;
}

export interface PipelineTopologyNotice {
  readonly code: PipelineTopologyNoticeCode;
  readonly entityIds: readonly string[];
  readonly message: string;
}

/**
 * Résumé topologique déterministe calculé lors de la validation du réseau.
 */
export interface PipelineNetworkTopologySummary {
  readonly nodeCount: number;
  readonly segmentCount: number;
  readonly isolatedNodeIds: readonly string[];
  readonly connectedComponentCount: number;
  readonly hasLoops: boolean;
}

/**
 * Résultat immuable de la validation d'un `PipelineSystem`.
 */
export interface PipelineSystemValidationResult {
  readonly valid: boolean;
  readonly systemId?: string;
  readonly structuralValidationState: PipelineSystemStructuralValidationState;
  readonly errors: readonly PipelineModelValidationError[];
  readonly topologyNotices: readonly PipelineTopologyNotice[];
  readonly topologySummary: PipelineNetworkTopologySummary;
  /**
   * Rappelle explicitement que la validation structurelle (Couche A)
   * ne constitue ni une qualification normative ni une validation de calcul (Couche B).
   */
  readonly normativeQualificationPerformed: false;
  readonly calculationExecuted: false;
}
