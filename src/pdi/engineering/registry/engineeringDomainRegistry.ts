/**
 * PDI ENGINEERING PLATFORM — DOMAIN REGISTRY (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Lightweight, in-memory domain registry for resolving engineering domains,
 * querying supported capabilities, and ensuring client and normative neutrality.
 *
 * INVARIANTS (ARCH-08 §15):
 * - Pas de logique normative.
 * - Pas de calculs ni formules.
 * - Pas de persistance lourde ou UI.
 * - Pas de données commerciales ou de prix.
 */

import type {
  EngineeringDomainDescriptor,
  EngineeringDomainId,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import { PIPING_DOMAIN_DESCRIPTOR } from "../domains/pipingDomain";
import { PIPELINE_DOMAIN_DESCRIPTOR } from "../domains/pipelineDomain";
import { PACKAGE_DOMAIN_DESCRIPTOR } from "../domains/packageDomain";
import { EQUIPMENT_DOMAIN_DESCRIPTOR } from "../domains/equipmentDomain";

export class EngineeringDomainRegistry {
  private readonly domains: Map<EngineeringDomainId, EngineeringDomainDescriptor> = new Map();

  constructor(initialDescriptors?: readonly EngineeringDomainDescriptor[]) {
    if (initialDescriptors) {
      for (const descriptor of initialDescriptors) {
        this.registerDomain(descriptor);
      }
    }
  }

  /**
   * Enregistre ou met à jour un descripteur de domaine technique.
   */
  public registerDomain(descriptor: EngineeringDomainDescriptor): void {
    if (!descriptor || !descriptor.id) {
      throw new Error("[ARCH-08 DomainRegistry] Descripteur de domaine invalide (id requis).");
    }
    this.domains.set(descriptor.id, Object.freeze({ ...descriptor }));
  }

  /**
   * Récupère le descripteur d'un domaine par son identifiant.
   */
  public getDomain(domainId: EngineeringDomainId): EngineeringDomainDescriptor | undefined {
    return this.domains.get(domainId);
  }

  /**
   * Vérifie si un domaine est enregistré.
   */
  public hasDomain(domainId: EngineeringDomainId): boolean {
    return this.domains.has(domainId);
  }

  /**
   * Retourne la liste de tous les domaines enregistrés.
   */
  public getAllDomains(): readonly EngineeringDomainDescriptor[] {
    return Array.from(this.domains.values());
  }

  /**
   * Vérifie si une capacité d'ingénierie est supportée par un domaine.
   */
  public isCapabilitySupported(
    domainId: EngineeringDomainId,
    capability: EngineeringCapabilityId
  ): boolean {
    const domain = this.domains.get(domainId);
    if (!domain) return false;
    return domain.capabilities.includes(capability);
  }

  /**
   * Retourne la liste des capacités supportées pour un domaine donné.
   */
  public getSupportedCapabilities(
    domainId: EngineeringDomainId
  ): readonly EngineeringCapabilityId[] {
    const domain = this.domains.get(domainId);
    return domain ? domain.capabilities : Object.freeze([]);
  }

  /**
   * Vérifie qu'un domaine respecte les règles d'intégrité de l'architecture ARCH-08.
   */
  public validateDomainIntegrity(domainId: EngineeringDomainId): {
    readonly valid: boolean;
    readonly errors: readonly string[];
  } {
    const errors: string[] = [];
    const domain = this.domains.get(domainId);
    if (!domain) {
      return { valid: false, errors: [`Domaine ${domainId} non enregistré`] };
    }

    if (!domain.label || domain.label.trim().length === 0) {
      errors.push(`Le domaine ${domainId} doit posséder un label international non vide`);
    }

    if (!domain.capabilities || domain.capabilities.length === 0) {
      errors.push(`Le domaine ${domainId} doit déclarer au moins une capacité supportée`);
    }

    if (!domain.allowedEntityCategories || domain.allowedEntityCategories.length === 0) {
      errors.push(`Le domaine ${domainId} doit déclarer au moins une catégorie d'entités autorisée`);
    }

    return {
      valid: errors.length === 0,
      errors: Object.freeze(errors),
    };
  }
}

/**
 * Crée un registre configuré avec les 4 domaines d'ingénierie canoniques.
 */
export function createDefaultEngineeringDomainRegistry(): EngineeringDomainRegistry {
  return new EngineeringDomainRegistry([
    PIPING_DOMAIN_DESCRIPTOR,
    PIPELINE_DOMAIN_DESCRIPTOR,
    PACKAGE_DOMAIN_DESCRIPTOR,
    EQUIPMENT_DOMAIN_DESCRIPTOR,
  ]);
}

/**
 * Singleton mondial du registre des domaines d'ingénierie PD&I.
 */
export const defaultEngineeringDomainRegistry: EngineeringDomainRegistry =
  createDefaultEngineeringDomainRegistry();
