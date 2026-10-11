/**
 * PDI NORMATIVE ENGINE — INDEX & PUBLIC API
 * Reference: PATCH NORM-01, NORM-02, NORM-02-R1.1, NORM-03, NORM-03-R1, NORM-04, NORM-05, NORM-06, NORM-07
 */

export * from "./types/normativeCoreTypes";
export * from "./types/pipeDimensionalTypes";
export * from "./types/fittingTypes";
export * from "./types/flangeTypes";
export * from "./types/valveTypes";
export * from "./types/materialTypes";
export * from "./types/pipingSpecTypes";
export * from "./types/complianceTypes";
export * from "./types/designCodeTypes";
export * from "./types/normativeEvidenceTypes";
export * from "./types/normativeCompatibilityTypes";
export * from "./types/normativeCompatibilityMatrixTypes";
export * from "./types/normativeComponentCompatibilityTypes";
export * from "./types/normativeComponentMaterialCompatibilityTypes";
export * from "./types/normativeComponentRatingCompatibilityTypes";
export * from "./types/normativeComponentDimensionalCompatibilityTypes";
export * from "./types/normativeComponentProductCompatibilityTypes";
export * from "./types/normativeMultiCompatibilityTypes";
export * from "./types/normativeSpecCompatibilityIntegrationTypes";
export * from "./types/normativeComponentIntegrationTypes";
export * from "./types/normativeEvidenceTraceabilityTypes";
export * from "./types/pipingSpecResolverTypes";
export * from "./types/componentSelectionTypes";
export * from "./types/componentCandidateSelectionTypes";
export * from "./types/componentCandidateRegistryTypes";
export * from "./types/componentResolutionTypes";
export * from "./types/normativeSourceDocumentTypes";
export * from "./types/b31_3DataTypes";
export * from "./types/multiCodeResolverTypes";
export * from "./types/b31_8ReadinessTypes";
export * from "./data/b31_3/b31_3Types";
export * from "./data/b31_3/b31_3VerifiedData";

export * from "./registry/standardsRegistry";
export * from "./registry/pipeDimensionalRegistry";
export * from "./registry/fittingRegistry";
export * from "./registry/flangeRegistry";
export * from "./registry/valveRegistry";
export * from "./registry/materialRegistry";
export * from "./registry/pipingSpecRegistry";
export * from "./registry/designCodeRegistry";
export * from "./registry/normativeEvidenceRegistry";
export * from "./registry/normativeEvidenceResolver";
export * from "./registry/normativeCompatibilityRegistry";
export * from "./registry/normativeCompatibilityMatrixRegistry";
export * from "./registry/componentCandidateRegistry";
export * from "./registry/normativeSourceDocumentRegistry";
export * from "./registry/normativeSourceDocumentResolver";
export * from "./data/b31_3/b31_3DataRegistry";
export * from "./data/b31_3/b31_3DataResolver";
export * from "./data/b31_3/b31_3Integration";

export * from "./validators/pipeDimensionalValidator";
export * from "./validators/fittingValidator";
export * from "./validators/flangeValidator";
export * from "./validators/valveValidator";
export * from "./validators/materialValidator";
export * from "./validators/pipingSpecValidator";
export * from "./validators/designCodeValidator";
export * from "./validators/normativeSourceDocumentValidator";
export * from "./data/b31_3/b31_3DataValidator";
export {
  validateNormativeEvidence,
  validateNormativeEdition,
  validateNormativeQualification,
  isDisallowedTokenHeuristic,
  validateNormativeVerifiedValue as validateNormativeVerifiedValueStructural,
} from "./validators/normativeEvidenceValidator";
export * from "./validators/normativeVerifiedValueValidator";
export * from "./validators/normativeCalculationBoundary";
export * from "./validators/normativeCompatibilityValidator";
export * from "./validators/normativeCompatibilityMatrixValidator";
export * from "./validators/normativeComponentCompatibilityValidator";
export * from "./validators/normativeComponentMaterialCompatibilityValidator";
export * from "./validators/normativeComponentRatingCompatibilityValidator";
export * from "./validators/normativeComponentDimensionalCompatibilityValidator";
export * from "./validators/normativeComponentProductCompatibilityValidator";
export * from "./validators/normativeMultiCompatibilityValidator";
export * from "./validators/normativeSpecCompatibilityIntegrationValidator";
export * from "./validators/normativeEvidenceTraceabilityValidator";
export {
  validateNormativeComponentIntegrationQuery,
  ALLOWED_COMPONENT_RESOLUTION_STATUSES as ALLOWED_COMPONENT_INTEGRATION_RESOLUTION_STATUSES,
} from "./validators/normativeComponentIntegrationValidator";
export type {
  ComponentIntegrationValidationErrorCode,
  ComponentIntegrationValidationError,
  ComponentIntegrationValidationResult,
} from "./validators/normativeComponentIntegrationValidator";
export * from "./validators/pipingSpecResolverValidator";
export * from "./validators/componentSelectionValidator";
export * from "./validators/componentCandidateSelectionValidator";
export * from "./validators/componentCandidateRegistryValidator";
export * from "./validators/componentResolutionValidator";
export * from "./validators/multiCodeResolverValidator";

