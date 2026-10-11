/**
 * PDI ENGINEERING PLATFORM — ASME B31.8 GAS PIPELINE READINESS ENGINE & VALIDATOR (ARCH-11)
 * Reference: ARCH-11 (ASME B31.8 — Gas Pipeline Engineering & Calculation Readiness)
 *
 * Implémente l'intégration typée, déterministe et sans invention normative entre :
 * - le Pipeline Engineering Model (`PipelineSystem`, `PipelineSegment`, `PipelineNode` — ARCH-10),
 * - le Multi-Code Resolver (`MultiCodeResolver` — ARCH-09),
 * - les contrats de preuves et documents sources normatifs (`NormativeEvidenceResolver`, `UPCOMING_NORMATIVE_SOURCE_DOCUMENTS` — NORM-09 / B31.3-01),
 * - le registre et moteur des codes de conception (`DESIGN_CODE_CALCULATION_REGISTRY`, `executeEngineeringCalculation` — NORM-08).
 *
 * SÉPARATION INVIOLABLE DES 6 NIVEAUX (ARCH-11 §1) :
 * 1. Engineering domain identification (`PIPELINE` + service gaz déclaré).
 * 2. Code and edition identification (`ASME-B31.8`, édition `2022` dans `PDI_STANDARDS_REGISTRY`).
 * 3. Normative evidence and verification status (`DOC-ASME-B31.8-2022` actuellement `UNVERIFIED`, preuves `NormativeEvidence`).
 * 4. Calculation qualification (`NOT_QUALIFIED` tant qu'aucune formule B31.8 vérifiée n'est enregistrée).
 * 5. Calculation availability (`NOT_IMPLEMENTED`, `isCalculationAvailable: false`).
 * 6. Numerical execution and result validation (bloquée de manière déterministe avec `NOT_IMPLEMENTED` ; aucune formule B31.8 inventée, aucune substitution vers B31.3 ou B31.12).
 */

import {
  resolveEffectiveSegmentService,
} from "../../engineering/model/pipelineEngineeringModel";
import {
  validatePipelineSystem,
} from "../../engineering/validators/pipelineEngineeringModelValidator";
import type {
  PipelineSegment,
  PipelineSystem,
} from "../../engineering/types/pipelineEngineeringModelTypes";
import { FORBIDDEN_HISTORICAL_CLIENT_PATTERNS } from "../../model/pdiIndustrialArchitectureAdapter";
import {
  ASME_B31_8_DESIGN_CODE_ID,
  ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID,
  type B31_8GasServiceReadinessStatus,
  type B31_8GuardedCalculationExecutionResult,
  type B31_8PipelineReadinessRequest,
  type B31_8PipelineReadinessResult,
  type B31_8PipelineReadinessStatus,
  type B31_8Stage1DomainIdentificationReport,
  type B31_8Stage2CodeAndEditionIdentificationReport,
  type B31_8Stage3NormativeEvidenceReport,
  type B31_8Stage4CalculationQualificationReport,
  type B31_8Stage5CalculationAvailabilityReport,
  type B31_8Stage6NumericalExecutionGateReport,
} from "../types/b31_8ReadinessTypes";
import type {
  EngineeringCalculationInput,
  EngineeringCalculationResult,
} from "../types/designCodeTypes";
import type {
  MultiCodeResolutionContext,
  MultiCodeResolutionResult,
} from "../types/multiCodeResolverTypes";
import {
  MultiCodeResolver,
  type MultiCodeResolverConfig,
  resolveApplicableDesignCode,
} from "./multiCodeResolver";
import { executeEngineeringCalculation } from "./designCodeEngine";
import {
  defaultSourceDocumentRegistry,
  getUpcomingNormativeSourceDocuments,
  type INormativeSourceDocumentRegistry,
} from "../registry/normativeSourceDocumentRegistry";
import { getDesignCodeCalculationEntry } from "../registry/designCodeRegistry";
import {
  isFormulaQualified,
  isRecordObject,
  validateDesignCodeFormulaReference,
} from "../validators/designCodeValidator";
import { FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS } from "../validators/multiCodeResolverValidator";

/**
 * Champs interdits dans une requête de préparation B31.8 :
 * interdit toute inférence de code à partir d'un nom de client, d'un titre de projet,
 * d'un libellé matériau ou d'une licence commerciale (ARCH-11 §3.A).
 */
export const FORBIDDEN_B31_8_INFERENCE_FIELDS: readonly string[] = Object.freeze([
  ...FORBIDDEN_MULTI_CODE_HEURISTIC_FIELDS,
  "projectTitle",
  "projectName",
  "materialLabel",
  "materialDesignation",
  "commercialLicense",
  "licenseKey",
  "licenseTier",
  "subscriptionPlan",
  "saasPlan",
]);

