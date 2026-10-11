/**
 * PDI NORMATIVE ENGINE — MULTI-CODE RESOLVER ENGINE
 * Reference: ARCH-09 (Multi-Code Resolver)
 *
 * Moteur déterministe, explicite et immuable pour la résolution multi-code
 * d'un code de conception (Design Code) à partir d'un domaine d'ingénierie,
 * d'un contexte projet ou d'une spécification de tuyauterie.
 *
 * SÉPARATION ARCHITECTURALE STRICTE DES 5 NIVEAUX (ARCH-09 §2) :
 * 1. Identification du code applicable (CANDIDATE -> RESOLVED / AMBIGUOUS / INSUFFICIENT_DATA / UNSUPPORTED_CODE).
 * 2. Vérification de l'édition normative et de ses preuves (NormativeEvidenceResolver).
 * 3. Qualification normative des formules et clauses (isFormulaQualified, validateDesignCodeFormulaReference).
 * 4. Disponibilité réelle des capacités de calcul dans le registre de calcul (DESIGN_CODE_CALCULATION_REGISTRY).
 * 5. Exécution d'un calcul (JAMAIS exécutée dans le resolver ; réservée à executeEngineeringCalculation).
 *
 * INVARIANTS (ARCH-09 §4 & §5) :
 * - Aucun second référentiel concurrent : s'appuie exclusivement sur PDI_STANDARDS_REGISTRY,
 *   DESIGN_CODE_CALCULATION_REGISTRY, defaultEngineeringDomainRegistry et NormativeEvidenceResolver.
 * - Statuts préservés sans modification :
 *   - ASME-B31.3 : PARTIAL (avec PRESSURE_WALL_THICKNESS vérifié en édition 2024 SI).
 *   - ASME-B31.4, ASME-B31.8, ASME-B31.12, EN-13480, ISO-13623 : NOT_IMPLEMENTED.
 * - Refus absolu de toute sélection silencieuse en présence de plusieurs candidats non départagés.
 * - Refus absolu de toute heuristique textuelle ou basée sur le nom d'un client.
 * - Une absence de preuve ne devient jamais une validation normative.
 */

import {
  defaultEngineeringDomainRegistry,
  EngineeringDomainRegistry,
} from "../../engineering/registry/engineeringDomainRegistry";
import { PDI_STANDARDS_REGISTRY } from "../registry/standardsRegistry";
import { getDesignCodeCalculationEntry } from "../registry/designCodeRegistry";
import {
  getPipingSpecById,
  getPipingSpecByCode,
} from "../registry/pipingSpecRegistry";
import type { INormativeEvidenceResolver } from "../registry/normativeEvidenceResolver";
import { defaultEvidenceResolver } from "../registry/normativeEvidenceResolver";
import type {
  DesignCodeId,
  NormativeStandard,
  StandardEdition,
} from "../types/normativeCoreTypes";
import type { PipingSpecification } from "../types/pipingSpecTypes";
import type { PipingSpecLookupFunction } from "../types/pipingSpecResolverTypes";
import type {
  CalculationCapabilityAvailabilityStatus,
  DesignCodeCalculationAvailabilityReport,
  DesignCodeCandidateTrace,
  DesignCodeEditionEvidenceReport,
  DesignCodeEditionVerificationStatus,
  DesignCodeNormativeQualificationStatus,
  DesignCodeResolutionSource,
  MultiCodeResolutionContext,
  MultiCodeResolutionResult,
} from "../types/multiCodeResolverTypes";
import {
  isFormulaQualified,
  validateDesignCodeFormulaReference,
} from "../validators/designCodeValidator";
import { validateMultiCodeResolutionContext } from "../validators/multiCodeResolverValidator";

export interface MultiCodeResolverConfig {
  readonly domainRegistry?: EngineeringDomainRegistry;
  readonly specLookup?: PipingSpecLookupFunction | readonly PipingSpecification[];
  readonly evidenceResolver?: INormativeEvidenceResolver;
}

export interface IMultiCodeResolver {
  resolve(context: MultiCodeResolutionContext): MultiCodeResolutionResult;
}

function buildEmptyEditionReport(
  requestedEdition?: StandardEdition
): DesignCodeEditionEvidenceReport {
  return Object.freeze({
    effectiveEdition: requestedEdition ? Object.freeze({ ...requestedEdition }) : undefined,
    standardRegistryEdition: undefined,
    formulaEditions: Object.freeze([]),
    editionVerificationStatus: requestedEdition ? "UNVERIFIED" : "MISSING_EDITION",
    evidenceIds: Object.freeze([]),
    verifiedEvidenceIds: Object.freeze([]),
    evidenceResolution: undefined,
  });
}