export * from "./engine/designCodeEngine";
export * from "./engine/multiCodeResolver";
export * from "./engine/b31_8ReadinessEngine";
export * from "./engine/normativeCompatibilityEngine";
export * from "./engine/normativeCompatibilityMatrixEngine";
export * from "./engine/normativeComponentCompatibilityEngine";
export * from "./engine/normativeComponentMaterialCompatibilityEngine";
export * from "./engine/normativeComponentRatingCompatibilityEngine";
export * from "./engine/normativeComponentDimensionalCompatibilityEngine";
export * from "./engine/normativeComponentProductCompatibilityEngine";
export * from "./engine/normativeMultiCompatibilityEngine";
export * from "./engine/normativeSpecCompatibilityIntegrationEngine";
export * from "./engine/normativeComponentIntegrationEngine";
export * from "./engine/normativeEvidenceTraceabilityEngine";
export * from "./engine/pipingSpecResolver";
export * from "./engine/componentSelectionEngine";
export * from "./engine/componentCandidateSelectionEngine";
export * from "./engine/componentCandidateResolver";
export * from "./engine/componentResolutionEngine";

export * from "./tests/normativeTests";
export * from "./tests/pipeDimensionalTests";
export * from "./tests/fittingTests";
export * from "./tests/flangeTests";
export * from "./tests/valveTests";
export * from "./tests/materialTests";
export * from "./tests/pipingSpecTests";
export * from "./tests/designCodeTests";
export * from "./tests/normativeEvidenceTests";
export * from "./tests/normativeEvidenceRegistryTests";
export * from "./tests/normativeVerifiedValueTests";
export * from "./tests/normativeCalculationBoundaryTests";
export * from "./tests/normativeCalculationIntegrationTests";
export * from "./tests/normativeCompatibilityTests";
export * from "./tests/normativeCompatibilityMatrixTests";
export * from "./tests/normativeComponentCompatibilityTests";
export * from "./tests/normativeComponentMaterialCompatibilityTests";
export * from "./tests/normativeComponentRatingCompatibilityTests";
export * from "./tests/normativeComponentDimensionalCompatibilityTests";
export * from "./tests/normativeComponentProductCompatibilityTests";
export * from "./tests/normativeMultiCompatibilityTests";
export * from "./tests/normativeSpecCompatibilityIntegrationTests";
export * from "./tests/normativeComponentIntegrationTests";
export * from "./tests/normativeEvidenceTraceabilityTests";
export * from "./tests/pipingSpecResolverTests";
export * from "./tests/componentSelectionTests";
export * from "./tests/componentCandidateSelectionTests";
export * from "./tests/componentCandidateRegistryTests";
export * from "./tests/componentResolutionTests";
export * from "./tests/normativeSourceDocumentTests";
export * from "./tests/b31_3DataTests";
export * from "./tests/b31_3IntegrationTests";
export * from "./tests/b31_3F01IntegrationTests";
export * from "./tests/normativeGlobalIntegrationTests";
export * from "./integration/isometricNormativeContext";
export * from "./integration/isometricNormativeAdapter";
export * from "./integration/isometricNormativeBridge";
export * from "./tests/arch01IsometricNormativeBridgeTests";
export * from "./tests/arch02PmsAuthorityUnificationTests";
export * from "./tests/arch03UniversalModelTests";
export * from "./tests/arch04ProjectWorkspaceDataTests";
export * from "./tests/arch05TechnicalWorkflowTests";
export * from "./tests/arch06ComponentSelectionCompatibilityTests";
export * from "./tests/arch07IndustrialArchitectureTests";
export * from "./tests/arch08MultiDomainArchitectureTests";
export * from "./tests/arch09MultiCodeResolverTests";
export * from "./tests/arch10PipelineEngineeringModelTests";
export * from "./tests/arch11B31_8PipelineReadinessTests";
