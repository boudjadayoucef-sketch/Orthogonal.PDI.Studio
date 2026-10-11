/**
 * PDI ENGINEERING PLATFORM — PIPELINE ENGINEERING MODEL BUILDERS & QUERIES (ARCH-10)
 * Reference: ARCH-10 (Pipeline Engineering Model)
 *
 * Fonctions pures, déterministes et immuables de construction et d'interrogation
 * du modèle métier `PIPELINE` (`PipelineSystem`, `PipelineSegment`, `PipelineNode`),
 * ainsi que de projection non destructive vers le modèle universel `PdiUniversalEntity`.
 *
 * INVARIANTS (ARCH-10 §4, §5, §6) :
 * - N'invente aucune valeur physique par défaut.
 * - Ne convertit aucune unité silencieusement.
 * - Ne déduit jamais le fluide à partir du nom du système ou du projet.
 * - Ne qualifie jamais un matériau ni une compatibilité hydrogène.
 * - N'exécute aucun calcul normatif ou hydraulique.
 */

import type {
  PipelineDeclaredMaterial,
  PipelineExplicitQuantity,
  PipelineFlowDirection,
  PipelineLengthUnit,
  PipelineNode,
  PipelineNodeCoordinates,
  PipelineNodeKind,
  PipelineSegment,
  PipelineSegmentDimensions,
  PipelineServiceFluidDeclaration,
  PipelineSystem,
  PipelineTraceabilityRefs,
} from "../types/pipelineEngineeringModelTypes";
import type { PipelineDomainAttributes } from "../types/engineeringEntityTypes";
import { attachDomainAttributes } from "../types/engineeringEntityTypes";
import type { PdiUniversalEntity } from "../../model/pdiUniversalEntity";

export interface CreatePipelineNodeInput {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly kind?: PipelineNodeKind;
  readonly connectedSegmentIds?: readonly string[];
  readonly stationPoint?: PipelineExplicitQuantity<PipelineLengthUnit>;
  readonly coordinates?: PipelineNodeCoordinates;
  readonly universalEntityId?: string;
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
}

/**
 * Clone et gèle profondément une référence de traçabilité `PipelineTraceabilityRefs`
 * sans jamais muter l'objet source.
 */
function cloneAndFreezeTraceabilityRefs(
  refs: PipelineTraceabilityRefs | undefined
): PipelineTraceabilityRefs | undefined {
  if (!refs) return undefined;
  return Object.freeze({
    ...refs,
    sourceDocumentIds: refs.sourceDocumentIds
      ? Object.freeze(refs.sourceDocumentIds.map((id) => id.trim()))
      : undefined,
    evidenceIds: refs.evidenceIds
      ? Object.freeze(refs.evidenceIds.map((id) => id.trim()))
      : undefined,
  });
}

/**
 * Clone et gèle profondément une déclaration de fluide / service
 * sans jamais muter l'objet source.
 */
function cloneAndFreezeServiceDeclaration(
  service: Omit<PipelineServiceFluidDeclaration, "verificationState"> | PipelineServiceFluidDeclaration | undefined
): PipelineServiceFluidDeclaration | undefined {
  if (!service) return undefined;
  return Object.freeze({
    ...service,
    designPressure: service.designPressure
      ? Object.freeze({ ...service.designPressure })
      : undefined,
    operatingPressure: service.operatingPressure
      ? Object.freeze({ ...service.operatingPressure })
      : undefined,
    designTemperature: service.designTemperature
      ? Object.freeze({ ...service.designTemperature })
      : undefined,
    operatingTemperature: service.operatingTemperature
      ? Object.freeze({ ...service.operatingTemperature })
      : undefined,
    verificationState: "DECLARED_UNVERIFIED" as const,
  });
}

/**
 * Construit un `PipelineNode` immuable sans inventer de valeurs par défaut
 * et sans conserver aucune référence mutable vers l'entrée.
 */
export function createPipelineNode(input: CreatePipelineNodeInput): PipelineNode {
  return Object.freeze({
    id: input.id.trim(),
    systemId: input.systemId.trim(),
    name: input.name.trim(),
    kind: input.kind,
    connectedSegmentIds: input.connectedSegmentIds
      ? Object.freeze(input.connectedSegmentIds.map((id) => id.trim()))
      : undefined,
    stationPoint: input.stationPoint
      ? Object.freeze({ ...input.stationPoint })
      : undefined,
    coordinates: input.coordinates
      ? Object.freeze({ ...input.coordinates })
      : undefined,
    universalEntityId: input.universalEntityId?.trim(),
    traceabilityRefs: cloneAndFreezeTraceabilityRefs(input.traceabilityRefs),
  });
}

export interface CreatePipelineSegmentInput {
  readonly id: string;
  readonly systemId: string;
  readonly name: string;
  readonly startNodeId: string;
  readonly endNodeId: string;
  readonly length?: PipelineExplicitQuantity<PipelineLengthUnit>;
  readonly dimensions?: PipelineSegmentDimensions;
  readonly material?: Omit<
    PipelineDeclaredMaterial,
    "normativeQualificationStatus" | "fluidCompatibilityStatus"
  >;
  readonly service?: Omit<PipelineServiceFluidDeclaration, "verificationState">;
  readonly flowDirection?: PipelineFlowDirection;
  readonly domainAttributes?: PipelineDomainAttributes;
  readonly universalEntityId?: string;
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
}