function buildEmptyCalculationAvailability(
  context?: MultiCodeResolutionContext
): DesignCodeCalculationAvailabilityReport {
  return Object.freeze({
    requestedCalculationType: context?.requestedCalculationType,
    requestedUnitSystem: context?.unitSystem,
    codeSupportStatus: undefined,
    supportedCalculationTypes: Object.freeze([]),
    availabilityStatus: "CODE_NOT_RESOLVED",
    isUsableForRequestedCalculation: false,
    matchedFormulaReference: undefined,
    qualificationStatus: "NOT_QUALIFIED",
    reasons: Object.freeze([
      "CODE_NOT_RESOLVED: Aucun code de conception unique n'a été résolu.",
    ]),
  });
}

export class MultiCodeResolver implements IMultiCodeResolver {
  private readonly domainRegistry: EngineeringDomainRegistry;
  private readonly lookupSpec: PipingSpecLookupFunction;
  private readonly evidenceResolver: INormativeEvidenceResolver;

  constructor(config: MultiCodeResolverConfig = {}) {
    this.domainRegistry = config.domainRegistry ?? defaultEngineeringDomainRegistry;
    this.evidenceResolver = config.evidenceResolver ?? defaultEvidenceResolver;

    if (typeof config.specLookup === "function") {
      this.lookupSpec = config.specLookup;
    } else if (Array.isArray(config.specLookup)) {
      const specs = config.specLookup;
      this.lookupSpec = (id: string) =>
        specs.find((s) => s.id === id || s.code === id);
    } else {
      this.lookupSpec = (id: string) =>
        getPipingSpecById(id) ?? getPipingSpecByCode(id);
    }
  }

