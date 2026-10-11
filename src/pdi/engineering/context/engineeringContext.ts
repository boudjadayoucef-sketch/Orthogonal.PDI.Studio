/**
 * PDI ENGINEERING PLATFORM — DOMAIN CONTEXT & BOUNDARY VALIDATORS (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Implements:
 * 1. Project Domain Context factory and capability resolution.
 * 2. Strict Boundary Isolation:
 *    - Domain !== Normative Qualification (Domain only points to code references).
 *    - Domain !== PdiOrganizationProfile (No client identities in domains).
 *    - Domain !== Commercial Costing (No prices, rates or currencies).
 * 3. Anti-Pattern Detection (ARCH-08 §22):
 *    - Rejection of duplicate universal models (PipelineUniversalEntity, etc.).
 */

import type {
  EngineeringDomainId,
  EngineeringDomainContext,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import {
  defaultEngineeringDomainRegistry,
  EngineeringDomainRegistry,
} from "../registry/engineeringDomainRegistry";
import { FORBIDDEN_HISTORICAL_CLIENT_PATTERNS } from "../../model/pdiIndustrialArchitectureAdapter";

/**
 * Noms de classes ou types concurrents interdits (ARCH-08 §22).
 * Le modèle universel PdiUniversalEntity doit rester l'unique référence canonique.
 */
export const FORBIDDEN_DUPLICATE_UNIVERSAL_ENTITY_NAMES: readonly string[] = Object.freeze([
  "PipelineUniversalEntity",
  "PipingUniversalEntity",
  "PackageUniversalEntity",
  "EquipmentUniversalEntity",
  "PipelineUniversalModel",
  "PipingUniversalModel",
  "PackageUniversalModel",
  "EquipmentUniversalModel",
  "UniversalPipelineEntity",
  "UniversalPipingEntity",
  "UniversalPackageEntity",
  "UniversalEquipmentEntity",
]);

/**
 * Crée un contexte de domaine d'ingénierie actif.
 */
export function createEngineeringDomainContext(
  domainId: EngineeringDomainId,
  projectId?: string,
  registry: EngineeringDomainRegistry = defaultEngineeringDomainRegistry
): EngineeringDomainContext {
  const descriptor = registry.getDomain(domainId);
  if (!descriptor) {
    throw new Error(
      `[ARCH-08 Context] Domaine d'ingénierie inconnu: "${domainId}". Enregistrement préalable requis.`
    );
  }

  return Object.freeze({
    domainId,
    activeCapabilities: descriptor.capabilities,
    projectId,
    activeStandardCodeRef: descriptor.defaultNormativeDesignCodeRefs[0],
  });
}

/**
 * Résout les références de codes de conception applicables à un domaine.
 * ATTENTION (ARCH-08 §11): Ne résout QUE des identifiants de références,
 * n'exécute aucune logique ou formule normative.
 */
export function resolveApplicableDesignCodesForDomain(
  domainId: EngineeringDomainId,
  registry: EngineeringDomainRegistry = defaultEngineeringDomainRegistry
): readonly string[] {
  const domain = registry.getDomain(domainId);
  if (!domain) return Object.freeze([]);
  return domain.defaultNormativeDesignCodeRefs;
}

/**
 * Vérifie si un nom de type ou de classe constitue une duplication interdite du modèle universel.
 */
export function detectDuplicateUniversalModelAntiPattern(typeName: string): boolean {
  if (!typeName) return false;
  const normalized = typeName.trim();
  return FORBIDDEN_DUPLICATE_UNIVERSAL_ENTITY_NAMES.some(
    (forbidden) => forbidden.toLowerCase() === normalized.toLowerCase()
  );
}

/**
 * Résultat de la validation de frontière d'un domaine technique.
 */
export interface DomainBoundaryValidationResult {
  readonly valid: boolean;
  readonly violations: readonly string[];
}

/**
 * Mots-clés commerciaux interdits dans les définitions de domaines techniques.
 */
const FORBIDDEN_COMMERCIAL_KEYWORDS = [
  "unitRate",
  "unit_rate",
  "price",
  "prix",
  "currency",
  "devise",
  "montant",
  "costEstimation",
  "cout",
  "tarif",
  "totalHt",
  "totalTtc",
];

/**
 * Valide les frontières d'isolation d'un domaine ou d'une charge de données de domaine.
 */
export function validateDomainBoundary(
  domainId: EngineeringDomainId,
  payload?: unknown
): DomainBoundaryValidationResult {
  const violations: string[] = [];

  // 1. Vérification de l'existence du domaine
  if (!["PIPING", "PIPELINE", "PACKAGE", "EQUIPMENT"].includes(domainId)) {
    violations.push(`Domaine d'ingénierie non reconnu: ${domainId}`);
  }

  if (payload && typeof payload === "object") {
    const jsonString = JSON.stringify(payload);

    // 2. Vérification d'absence de client historique (ARCH-07/08)
    for (const pattern of FORBIDDEN_HISTORICAL_CLIENT_PATTERNS) {
      if (pattern.test(jsonString)) {
        violations.push(
          `Violation de neutralité client: présence du pattern interdit ${pattern} dans les données du domaine ${domainId}`
        );
      }
    }

    // 3. Vérification d'absence de données commerciales/prix (ARCH-07/08)
    for (const kw of FORBIDDEN_COMMERCIAL_KEYWORDS) {
      if (new RegExp(`"${kw}"\\s*:`, "i").test(jsonString)) {
        violations.push(
          `Violation de frontière commerciale: le domaine technique ${domainId} ne peut pas contenir de données de prix ou chiffrage ("${kw}")`
        );
      }
    }

    // 4. Vérification d'absence de duplication de modèle universel
    for (const duplicateType of FORBIDDEN_DUPLICATE_UNIVERSAL_ENTITY_NAMES) {
      if (jsonString.includes(duplicateType)) {
        violations.push(
          `Violation anti-duplication: type universel concurrent détecté ("${duplicateType}")`
        );
      }
    }
  }

  return {
    valid: violations.length === 0,
    violations: Object.freeze(violations),
  };
}