export interface B31_8ReadinessRequestValidationError {
  readonly code:
    | "INVALID_READINESS_REQUEST_OBJECT"
    | "MISSING_PIPELINE_SYSTEM"
    | "DISALLOWED_CODE_INFERENCE_SOURCE"
    | "DISALLOWED_CLIENT_IDENTITY"
    | "INVALID_SEGMENT_ID";
  readonly field?: string;
  readonly message: string;
}

export interface B31_8ReadinessRequestValidationResult {
  readonly valid: boolean;
  readonly errors: readonly B31_8ReadinessRequestValidationError[];
}

/**
 * Valide qu'une requête `B31_8PipelineReadinessRequest` est un objet structuré valide
 * et ne tente pas d'inférer le code applicable depuis un client, un titre de projet,
 * un libellé matériau ou une licence commerciale (ARCH-11 §3.A).
 */
export function validateB31_8PipelineReadinessRequest(
  raw: unknown
): B31_8ReadinessRequestValidationResult {
  if (!isRecordObject(raw)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze([
        Object.freeze({
          code: "INVALID_READINESS_REQUEST_OBJECT",
          message: "La requête d'évaluation B31.8 doit être un objet structuré non-null.",
        }),
      ]),
    });
  }

  const errors: B31_8ReadinessRequestValidationError[] = [];

  for (const field of FORBIDDEN_B31_8_INFERENCE_FIELDS) {
    if (field in raw && raw[field] !== undefined && raw[field] !== null) {
      errors.push(
        Object.freeze({
          code: "DISALLOWED_CODE_INFERENCE_SOURCE",
          field,
          message: `Interdiction (ARCH-11 §3.A) : le champ '${field}' (client, titre de projet, libellé matériau ou licence commerciale) ne peut pas être utilisé pour inférer ou qualifier un contexte ASME B31.8.`,
        })
      );
    }
  }

  for (const [key, val] of Object.entries(raw)) {
    if (typeof val === "string") {
      for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
        if (pattern.test(val)) {
          errors.push(
            Object.freeze({
              code: "DISALLOWED_CLIENT_IDENTITY",
              field: key,
              message: `Interdiction (ARCH-07 / ARCH-11 §3.A) : identité client historique interdite détectée dans '${key}'.`,
            })
          );
          break;
        }
      }
    }
  }

  if (!("system" in raw) || !isRecordObject(raw.system)) {
    errors.push(
      Object.freeze({
        code: "MISSING_PIPELINE_SYSTEM",
        field: "system",
        message: "Un objet PipelineSystem structuré est obligatoire dans 'request.system'.",
      })
    );
  }

  if (
    "segmentId" in raw &&
    raw.segmentId !== undefined &&
    (typeof raw.segmentId !== "string" || raw.segmentId.trim().length === 0)
  ) {
    errors.push(
      Object.freeze({
        code: "INVALID_SEGMENT_ID",
        field: "segmentId",
        message: "Lorsque 'segmentId' est fourni, il doit être une chaîne non vide.",
      })
    );
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

/**
 * Évalue la compatibilité du service fluide déclaré avec le périmètre gaz d'ASME B31.8,
 * sans jamais déduire le fluide à partir du nom du système ou du tronçon.
 */
export function evaluateB31_8GasServiceStatus(
  system: PipelineSystem,
  segment?: PipelineSegment
): B31_8GasServiceReadinessStatus {
  const effectiveService = segment
    ? resolveEffectiveSegmentService(system, segment)
    : system.service;

  if (!effectiveService || !effectiveService.fluidCategory) {
    return "UNDECLARED_SERVICE";
  }

  switch (effectiveService.fluidCategory) {
    case "NATURAL_GAS":
      return "GAS_SERVICE_DECLARED";
    case "HYDROGEN":
    case "NATURAL_GAS_HYDROGEN_BLEND":
      return "HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION";
    case "LIQUID_HYDROCARBON":
    case "WATER":
    case "CO2":
    case "MULTIPHASE":
    case "OTHER":
      return "NON_GAS_FLUID_MISMATCH";
  }
}

/**
 * Construit de manière déterministe un `MultiCodeResolutionContext` à partir d'un `PipelineSystem`
 * (et optionnellement d'un `PipelineSegment`), en utilisant exclusivement les références
 * structurées (`traceabilityRefs`, `explicitDesignCodeId`, `pipingSpecId`, `projectDefaultDesignCodeId`).
 *
 * Ne déduit jamais un code à partir de `system.name`, `system.description`, `segment.name` ou `segment.material`.
 */
export function buildPipelineMultiCodeResolutionContext(
  request: B31_8PipelineReadinessRequest
): MultiCodeResolutionContext {
  const system = request.system;
  const targetSegment = request.segmentId
    ? system.segments?.find((s) => s.id === request.segmentId!.trim())
    : undefined;

  // Collecte structurée et sans arbitrage silencieux des références de code et de preuves
  const explicitDesignCodeId =
    request.explicitDesignCodeId ??
    targetSegment?.traceabilityRefs?.designCodeRef;

  const pipingSpecId =
    request.pipingSpecId ??
    targetSegment?.traceabilityRefs?.pipingSpecId ??
    system?.traceabilityRefs?.pipingSpecId;

  const projectDefaultDesignCodeId =
    request.projectDefaultDesignCodeId ??
    system?.traceabilityRefs?.designCodeRef;

  const evidenceSet = new Set<string>();
  for (const eid of request.evidenceIds ?? []) {
    if (typeof eid === "string" && eid.trim().length > 0) {
      evidenceSet.add(eid.trim());
    }
  }
  for (const eid of targetSegment?.traceabilityRefs?.evidenceIds ?? []) {
    if (typeof eid === "string" && eid.trim().length > 0) {
      evidenceSet.add(eid.trim());
    }
  }
  for (const eid of system?.traceabilityRefs?.evidenceIds ?? []) {
    if (typeof eid === "string" && eid.trim().length > 0) {
      evidenceSet.add(eid.trim());
    }
  }

  return Object.freeze({
    engineeringDomain: system?.engineeringDomain,
    explicitDesignCodeId,
    pipingSpecId,
    projectDefaultDesignCodeId,
    requestedEdition: request.requestedEdition,
    requestedCalculationType: request.requestedCalculationType,
    unitSystem: request.unitSystem,
    evidenceIds: evidenceSet.size > 0 ? Object.freeze(Array.from(evidenceSet).sort()) : undefined,
    enforceDomainCompatibility: true,
  });
}

export interface EvaluateB31_8ReadinessOptions {
  readonly resolverConfig?: MultiCodeResolverConfig;
  readonly sourceDocumentRegistry?: INormativeSourceDocumentRegistry;
  /**
   * Exécuteur de calcul optionnel permettant aux tests d'audit de vérifier
   * avec certitude que `executeEngineeringCalculation` n'est jamais invoqué
   * lorsque la garde de préparation B31.8 bloque l'exécution.
   * Par défaut : `executeEngineeringCalculation`.
   */
  readonly calculationEngineExecutor?: typeof executeEngineeringCalculation;
}

/**
 * Inspecte le statut réel du document source de référence `DOC-ASME-B31.8-2022`
 * dans le registre actif des documents sources et dans la liste `UPCOMING_NORMATIVE_SOURCE_DOCUMENTS`.
 */
function inspectB31_8ReferenceSourceDocument(
  sourceDocRegistry: INormativeSourceDocumentRegistry = defaultSourceDocumentRegistry
): {
  readonly documentId: string;
  readonly status: "VERIFIED" | "UNVERIFIED" | "NOT_FOUND";
  readonly isVerified: boolean;
} {
  const registeredDoc = sourceDocRegistry.get(ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID);
  if (registeredDoc) {
    return {
      documentId: registeredDoc.documentId,
      status: registeredDoc.status,
      isVerified: registeredDoc.status === "VERIFIED",
    };
  }

  const upcomingDoc = getUpcomingNormativeSourceDocuments().find(
    (d) => d.documentId === ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID || d.standardId === ASME_B31_8_DESIGN_CODE_ID
  );
  if (upcomingDoc) {
    return {
      documentId: upcomingDoc.documentId,
      status: upcomingDoc.status,
      isVerified: false, // Un document dans UPCOMING_NORMATIVE_SOURCE_DOCUMENTS non enregistré/vérifié n'est jamais VERIFIED
    };
  }

  return {
    documentId: ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID,
    status: "NOT_FOUND",
    isVerified: false,
  };
}

/**
 * Évalue de manière déterministe les 6 étapes de préparation d'ingénierie et de calcul
 * pour un système ou tronçon de pipeline gaz selon ASME B31.8 (ARCH-11).
 *
 * N'exécute jamais de calcul numérique et ne promeut jamais un code, une édition ou une formule non vérifiés.
 */
export function evaluateB31_8PipelineReadiness(
  request: B31_8PipelineReadinessRequest,
  options?: EvaluateB31_8ReadinessOptions
): B31_8PipelineReadinessResult {
  const diagnosticCodes: string[] = [];
  const messages: string[] = [];

  // 0. Validation anti-inférence (client, titre de projet, libellé matériau, licence)
  const reqValidation = validateB31_8PipelineReadinessRequest(request);
  if (!reqValidation.valid) {
    for (const err of reqValidation.errors) {
      diagnosticCodes.push(err.code);
      messages.push(`${err.code}: ${err.message}`);
    }

    const emptyMultiCodeResult = resolveApplicableDesignCode(
      {},
      options?.resolverConfig
    );

    return Object.freeze({
      status: "INVALID_READINESS_REQUEST",
      stage1DomainIdentification: Object.freeze({
        domainIdentified: false,
        modelStructurallyValid: false,
        gasServiceStatus: "UNDECLARED_SERVICE",
      }),
      stage2CodeIdentification: Object.freeze({
        resolutionStatus: "INVALID_CONTEXT",
        isB31_8Resolved: false,
        crossCodeSubstitutionAttempted: false,
        multiCodeResolution: emptyMultiCodeResult,
      }),
      stage3NormativeEvidence: Object.freeze({
        editionEvidenceReport: emptyMultiCodeResult.editionReport,
        referenceSourceDocumentId: ASME_B31_8_REFERENCE_SOURCE_DOCUMENT_ID,
        referenceSourceDocumentStatus: "UNVERIFIED",
        isAuthoritativeSourceVerified: false,
        isEditionEvidenceVerified: false,
      }),
      stage4CalculationQualification: Object.freeze({
        qualificationStatus: "NOT_QUALIFIED",
        isCalculationQualified: false,
        qualifiedFormulaCount: 0,
      }),
      stage5CalculationAvailability: Object.freeze({
        requestedCalculationType: isRecordObject(request)
          ? (request.requestedCalculationType as B31_8PipelineReadinessRequest["requestedCalculationType"])
          : undefined,
        availabilityStatus: "CODE_NOT_RESOLVED",
        supportedCalculationTypes: Object.freeze([]),
        isCalculationAvailable: false,
      }),
      stage6NumericalExecutionGate: Object.freeze({
        canExecuteNumericalCalculation: false,
        executionPerformed: false,
        blockedReasonCode: "INVALID_READINESS_REQUEST",
        blockedReasonMessage:
          "Exécution numérique bloquée : la requête d'évaluation B31.8 est invalide ou contient des champs d'inférence interdits.",
      }),
      diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
      messages: Object.freeze(messages),
    });
  }

  const system = request.system;

  // =========================================================================
  // ÉTAPE 1 : IDENTIFICATION DU DOMAINE D'INGÉNIERIE ET VALIDATION DU MODÈLE PIPELINE
  // =========================================================================
  const systemValidation = validatePipelineSystem(system);
  const isPipelineDomain = system.engineeringDomain === "PIPELINE";

  if (!isPipelineDomain) {
    diagnosticCodes.push("ENGINEERING_DOMAIN_NOT_PIPELINE");
    messages.push(
      `ENGINEERING_DOMAIN_NOT_PIPELINE: Le domaine du système est '${String(
        system.engineeringDomain
      )}', attendu 'PIPELINE' pour ASME B31.8.`
    );
  }

  if (!systemValidation.valid) {
    diagnosticCodes.push("PIPELINE_SYSTEM_STRUCTURALLY_INVALID");
    for (const err of systemValidation.errors) {
      diagnosticCodes.push(err.code);
      messages.push(`${err.code} (${err.path}): ${err.message}`);
    }
  }

  let targetSegment: PipelineSegment | undefined;
  let segmentLookupValid = true;
  if (request.segmentId !== undefined) {
    const trimmedSegId = request.segmentId.trim();
    targetSegment = Array.isArray(system.segments)
      ? system.segments.find((s) => s.id === trimmedSegId)
      : undefined;
    if (!targetSegment) {
      segmentLookupValid = false;
      diagnosticCodes.push("TARGET_PIPELINE_SEGMENT_NOT_FOUND");
      messages.push(
        `TARGET_PIPELINE_SEGMENT_NOT_FOUND: Le tronçon '${trimmedSegId}' est introuvable dans le système '${system.id}'.`
      );
    }
  }

  const effectiveService = targetSegment
    ? resolveEffectiveSegmentService(system, targetSegment)
    : system.service;
  const gasServiceStatus = evaluateB31_8GasServiceStatus(system, targetSegment);

  if (gasServiceStatus === "NON_GAS_FLUID_MISMATCH") {
    diagnosticCodes.push("B31_8_NON_GAS_FLUID_MISMATCH");
    messages.push(
      `B31_8_NON_GAS_FLUID_MISMATCH: Le fluide déclaré '${String(
        effectiveService?.fluidCategory
      )}' n'est pas un service de transport/distribution de gaz couvert par ASME B31.8.`
    );
  } else if (gasServiceStatus === "HYDROGEN_OR_BLEND_REQUIRES_DEDICATED_EVALUATION") {
    diagnosticCodes.push("B31_8_HYDROGEN_SERVICE_REQUIRES_DEDICATED_QUALIFICATION");
    messages.push(
      `B31_8_HYDROGEN_SERVICE_REQUIRES_DEDICATED_QUALIFICATION: Le fluide déclaré '${String(
        effectiveService?.fluidCategory
      )}' comporte de l'hydrogène. Aucune qualification automatique B31.8 ni substitution vers ASME B31.12 n'est autorisée.`
    );
  } else if (gasServiceStatus === "UNDECLARED_SERVICE") {
    diagnosticCodes.push("B31_8_GAS_SERVICE_UNDECLARED");
    messages.push(
      "B31_8_GAS_SERVICE_UNDECLARED: Aucun fluide/service n'est déclaré sur le tronçon ou le système (aucune déduction implicite à partir du nom du système)."
    );
  }

  const stage1DomainIdentification: B31_8Stage1DomainIdentificationReport = Object.freeze({
    domainIdentified: isPipelineDomain && systemValidation.valid && segmentLookupValid,
    engineeringDomain: system.engineeringDomain,
    systemId: system.id,
    segmentId: targetSegment?.id ?? request.segmentId?.trim(),
    modelStructurallyValid: systemValidation.valid && segmentLookupValid,
    effectiveService,
    effectiveFluidCategory: effectiveService?.fluidCategory,
    gasServiceStatus,
    declaredClassLocation: targetSegment?.domainAttributes?.classLocation,
    declaredDesignFactorF: targetSegment?.domainAttributes?.designFactorF,
  });

  // =========================================================================
  // ÉTAPE 2 : IDENTIFICATION DU CODE ET DE L'ÉDITION VIA MULTI-CODE RESOLVER
  // =========================================================================
  const multiCodeContext = buildPipelineMultiCodeResolutionContext(request);
  const resolver = new MultiCodeResolver(options?.resolverConfig);
  const multiCodeResolution: MultiCodeResolutionResult = resolver.resolve(multiCodeContext);

  for (const diag of multiCodeResolution.diagnosticCodes) {
    diagnosticCodes.push(diag);
  }
  for (const msg of multiCodeResolution.messages) {
    messages.push(msg);
  }

  const isB31_8Resolved =
    multiCodeResolution.status === "RESOLVED" &&
    multiCodeResolution.resolvedDesignCodeId === ASME_B31_8_DESIGN_CODE_ID;

  // Détection de toute tentative d'utiliser un autre code (ex: ASME-B31.3, ASME-B31.12, ASME-B31.4)
  // en substitution d'ASME B31.8 dans un contexte de préparation B31.8
  const crossCodeSubstitutionAttempted =
    (multiCodeResolution.status === "RESOLVED" &&
      multiCodeResolution.resolvedDesignCodeId !== ASME_B31_8_DESIGN_CODE_ID) ||
    (request.explicitDesignCodeId !== undefined &&
      request.explicitDesignCodeId.trim() !== ASME_B31_8_DESIGN_CODE_ID);

  if (crossCodeSubstitutionAttempted) {
    diagnosticCodes.push("CROSS_CODE_SUBSTITUTION_FORBIDDEN");
    messages.push(
      `CROSS_CODE_SUBSTITUTION_FORBIDDEN: Le code '${
        multiCodeResolution.resolvedDesignCodeId ?? request.explicitDesignCodeId
      }' ne peut pas se substituer à 'ASME-B31.8' (aucune substitution inter-codes entre ASME-B31.3, ASME-B31.8 et ASME-B31.12 n'est permise).`
    );
  }

  const stage2CodeIdentification: B31_8Stage2CodeAndEditionIdentificationReport = Object.freeze({
    resolutionStatus: multiCodeResolution.status,
    isB31_8Resolved,
    resolvedDesignCodeId: multiCodeResolution.resolvedDesignCodeId,
    resolvedStandard: multiCodeResolution.resolvedStandard,
    identifiedEdition: multiCodeResolution.editionReport.effectiveEdition,
    crossCodeSubstitutionAttempted,
    multiCodeResolution,
  });

  // =========================================================================
  // ÉTAPE 3 : STATUT DES PREUVES NORMATIVES ET DU DOCUMENT SOURCE ASME B31.8
  // =========================================================================
  const sourceDocInfo = inspectB31_8ReferenceSourceDocument(
    options?.sourceDocumentRegistry
  );
  const isEditionEvidenceVerified =
    isB31_8Resolved &&
    multiCodeResolution.editionReport.editionVerificationStatus === "VERIFIED";

  if (isB31_8Resolved && !sourceDocInfo.isVerified) {
    diagnosticCodes.push("B31_8_SOURCE_DOCUMENT_UNVERIFIED");
    messages.push(
      `B31_8_SOURCE_DOCUMENT_UNVERIFIED: Le document source de référence '${sourceDocInfo.documentId}' a le statut '${sourceDocInfo.status}'. Aucune clause ou formule B31.8 ne peut être qualifiée sans source documentaire VERIFIED.`
    );
  }

  const stage3NormativeEvidence: B31_8Stage3NormativeEvidenceReport = Object.freeze({
    editionEvidenceReport: multiCodeResolution.editionReport,
    referenceSourceDocumentId: sourceDocInfo.documentId,
    referenceSourceDocumentStatus: sourceDocInfo.status,
    isAuthoritativeSourceVerified: sourceDocInfo.isVerified,
    isEditionEvidenceVerified,
  });

  // =========================================================================
  // ÉTAPE 4 : QUALIFICATION NORMATIVE DES CALCULS B31.8
  // =========================================================================
  const b318CalcEntry = getDesignCodeCalculationEntry(ASME_B31_8_DESIGN_CODE_ID);
  const qualifiedFormulas = (b318CalcEntry?.formulaReferences ?? []).filter(
    (f) => validateDesignCodeFormulaReference(f).valid && isFormulaQualified(f)
  );
  const qualificationStatus = isB31_8Resolved
    ? multiCodeResolution.calculationAvailability.qualificationStatus
    : "NOT_QUALIFIED";
  const isCalculationQualified =
    isB31_8Resolved &&
    (qualificationStatus === "QUALIFIED" || qualificationStatus === "PARTIALLY_QUALIFIED") &&
    qualifiedFormulas.length > 0;

  if (isB31_8Resolved && !isCalculationQualified) {
    diagnosticCodes.push("B31_8_CALCULATION_NOT_QUALIFIED");
    messages.push(
      "B31_8_CALCULATION_NOT_QUALIFIED: Aucune règle ou formule ASME B31.8 n'est qualifiée (VERIFIED/LICENSED) dans DESIGN_CODE_CALCULATION_REGISTRY."
    );
  }

  const stage4CalculationQualification: B31_8Stage4CalculationQualificationReport = Object.freeze({
    qualificationStatus,
    isCalculationQualified,
    qualifiedFormulaCount: qualifiedFormulas.length,
  });

  // =========================================================================
  // ÉTAPE 5 : DISPONIBILITÉ RÉELLE DES CALCULS B31.8
  // =========================================================================
  const isCalculationAvailable =
    isB31_8Resolved &&
    multiCodeResolution.calculationAvailability.availabilityStatus === "AVAILABLE" &&
    multiCodeResolution.isUsableForCalculation === true;

  const stage5CalculationAvailability: B31_8Stage5CalculationAvailabilityReport = Object.freeze({
    codeSupportStatus: isB31_8Resolved
      ? multiCodeResolution.implementationStatus
      : b318CalcEntry?.status,
    requestedCalculationType: request.requestedCalculationType,
    availabilityStatus: isB31_8Resolved
      ? multiCodeResolution.calculationAvailability.availabilityStatus
      : "CODE_NOT_RESOLVED",
    supportedCalculationTypes: isB31_8Resolved
      ? multiCodeResolution.calculationAvailability.supportedCalculationTypes
      : Object.freeze([]),
    isCalculationAvailable,
  });

  // =========================================================================
  // ÉTAPE 6 : GARDE D'EXÉCUTION NUMÉRIQUE & STATUT GLOBAL DE PRÉPARATION
  // =========================================================================
  const domainAndFluidValid =
    stage1DomainIdentification.domainIdentified &&
    stage1DomainIdentification.modelStructurallyValid &&
    gasServiceStatus === "GAS_SERVICE_DECLARED";

  let status: B31_8PipelineReadinessStatus;
  let blockedReasonCode: string | undefined;
  let blockedReasonMessage: string | undefined;

  if (!stage1DomainIdentification.domainIdentified || !stage1DomainIdentification.modelStructurallyValid || gasServiceStatus === "NON_GAS_FLUID_MISMATCH") {
    status = "BLOCKED_DOMAIN_OR_MODEL_INVALID";
    blockedReasonCode = "BLOCKED_DOMAIN_OR_MODEL_INVALID";
    blockedReasonMessage =
      "Exécution numérique bloquée : le modèle PipelineSystem/PipelineSegment est invalide, hors domaine PIPELINE, ou déclare un fluide non gazeux incompatible avec ASME B31.8.";
  } else if (!isB31_8Resolved || crossCodeSubstitutionAttempted) {
    status = "BLOCKED_CODE_RESOLUTION";
    blockedReasonCode = crossCodeSubstitutionAttempted
      ? "CROSS_CODE_SUBSTITUTION_FORBIDDEN"
      : `CODE_RESOLUTION_${multiCodeResolution.status}`;
    blockedReasonMessage =
      "Exécution numérique bloquée : le code ASME B31.8 n'a pas été résolu de manière unique et sans conflit.";
  } else if (!domainAndFluidValid) {
    status = "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE";
    blockedReasonCode = "EDITION_OR_SOURCE_EVIDENCE_UNVERIFIED";
    blockedReasonMessage =
      "Exécution numérique bloquée : le service gaz naturel n'est pas intégralement déclaré et qualifié sans ambiguïté (service non déclaré ou service hydrogène/mélange nécessitant une qualification normative dédiée).";
  } else if (!isCalculationAvailable || !isCalculationQualified) {
    status = "BLOCKED_CALCULATION_NOT_IMPLEMENTED";
    blockedReasonCode = "CODE_CALCULATION_NOT_IMPLEMENTED";
    blockedReasonMessage =
      "Exécution numérique bloquée : ASME B31.8 est correctement identifié (domaine PIPELINE, édition 2022), mais les calculs numériques B31.8 ont le statut NOT_IMPLEMENTED faute de source normative vérifiée et de formules qualifiées.";
  } else if (!isEditionEvidenceVerified || !sourceDocInfo.isVerified) {
    status = "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE";
    blockedReasonCode = "EDITION_OR_SOURCE_EVIDENCE_UNVERIFIED";
    blockedReasonMessage =
      "Exécution numérique bloquée : les preuves normatives d'édition ou du document source ASME B31.8 ne sont pas intégralement VERIFIED.";
  } else {
    status = "READY_FOR_CALCULATION";
  }

  const canExecuteNumericalCalculation = status === "READY_FOR_CALCULATION";

  const stage6NumericalExecutionGate: B31_8Stage6NumericalExecutionGateReport = Object.freeze({
    canExecuteNumericalCalculation,
    executionPerformed: false,
    blockedReasonCode,
    blockedReasonMessage,
  });

  return Object.freeze({
    status,
    stage1DomainIdentification,
    stage2CodeIdentification,
    stage3NormativeEvidence,
    stage4CalculationQualification,
    stage5CalculationAvailability,
    stage6NumericalExecutionGate,
    diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
    messages: Object.freeze(messages),
  });
}

/**
 * Étape 6 : Exécute de manière contrôlée une demande de calcul sur un contexte de pipeline ASME B31.8.
 * - Vérifie d'abord les 5 premières étapes et la porte d'exécution de l'étape 6 via `evaluateB31_8PipelineReadiness`.
 * - Interdit formellement toute substitution inter-codes (ex: passer un `calculationInput` B31.3 ou B31.12).
 * - Bloque directement toute délégation au moteur normatif (`executeEngineeringCalculation`) dès lors que :
 *   - `readiness.status !== "READY_FOR_CALCULATION"`, ou
 *   - `readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation !== true`.
 * - En particulier :
 *   - `BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE` est bloqué directement sans appeler `executeEngineeringCalculation`,
 *   - `BLOCKED_CALCULATION_NOT_IMPLEMENTED` retourne directement `status: "NOT_IMPLEMENTED"` (`calculationExecuted: false`) sans appeler `executeEngineeringCalculation`.
 */
export function executeGuardedB31_8PipelineCalculation(
  readinessRequest: B31_8PipelineReadinessRequest,
  calculationInput: EngineeringCalculationInput,
  options?: EvaluateB31_8ReadinessOptions
): B31_8GuardedCalculationExecutionResult {
  const readiness = evaluateB31_8PipelineReadiness(
    {
      ...readinessRequest,
      requestedCalculationType:
        readinessRequest.requestedCalculationType ?? calculationInput?.calculationType,
      unitSystem: readinessRequest.unitSystem ?? calculationInput?.unitSystem,
    },
    options
  );

  // Garde anti-substitution : interdiction absolue d'exécuter un calcul ASME-B31.3 ou ASME-B31.12
  // sous couvert d'une évaluation pipeline ASME-B31.8 (ARCH-11 §3.D).
  if (calculationInput.designCodeId !== ASME_B31_8_DESIGN_CODE_ID) {
    return Object.freeze({
      readiness,
      calculationExecuted: false,
      calculationResult: Object.freeze({
        status: "OUT_OF_SCOPE",
        calculationType: calculationInput.calculationType,
        designCodeId: calculationInput.designCodeId,
        standardEdition: calculationInput.standardEdition,
        inputs: Object.freeze({
          pressure: calculationInput.pressure,
          unitSystem: calculationInput.unitSystem,
        }),
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          `CROSS_CODE_SUBSTITUTION_FORBIDDEN: Impossible d'exécuter le code '${calculationInput.designCodeId}' dans le pipeline ASME B31.8. Aucune substitution entre ASME-B31.3, ASME-B31.8 et ASME-B31.12 n'est autorisée.`,
        ]),
      }),
    });
  }

  const effectiveEdition =
    calculationInput.standardEdition ??
    readiness.stage2CodeIdentification.identifiedEdition;

  const frozenInputsSummary = Object.freeze({
    pressure: calculationInput.pressure,
    temperature: calculationInput.temperature,
    outsideDiameterMm: calculationInput.outsideDiameterMm,
    wallThicknessMm: calculationInput.wallThicknessMm,
    corrosionAllowanceMm: calculationInput.corrosionAllowanceMm,
    weldJointFactor: calculationInput.weldJointFactor,
    allowableStressMpa: calculationInput.allowableStressMpa,
    designFactor: calculationInput.designFactor,
    unitSystem: calculationInput.unitSystem,
  });

  // 1. Requête invalide, modèle/domaine invalide, ou résolution de code bloquée
  if (
    readiness.status === "INVALID_READINESS_REQUEST" ||
    readiness.status === "BLOCKED_DOMAIN_OR_MODEL_INVALID" ||
    readiness.status === "BLOCKED_CODE_RESOLUTION"
  ) {
    return Object.freeze({
      readiness,
      calculationExecuted: false,
      calculationResult: Object.freeze({
        status: "INVALID_INPUT",
        calculationType: calculationInput.calculationType,
        designCodeId: calculationInput.designCodeId,
        standardEdition: effectiveEdition,
        inputs: frozenInputsSummary,
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          readiness.stage6NumericalExecutionGate.blockedReasonMessage ??
            "Contexte pipeline ASME B31.8 invalide ou non résolu.",
          ...readiness.messages,
        ]),
      }),
    });
  }

  // 2. Calcul non implémenté ou non qualifié : blocage direct par la garde sans déléguer à executeEngineeringCalculation
  if (readiness.status === "BLOCKED_CALCULATION_NOT_IMPLEMENTED") {
    return Object.freeze({
      readiness,
      calculationExecuted: false,
      calculationResult: Object.freeze({
        status: "NOT_IMPLEMENTED",
        calculationType: calculationInput.calculationType,
        designCodeId: calculationInput.designCodeId,
        standardEdition: effectiveEdition,
        inputs: frozenInputsSummary,
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          `BLOCKED_CALCULATION_NOT_IMPLEMENTED (${
            readiness.stage6NumericalExecutionGate.blockedReasonCode ??
            "CODE_CALCULATION_NOT_IMPLEMENTED"
          }): ${
            readiness.stage6NumericalExecutionGate.blockedReasonMessage ??
            "Calcul numérique ASME B31.8 non implémenté ou non qualifié."
          }`,
          ...readiness.messages,
        ]),
      }),
    });
  }

  // 3. Preuves normatives d'édition/document source ou service gaz non vérifiés : blocage direct sans déléguer à executeEngineeringCalculation
  if (readiness.status === "BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE") {
    return Object.freeze({
      readiness,
      calculationExecuted: false,
      calculationResult: Object.freeze({
        status: "INVALID_INPUT",
        calculationType: calculationInput.calculationType,
        designCodeId: calculationInput.designCodeId,
        standardEdition: effectiveEdition,
        inputs: frozenInputsSummary,
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          `BLOCKED_UNVERIFIED_NORMATIVE_EVIDENCE (${
            readiness.stage6NumericalExecutionGate.blockedReasonCode ??
            "EDITION_OR_SOURCE_EVIDENCE_UNVERIFIED"
          }): ${
            readiness.stage6NumericalExecutionGate.blockedReasonMessage ??
            "Preuves normatives d'édition, document source ou service gaz non vérifiés."
          }`,
          ...readiness.messages,
        ]),
      }),
    });
  }

  // 4. Garde finale stricte : aucune délégation au moteur normatif n'est autorisée
  // si readiness.status !== "READY_FOR_CALCULATION" ou si canExecuteNumericalCalculation !== true.
  if (
    readiness.status !== "READY_FOR_CALCULATION" ||
    readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation !== true
  ) {
    return Object.freeze({
      readiness,
      calculationExecuted: false,
      calculationResult: Object.freeze({
        status: "INVALID_INPUT",
        calculationType: calculationInput.calculationType,
        designCodeId: calculationInput.designCodeId,
        standardEdition: effectiveEdition,
        inputs: frozenInputsSummary,
        assumptions: Object.freeze([]),
        warnings: Object.freeze([]),
        errors: Object.freeze([
          readiness.stage6NumericalExecutionGate.blockedReasonMessage ??
            "Exécution numérique bloquée par la garde de préparation ASME B31.8.",
          ...readiness.messages,
        ]),
      }),
    });
  }

  // Délégation autorisée uniquement lorsque readiness.status === "READY_FOR_CALCULATION"
  // ET readiness.stage6NumericalExecutionGate.canExecuteNumericalCalculation === true.
  const executor = options?.calculationEngineExecutor ?? executeEngineeringCalculation;
  const engineResult = executor(calculationInput, {
    projectId: readinessRequest.system.projectId,
    pipingSpecificationId: readinessRequest.pipingSpecId,
    designCodeId: ASME_B31_8_DESIGN_CODE_ID,
    standardEdition: effectiveEdition,
    unitSystem: calculationInput.unitSystem,
  });

  return Object.freeze({
    readiness,
    calculationExecuted: engineResult.status === "CALCULATED",
    calculationResult: engineResult,
  });
}