  /**
   * Exécute la résolution déterministe multi-code sans jamais exécuter de calcul numérique.
   */
  public resolve(context: MultiCodeResolutionContext): MultiCodeResolutionResult {
    // =========================================================================
    // 0. VALIDATION STRUCTURELLE ET ANTI-HEURISTIQUE DU CONTEXTE
    // =========================================================================
    const validation = validateMultiCodeResolutionContext(context);
    if (!validation.valid) {
      const diagCodes = validation.errors.map((e) => e.code);
      const messages = validation.errors.map((e) => `${e.code}: ${e.message}`);
      return Object.freeze({
        status: "INVALID_CONTEXT",
        engineeringDomain:
          context && typeof context === "object" ? context.engineeringDomain : undefined,
        resolutionSource: "NONE",
        isUsableForCalculation: false,
        candidateCodeIds: Object.freeze([]),
        competingValidCodeIds: Object.freeze([]),
        candidateTraces: Object.freeze([]),
        editionReport: buildEmptyEditionReport(
          context && typeof context === "object" ? context.requestedEdition : undefined
        ),
        calculationAvailability: buildEmptyCalculationAvailability(
          context && typeof context === "object" ? context : undefined
        ),
        diagnosticCodes: Object.freeze(Array.from(new Set(diagCodes)).sort()),
        messages: Object.freeze(messages),
      });
    }

    const domainId = context.engineeringDomain;
    const enforceDomain = context.enforceDomainCompatibility ?? true;
    const domainDescriptor = domainId ? this.domainRegistry.getDomain(domainId) : undefined;
    const domainAllowedCodes: readonly string[] = domainDescriptor
      ? domainDescriptor.defaultNormativeDesignCodeRefs
      : [];

    // =========================================================================
    // 1. COLLECTE DÉTERMINISTE DES CODES CANDIDATS DEPUIS LES SOURCES STRUCTURÉES
    // =========================================================================
    const sourceMap = new Map<string, Set<DesignCodeResolutionSource>>();
    const diagnosticCodes: string[] = [];
    const messages: string[] = [];

    const addCandidateSource = (codeId: string, source: DesignCodeResolutionSource) => {
      const trimmed = codeId.trim();
      if (!sourceMap.has(trimmed)) {
        sourceMap.set(trimmed, new Set());
      }
      sourceMap.get(trimmed)!.add(source);
    };

    // Source A : explicitDesignCodeId
    const explicitCodeId = context.explicitDesignCodeId?.trim();
    if (explicitCodeId) {
      addCandidateSource(explicitCodeId, "EXPLICIT_DESIGN_CODE");
    }

    // Source B : pipingSpecId (résolution structurée via PipingSpecification)
    let resolvedPipingSpec: PipingSpecification | undefined;
    let specCodeId: string | undefined;
    if (context.pipingSpecId) {
      const specIdTrimmed = context.pipingSpecId.trim();
      resolvedPipingSpec = this.lookupSpec(specIdTrimmed);
      if (!resolvedPipingSpec) {
        diagnosticCodes.push("PIPING_SPEC_NOT_FOUND");
        messages.push(
          `PIPING_SPEC_NOT_FOUND: La spécification de tuyauterie '${specIdTrimmed}' est introuvable dans le registre.`
        );
      } else if (resolvedPipingSpec.designCodeId && resolvedPipingSpec.designCodeId.trim().length > 0) {
        specCodeId = resolvedPipingSpec.designCodeId.trim();
        addCandidateSource(specCodeId, "PIPING_SPECIFICATION");
      } else {
        diagnosticCodes.push("PIPING_SPEC_MISSING_DESIGN_CODE");
        messages.push(
          `PIPING_SPEC_MISSING_DESIGN_CODE: La spécification '${resolvedPipingSpec.id}' ne déclare aucun designCodeId.`
        );
      }
    }

    // Source C : projectDefaultDesignCodeId
    const projectCodeId = context.projectDefaultDesignCodeId?.trim();
    if (projectCodeId) {
      addCandidateSource(projectCodeId, "PROJECT_NORMATIVE_REF");
    }

    // Source D : candidateDesignCodeIds explicites
    if (context.candidateDesignCodeIds && context.candidateDesignCodeIds.length > 0) {
      for (const cid of context.candidateDesignCodeIds) {
        addCandidateSource(cid.trim(), "PROJECT_NORMATIVE_REF");
      }
    }

    // Source E : Références par défaut du domaine d'ingénierie (ARCH-08)
    // Utilisées comme pool de candidats uniquement si aucune sélection directe n'a été fournie
    const hasDirectStructuredSelection =
      Boolean(explicitCodeId) ||
      Boolean(specCodeId) ||
      Boolean(projectCodeId) ||
      Boolean(context.candidateDesignCodeIds && context.candidateDesignCodeIds.length > 0);

    if (!hasDirectStructuredSelection && domainDescriptor) {
      for (const dCode of domainDescriptor.defaultNormativeDesignCodeRefs) {
        addCandidateSource(dCode, "DOMAIN_SINGLE_REGISTERED_CANDIDATE");
      }
    }

    // =========================================================================
    // 2. CAS DE DONNÉES INSUFFISANTES (AUCUN CANDIDAT STRUCTURÉ IDENTIFIÉ)
    // =========================================================================
    const allCandidateIds = Array.from(sourceMap.keys()).sort();
    if (allCandidateIds.length === 0) {
      diagnosticCodes.push("INSUFFICIENT_STRUCTURED_CONTEXT");
      messages.push(
        "INSUFFICIENT_STRUCTURED_CONTEXT: Aucune donnée structurée (code explicite, spécification valide, référence projet ou domaine) ne permet d'identifier un code candidat."
      );
      return Object.freeze({
        status: "INSUFFICIENT_DATA",
        engineeringDomain: domainId,
        resolutionSource: "NONE",
        isUsableForCalculation: false,
        candidateCodeIds: Object.freeze([]),
        competingValidCodeIds: Object.freeze([]),
        candidateTraces: Object.freeze([]),
        editionReport: buildEmptyEditionReport(context.requestedEdition),
        calculationAvailability: buildEmptyCalculationAvailability(context),
        diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
        messages: Object.freeze(messages),
      });
    }

    // =========================================================================
    // 3. ÉVALUATION INDIVIDUELLE DE CHAQUE CANDIDAT CONTRE LES REGISTRES
    // =========================================================================
    const candidateTraces: DesignCodeCandidateTrace[] = [];
    const validDesignCodeIds: string[] = [];

    for (const cid of allCandidateIds) {
      const standard: NormativeStandard | undefined = PDI_STANDARDS_REGISTRY[cid];
      const isRegisteredStandard = Boolean(standard);
      const isDesignCodeType = standard?.standardType === "DESIGN_CODE";
      const calcEntry = getDesignCodeCalculationEntry(cid);
      const isRegisteredInCalculationEngine = Boolean(calcEntry);
      const isDeclaredInDomain = domainDescriptor
        ? domainAllowedCodes.includes(cid)
        : true;
      const sources = Object.freeze(Array.from(sourceMap.get(cid) ?? []));

      let rejectionReason: string | undefined;
      if (!isRegisteredStandard) {
        rejectionReason = `DESIGN_CODE_NOT_IN_STANDARDS_REGISTRY: '${cid}' est absent de PDI_STANDARDS_REGISTRY.`;
      } else if (!isDesignCodeType) {
        rejectionReason = `STANDARD_IS_NOT_DESIGN_CODE: '${cid}' est de type '${standard!.standardType}', pas 'DESIGN_CODE'.`;
      } else if (domainDescriptor && enforceDomain && !isDeclaredInDomain) {
        rejectionReason = `DOMAIN_DESIGN_CODE_MISMATCH: Le code '${cid}' n'est pas déclaré comme applicable au domaine '${domainId}'.`;
      }

      if (!rejectionReason) {
        validDesignCodeIds.push(cid);
      }

      candidateTraces.push(
        Object.freeze({
          codeId: cid,
          isRegisteredStandard,
          isDesignCodeType,
          isRegisteredInCalculationEngine,
          isDeclaredInDomain,
          implementationStatus: calcEntry?.status,
          sources,
          rejectionReason,
        })
      );
    }

    // =========================================================================
    // 4. DÉTECTION DE CONFLITS ENTRE SOURCES EXPLICITES (EXPLICIT / SPEC / PROJECT)
    // =========================================================================
    const activeAuthoritativeSelections = new Set<string>();
    if (explicitCodeId) activeAuthoritativeSelections.add(explicitCodeId);
    if (specCodeId) activeAuthoritativeSelections.add(specCodeId);
    if (projectCodeId) activeAuthoritativeSelections.add(projectCodeId);
    if (context.candidateDesignCodeIds) {
      for (const cid of context.candidateDesignCodeIds) {
        activeAuthoritativeSelections.add(cid.trim());
      }
    }

    if (activeAuthoritativeSelections.size > 1) {
      // Plusieurs sources structurées indiquent des codes différents -> AMBIGUOUS (refus d'arbitrage silencieux)
      if (explicitCodeId && specCodeId && explicitCodeId !== specCodeId) {
        diagnosticCodes.push("CONFLICT_EXPLICIT_VS_PIPING_SPEC");
      }
      if (explicitCodeId && projectCodeId && explicitCodeId !== projectCodeId) {
        diagnosticCodes.push("CONFLICT_EXPLICIT_VS_PROJECT_REF");
      }
      if (specCodeId && projectCodeId && specCodeId !== projectCodeId) {
        diagnosticCodes.push("CONFLICT_PIPING_SPEC_VS_PROJECT_REF");
      }
      if (context.candidateDesignCodeIds && context.candidateDesignCodeIds.length > 1) {
        diagnosticCodes.push("MULTIPLE_CANDIDATE_CODES_UNDISCRIMINATED");
      }
      diagnosticCodes.push("AMBIGUOUS_DESIGN_CODE_CANDIDATES");
      messages.push(
        `AMBIGUOUS_DESIGN_CODE_CANDIDATES: Plusieurs codes candidats distincts sont en compétition (${Array.from(
          activeAuthoritativeSelections
        )
          .sort()
          .join(", ")}). Toute sélection implicite ou silencieuse est interdite.`
      );

      return Object.freeze({
        status: "AMBIGUOUS",
        engineeringDomain: domainId,
        resolutionSource: "NONE",
        isUsableForCalculation: false,
        candidateCodeIds: Object.freeze(allCandidateIds),
        competingValidCodeIds: Object.freeze(validDesignCodeIds.slice().sort()),
        candidateTraces: Object.freeze(candidateTraces),
        editionReport: buildEmptyEditionReport(context.requestedEdition),
        calculationAvailability: buildEmptyCalculationAvailability(context),
        diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
        messages: Object.freeze(messages),
      });
    }

    // =========================================================================
    // 5. CAS OÙ SEUL LE DOMAINE EST FOURNI (SANS SÉLECTION EXPLICITE)
    // =========================================================================
    if (!hasDirectStructuredSelection && domainDescriptor) {
      // Tous les domaines canoniques (PIPING, PIPELINE, PACKAGE, EQUIPMENT) déclarent plusieurs codes possibles.
      // Refus strict de choisir silencieusement le premier élément (pas de defaultNormativeDesignCodeRefs[0] implicite).
      if (allCandidateIds.length > 1 || validDesignCodeIds.length > 1) {
        diagnosticCodes.push("AMBIGUOUS_DOMAIN_MULTIPLE_CODES");
        messages.push(
          `AMBIGUOUS_DOMAIN_MULTIPLE_CODES: Le domaine '${domainId}' référence plusieurs codes de conception (${allCandidateIds.join(
            ", "
          )}). Aucune sélection silencieuse du premier code n'est autorisée sans choix explicite (explicitDesignCodeId, pipingSpecId ou projectDefaultDesignCodeId).`
        );

        return Object.freeze({
          status: "AMBIGUOUS",
          engineeringDomain: domainId,
          resolutionSource: "NONE",
          isUsableForCalculation: false,
          candidateCodeIds: Object.freeze(allCandidateIds),
          competingValidCodeIds: Object.freeze(validDesignCodeIds.slice().sort()),
          candidateTraces: Object.freeze(candidateTraces),
          editionReport: buildEmptyEditionReport(context.requestedEdition),
          calculationAvailability: buildEmptyCalculationAvailability(context),
          diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
          messages: Object.freeze(messages),
        });
      }
    }

    // =========================================================================
    // 6. CAS OÙ LE CODE DEMANDÉ EST INCONNU, NON DESIGN_CODE OU HORS DOMAINE
    // =========================================================================
    if (validDesignCodeIds.length === 0) {
      for (const trace of candidateTraces) {
        if (!trace.isRegisteredStandard) {
          diagnosticCodes.push("DESIGN_CODE_NOT_FOUND");
        } else if (!trace.isDesignCodeType) {
          diagnosticCodes.push("STANDARD_IS_NOT_DESIGN_CODE");
        } else if (!trace.isDeclaredInDomain) {
          diagnosticCodes.push("DOMAIN_DESIGN_CODE_MISMATCH");
        }
        if (trace.rejectionReason) {
          messages.push(trace.rejectionReason);
        }
      }

      return Object.freeze({
        status: "UNSUPPORTED_CODE",
        engineeringDomain: domainId,
        resolutionSource: "NONE",
        isUsableForCalculation: false,
        candidateCodeIds: Object.freeze(allCandidateIds),
        competingValidCodeIds: Object.freeze([]),
        candidateTraces: Object.freeze(candidateTraces),
        editionReport: buildEmptyEditionReport(context.requestedEdition),
        calculationAvailability: buildEmptyCalculationAvailability(context),
        diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
        messages: Object.freeze(messages),
      });
    }

    // =========================================================================
    // 7. CODE UNIQUE IDENTIFIÉ (ÉTAPE 1 : IDENTIFICATION = RESOLVED)
    // =========================================================================
    const resolvedCodeId = validDesignCodeIds[0];
    const resolvedStandard = PDI_STANDARDS_REGISTRY[resolvedCodeId]!;
    const resolvedCalcEntry = getDesignCodeCalculationEntry(resolvedCodeId);
    const resolvedTrace = candidateTraces.find((t) => t.codeId === resolvedCodeId)!;

    let primarySource: DesignCodeResolutionSource = "NONE";
    if (resolvedTrace.sources.includes("EXPLICIT_DESIGN_CODE")) {
      primarySource = "EXPLICIT_DESIGN_CODE";
    } else if (resolvedTrace.sources.includes("PIPING_SPECIFICATION")) {
      primarySource = "PIPING_SPECIFICATION";
    } else if (resolvedTrace.sources.includes("PROJECT_NORMATIVE_REF")) {
      primarySource = "PROJECT_NORMATIVE_REF";
    } else if (resolvedTrace.sources.includes("DOMAIN_SINGLE_REGISTERED_CANDIDATE")) {
      primarySource = "DOMAIN_SINGLE_REGISTERED_CANDIDATE";
    }

    // =========================================================================
    // 8. ÉTAPE 2 : VÉRIFICATION DE L'ÉDITION ET DES PREUVES NORMATIVES
    // =========================================================================
    const editionReport = this.evaluateEditionAndEvidence(
      resolvedCodeId,
      resolvedStandard,
      resolvedCalcEntry?.formulaReferences ?? [],
      context,
      resolvedPipingSpec
    );

    if (editionReport.editionVerificationStatus === "MISSING_EDITION") {
      diagnosticCodes.push("EDITION_NOT_SPECIFIED");
    } else if (editionReport.editionVerificationStatus === "UNVERIFIED") {
      diagnosticCodes.push("EDITION_EVIDENCE_UNVERIFIED");
    }

    // =========================================================================
    // 9. ÉTAPES 3 & 4 : QUALIFICATION NORMATIVE & DISPONIBILITÉ DE CALCUL
    // =========================================================================
    const calculationAvailability = this.evaluateCalculationAvailability(
      resolvedCodeId,
      resolvedCalcEntry,
      editionReport,
      context
    );

    for (const reason of calculationAvailability.reasons) {
      const codeMatch = /^([A-Z0-9_]+):/.exec(reason);
      if (codeMatch) {
        diagnosticCodes.push(codeMatch[1]);
      }
      messages.push(reason);
    }

    return Object.freeze({
      status: "RESOLVED",
      engineeringDomain: domainId,
      resolvedDesignCodeId: resolvedCodeId,
      resolvedStandard,
      resolutionSource: primarySource,
      implementationStatus: resolvedCalcEntry?.status ?? "NOT_IMPLEMENTED",
      isUsableForCalculation: calculationAvailability.isUsableForRequestedCalculation,
      candidateCodeIds: Object.freeze(allCandidateIds),
      competingValidCodeIds: Object.freeze([resolvedCodeId]),
      candidateTraces: Object.freeze(candidateTraces),
      editionReport,
      calculationAvailability,
      diagnosticCodes: Object.freeze(Array.from(new Set(diagnosticCodes)).sort()),
      messages: Object.freeze(messages),
    });
  }

