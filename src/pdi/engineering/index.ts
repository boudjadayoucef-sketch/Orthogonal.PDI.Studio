/**
 * PDI ENGINEERING PLATFORM — PUBLIC MODULE ENTRY POINT (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Clean re-export of all multi-domain engineering contracts, descriptors,
 * registries, and boundary validation utilities.
 */

// 1. Types & contrats de domaine et capacités
export * from "./types/engineeringDomainTypes";
export * from "./types/engineeringEntityTypes";
export * from "./types/pipelineEngineeringModelTypes";

// 2. Descripteurs de domaines
export * from "./domains/pipingDomain";
export * from "./domains/pipelineDomain";
export * from "./domains/packageDomain";
export * from "./domains/equipmentDomain";

// 3. Registre de domaines
export * from "./registry/engineeringDomainRegistry";

// 4. Contexte & Validateurs de frontières
export * from "./context/engineeringContext";

// 5. Modèle métier Pipeline & Validateur (ARCH-10)
export * from "./model/pipelineEngineeringModel";
export * from "./validators/pipelineEngineeringModelValidator";