/**
 * Construit un `PipelineSegment` immuable sans conserver aucune référence mutable vers l'entrée.
 * Garantit que le matériau et le fluide déclarés conservent leur statut non qualifié / non vérifié.
 */
export function createPipelineSegment(input: CreatePipelineSegmentInput): PipelineSegment {
  const frozenDimensions: PipelineSegmentDimensions | undefined = input.dimensions
    ? Object.freeze({
        nominalDiameter: input.dimensions.nominalDiameter
          ? Object.freeze({ ...input.dimensions.nominalDiameter })
          : undefined,
        outerDiameter: input.dimensions.outerDiameter
          ? Object.freeze({ ...input.dimensions.outerDiameter })
          : undefined,
        wallThickness: input.dimensions.wallThickness
          ? Object.freeze({ ...input.dimensions.wallThickness })
          : undefined,
        corrosionAllowance: input.dimensions.corrosionAllowance
          ? Object.freeze({ ...input.dimensions.corrosionAllowance })
          : undefined,
        schedule: input.dimensions.schedule,
      })
    : undefined;

  const frozenMaterial: PipelineDeclaredMaterial | undefined = input.material
    ? Object.freeze({
        ...input.material,
        normativeQualificationStatus: "NOT_EVALUATED_IN_ENGINEERING_MODEL" as const,
        fluidCompatibilityStatus: "NOT_EVALUATED_IN_ENGINEERING_MODEL" as const,
      })
    : undefined;

  const frozenService = cloneAndFreezeServiceDeclaration(input.service);

  return Object.freeze({
    id: input.id.trim(),
    systemId: input.systemId.trim(),
    name: input.name.trim(),
    startNodeId: input.startNodeId.trim(),
    endNodeId: input.endNodeId.trim(),
    length: input.length ? Object.freeze({ ...input.length }) : undefined,
    dimensions: frozenDimensions,
    material: frozenMaterial,
    service: frozenService,
    flowDirection: input.flowDirection,
    domainAttributes: input.domainAttributes
      ? Object.freeze({ ...input.domainAttributes })
      : undefined,
    universalEntityId: input.universalEntityId?.trim(),
    traceabilityRefs: cloneAndFreezeTraceabilityRefs(input.traceabilityRefs),
  });
}

export interface CreatePipelineSystemInput {
  readonly id: string;
  readonly name: string;
  readonly projectId?: string;
  readonly description?: string;
  readonly service?: Omit<PipelineServiceFluidDeclaration, "verificationState">;
  readonly nodes: readonly PipelineNode[];
  readonly segments: readonly PipelineSegment[];
  readonly traceabilityRefs?: PipelineTraceabilityRefs;
}

/**
 * Construit un `PipelineSystem` immuable rattaché au domaine `"PIPELINE"`.
 * - Copie et gèle profondément chaque nœud, tronçon, tableau et sous-structure imbriquée
 *   afin de ne conserver aucune référence mutable vers les objets enfants fournis en entrée.
 * - Ne mute jamais les objets fournis en entrée.
 * - Ne déduit jamais le fluide à partir de `name` ou `description`.
 */
export function createPipelineSystem(input: CreatePipelineSystemInput): PipelineSystem {
  const frozenService = cloneAndFreezeServiceDeclaration(input.service);
  const frozenNodes: readonly PipelineNode[] = Object.freeze(
    input.nodes.map((node) => createPipelineNode(node))
  );
  const frozenSegments: readonly PipelineSegment[] = Object.freeze(
    input.segments.map((segment) => createPipelineSegment(segment))
  );

  return Object.freeze({
    id: input.id.trim(),
    name: input.name.trim(),
    engineeringDomain: "PIPELINE" as const,
    projectId: input.projectId?.trim(),
    description: input.description,
    service: frozenService,
    nodes: frozenNodes,
    segments: frozenSegments,
    traceabilityRefs: cloneAndFreezeTraceabilityRefs(input.traceabilityRefs),
    structuralValidationState: "UNVALIDATED" as const,
  });
}

/**
 * Retourne la liste triée des tronçons connectés à un nœud donné dans un `PipelineSystem`.
 */
export function getIncidentSegmentsForNode(
  system: PipelineSystem,
  nodeId: string
): readonly PipelineSegment[] {
  const trimmed = nodeId.trim();
  return Object.freeze(
    system.segments.filter(
      (seg) => seg.startNodeId === trimmed || seg.endNodeId === trimmed
    )
  );
}

/**
 * Retourne le service effectif d'un tronçon (celui déclaré sur le tronçon, ou à défaut celui déclaré sur le système),
 * sans jamais inventer de service si aucun n'est déclaré.
 */
export function resolveEffectiveSegmentService(
  system: PipelineSystem,
  segment: PipelineSegment
): PipelineServiceFluidDeclaration | undefined {
  return segment.service ?? system.service;
}

/**
 * Attache de manière non destructive les métadonnées d'un `PipelineSegment`
 * sur une entité `PdiUniversalEntity` existante via `attachDomainAttributes` (ARCH-08).
 * Garantit qu'aucun second modèle universel concurrent n'est créé.
 */
export function attachPipelineSegmentToUniversalEntity(
  entity: PdiUniversalEntity,
  segment: PipelineSegment
): PdiUniversalEntity {
  const attrs: PipelineDomainAttributes = {
    ...(segment.domainAttributes ?? {}),
  };
  return attachDomainAttributes(entity, "PIPELINE", attrs);
}