  /**
   * Étape 2 : Évalue l'édition normative et résout les preuves via NormativeEvidenceResolver.
   * RÈGLE : Une édition présente dans PDI_STANDARDS_REGISTRY sans preuve VERIFIED associée
   *         ne devient JAMAIS automatiquement VERIFIED.
   */
  private evaluateEditionAndEvidence(
    resolvedCodeId: DesignCodeId,
    standard: NormativeStandard,
    formulaReferences: readonly { readonly standardEdition?: StandardEdition }[],
    context: MultiCodeResolutionContext,
    pipingSpec?: PipingSpecification
  ): DesignCodeEditionEvidenceReport {
    const standardRegistryEdition = standard.edition;
    const formulaEditions: StandardEdition[] = [];
    for (const fRef of formulaReferences) {
      if (fRef.standardEdition) {
        formulaEditions.push(fRef.standardEdition);
      }
    }

    const effectiveEdition =
      context.requestedEdition ?? standardRegistryEdition ?? formulaEditions[0];

    // Collecte des evidenceIds pertinentes (contexte explicite + standard + pipingSpec)
    const rawEvidenceIds = new Set<string>();
    if (context.evidenceIds) {
      for (const eid of context.evidenceIds) {
        rawEvidenceIds.add(eid.trim());
      }
    }
    if (standard.evidenceIds) {
      for (const eid of standard.evidenceIds) {
        rawEvidenceIds.add(eid.trim());
      }
    }
    if (pipingSpec?.evidenceIds) {
      for (const eid of pipingSpec.evidenceIds) {
        rawEvidenceIds.add(eid.trim());
      }
    }

    const sortedEvidenceIds = Array.from(rawEvidenceIds).sort();
    const evidenceResolution =
      sortedEvidenceIds.length > 0
        ? this.evidenceResolver.resolveEvidenceSet(sortedEvidenceIds)
        : undefined;

    const verifiedEvidenceIds: string[] = [];
    let hasMatchingStandardVerifiedEvidence = false;

    if (evidenceResolution) {
      for (const res of evidenceResolution.results) {
        if (res.status === "FOUND_VERIFIED" && res.evidence) {
          verifiedEvidenceIds.push(res.evidenceId);
          const stdMatches = res.evidence.standardId === resolvedCodeId;
          const edMatches =
            !effectiveEdition?.year ||
            res.evidence.editionId.includes(effectiveEdition.year);
          if (stdMatches && edMatches) {
            hasMatchingStandardVerifiedEvidence = true;
          }
        }
      }
    }

    let editionVerificationStatus: DesignCodeEditionVerificationStatus;
    if (!effectiveEdition || !effectiveEdition.year) {
      editionVerificationStatus = "MISSING_EDITION";
    } else if (
      hasMatchingStandardVerifiedEvidence &&
      evidenceResolution !== undefined &&
      evidenceResolution.allVerified
    ) {
      editionVerificationStatus = "VERIFIED";
    } else {
      // Même si l'édition existe dans le registre ou la formule, sans preuve NormativeEvidence VERIFIED,
      // l'édition en tant que preuve documentaire reste UNVERIFIED (ARCH-09 §2.2 & §4).
      editionVerificationStatus = "UNVERIFIED";
    }

    return Object.freeze({
      effectiveEdition: effectiveEdition ? Object.freeze({ ...effectiveEdition }) : undefined,
      standardRegistryEdition,
      formulaEditions: Object.freeze(formulaEditions),
      editionVerificationStatus,
      evidenceIds: Object.freeze(sortedEvidenceIds),
      verifiedEvidenceIds: Object.freeze(verifiedEvidenceIds.sort()),
      evidenceResolution,
    });
  }

