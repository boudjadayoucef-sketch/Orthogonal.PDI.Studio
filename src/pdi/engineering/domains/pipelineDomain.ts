/**
 * PDI ENGINEERING PLATFORM — PIPELINE DOMAIN (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Domain Descriptor for cross-country and regional transmission & distribution pipelines.
 * Covers gas, liquid hydrocarbons, multiphase, slurry and hydrogen transmission.
 * Strictly client-neutral and free of hardcoded normative logic or prices.
 */

import type {
  EngineeringDomainDescriptor,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import type { UniversalEntityCategory } from "../../model/pdiUniversalEntity";

export const PIPELINE_DOMAIN_DESCRIPTOR: EngineeringDomainDescriptor = Object.freeze({
  id: "PIPELINE",
  label: "Pipeline Engineering (Transmission & Distribution)",
  description:
    "Cross-country, onshore, offshore, and regional pipeline transmission and distribution networks for natural gas, liquid hydrocarbons, multiphase fluids, water, and hydrogen.",
  capabilities: Object.freeze<EngineeringCapabilityId[]>([
    "2D",
    "3D",
    "ALIGNMENT",
    "STATIONS",
    "COMPONENT_SELECTION",
    "NORMATIVE_VALIDATION",
    "CALCULATION",
    "BOM",
    "MTO",
    "WELD",
    "DELIVERABLES",
  ]),
  allowedEntityCategories: Object.freeze<UniversalEntityCategory[]>([
    "pipe",
    "valve",
    "fitting",
    "flange",
    "node",
    "support",
    "cad2d",
    "dimension",
    "equipment",
  ]),
  defaultNormativeDesignCodeRefs: Object.freeze([
    "ASME-B31.4",
    "ASME-B31.8",
    "ASME-B31.12",
    "ISO-13623",
  ]),
});