  /**
   * Étapes 3 & 4 : Évalue la qualification normative des formules et la disponibilité
   * réelle de la capacité de calcul demandée dans DESIGN_CODE_CALCULATION_REGISTRY.
   */
  private evaluateCalculationAvailability(
    resolvedCodeId: DesignCodeId,
    calcEntry: ReturnType<typeof getDesignCodeCalculationEntry>,
    editionReport: DesignCodeEditionEvidenceReport,
    context: MultiCodeResolutionContext
  ): DesignCodeCalculationAvailabilityReport {
    const requestedCalc = context.requestedCalculationType;
    const requestedUnits = context.unitSystem;
    const reasons: string[] = [];

    if (!calcEntry) {
      reasons.push(
        `CALCULATION_ENTRY_NOT_FOUND: Le code '${resolvedCodeId}' n'a aucune entrée dans DESIGN_CODE_CALCULATION_REGISTRY.`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: "NOT_IMPLEMENTED",
        supportedCalculationTypes: Object.freeze([]),
        availabilityStatus: "NOT_IMPLEMENTED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus: "NOT_QUALIFIED",
        reasons: Object.freeze(reasons),
      });
    }

    // Qualification globale des formules du code
    const qualifiedFormulas = calcEntry.formulaReferences.filter((f) => {
      const v = validateDesignCodeFormulaReference(f);
      return v.valid && isFormulaQualified(f);
    });

    let qualificationStatus: DesignCodeNormativeQualificationStatus;
    if (calcEntry.formulaReferences.length === 0) {
      qualificationStatus = "NOT_QUALIFIED";
    } else if (qualifiedFormulas.length === calcEntry.formulaReferences.length) {
      qualificationStatus =
        calcEntry.status === "SUPPORTED" ? "QUALIFIED" : "PARTIALLY_QUALIFIED";
    } else if (qualifiedFormulas.length > 0) {
      qualificationStatus = "PARTIALLY_QUALIFIED";
    } else {
      qualificationStatus = "UNVERIFIED";
    }

    // Si le code est NOT_IMPLEMENTED dans le registre (ex: ASME-B31.4, ASME-B31.8, ASME-B31.12, EN-13480, ISO-13623)
    if (calcEntry.status === "NOT_IMPLEMENTED") {
      reasons.push(
        `CODE_CALCULATION_NOT_IMPLEMENTED: Le code '${resolvedCodeId}' est identifié mais son statut dans le moteur de calcul est 'NOT_IMPLEMENTED'. Aucun calcul n'est disponible.`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "NOT_IMPLEMENTED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus,
        reasons: Object.freeze(reasons),
      });
    }

    // Si aucun type de calcul spécifique n'a été demandé dans le contexte
    if (!requestedCalc) {
      reasons.push(
        `CALCULATION_TYPE_NOT_REQUESTED: Le code '${resolvedCodeId}' a le statut '${calcEntry.status}' (calculs supportés: ${calcEntry.supportedCalculationTypes.join(
          ", "
        )}), mais aucune capacité de calcul spécifique (requestedCalculationType) n'a été demandée.`
      );
      return Object.freeze({
        requestedCalculationType: undefined,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "NOT_EVALUATED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus,
        reasons: Object.freeze(reasons),
      });
    }

    // Vérifier si le type de calcul demandé est supporté par ce code
    if (!calcEntry.supportedCalculationTypes.includes(requestedCalc)) {
      reasons.push(
        `CALCULATION_CAPABILITY_NOT_IMPLEMENTED: Le calcul '${requestedCalc}' n'est pas implémenté pour '${resolvedCodeId}' (statut du code: '${calcEntry.status}').`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "NOT_IMPLEMENTED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus,
        reasons: Object.freeze(reasons),
      });
    }

    // Recherche de la formule correspondant au type de calcul demandé
    const candidateFormulas = calcEntry.formulaReferences.filter(
      (f) => f.calculationType === requestedCalc || !f.calculationType
    );

    if (candidateFormulas.length === 0) {
      reasons.push(
        `FORMULA_REFERENCE_MISSING: Aucune référence de formule trouvée pour '${requestedCalc}' sous '${resolvedCodeId}'.`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "NOT_IMPLEMENTED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus: "NOT_QUALIFIED",
        reasons: Object.freeze(reasons),
      });
    }

    // Vérification de la correspondance d'édition si une édition spécifique a été demandée
    const requestedYear = context.requestedEdition?.year;
    const editionMatchedFormula = candidateFormulas.find(
      (f) =>
        !f.standardEdition?.year ||
        !requestedYear ||
        f.standardEdition.year === requestedYear
    );

    if (!editionMatchedFormula) {
      const supportedYears = candidateFormulas
        .map((f) => f.standardEdition?.year)
        .filter(Boolean)
        .join(", ");
      reasons.push(
        `FORMULA_EDITION_MISMATCH: L'édition demandée '${requestedYear}' ne correspond pas aux éditions de formules qualifiées (${supportedYears}) pour '${resolvedCodeId}' / '${requestedCalc}'.`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "EDITION_MISMATCH",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: undefined,
        qualificationStatus,
        reasons: Object.freeze(reasons),
      });
    }

    // Vérification de la qualification normative de la formule (Étape 3)
    const formulaValidation = validateDesignCodeFormulaReference(editionMatchedFormula);
    if (!formulaValidation.valid || !isFormulaQualified(editionMatchedFormula)) {
      reasons.push(
        `FORMULA_NOT_QUALIFIED: La formule '${editionMatchedFormula.id}' n'est pas qualifiée (clause ou source manquante, ou statut non VERIFIED/LICENSED).`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "FORMULA_UNVERIFIED",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: editionMatchedFormula,
        qualificationStatus: "UNVERIFIED",
        reasons: Object.freeze(reasons),
      });
    }

    // Vérification du contrat d'unités si unitSystem est renseigné (ex: F01 requiert exclusivement SI)
    if (
      requestedUnits &&
      editionMatchedFormula.units?.unitSystem &&
      editionMatchedFormula.units.unitSystem !== requestedUnits
    ) {
      reasons.push(
        `UNIT_CONTRACT_UNVERIFIED: La formule '${editionMatchedFormula.id}' est qualifiée exclusivement pour le système d'unités '${editionMatchedFormula.units.unitSystem}', pas '${requestedUnits}'.`
      );
      return Object.freeze({
        requestedCalculationType: requestedCalc,
        requestedUnitSystem: requestedUnits,
        codeSupportStatus: calcEntry.status,
        supportedCalculationTypes: calcEntry.supportedCalculationTypes,
        availabilityStatus: "UNVERIFIED_UNIT_SYSTEM",
        isUsableForRequestedCalculation: false,
        matchedFormulaReference: editionMatchedFormula,
        qualificationStatus,
        reasons: Object.freeze(reasons),
      });
    }

    // La capacité de calcul demandée est qualifiée et disponible dans le moteur
    const availabilityStatus: CalculationCapabilityAvailabilityStatus = "AVAILABLE";
    reasons.push(
      `CALCULATION_CAPABILITY_AVAILABLE: La capacité '${requestedCalc}' sous '${resolvedCodeId}' (formule '${editionMatchedFormula.id}', clause '${editionMatchedFormula.clauseReference}') est qualifiée et disponible pour évaluation par le moteur de calcul.`
    );

    return Object.freeze({
      requestedCalculationType: requestedCalc,
      requestedUnitSystem: requestedUnits,
      codeSupportStatus: calcEntry.status,
      supportedCalculationTypes: calcEntry.supportedCalculationTypes,
      availabilityStatus,
      isUsableForRequestedCalculation: true,
      matchedFormulaReference: editionMatchedFormula,
      qualificationStatus,
      reasons: Object.freeze(reasons),
    });
  }
}

/**
 * Instance singleton par défaut du Multi-Code Resolver.
 */
export const defaultMultiCodeResolver = new MultiCodeResolver();

/**
 * Fonction pure d'aide pour résoudre un code de conception selon un contexte explicite.
 */
export function resolveApplicableDesignCode(
  context: MultiCodeResolutionContext,
  config?: MultiCodeResolverConfig
): MultiCodeResolutionResult {
  const resolver = config ? new MultiCodeResolver(config) : defaultMultiCodeResolver;
  return resolver.resolve(context);
}
