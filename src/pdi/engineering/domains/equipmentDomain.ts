/**
 * PDI ENGINEERING PLATFORM — EQUIPMENT DOMAIN (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Domain Descriptor for static & rotating mechanical equipment, pressure vessels,
 * atmospheric storage tanks, heat exchangers, and nozzle connection orientations.
 * Strictly client-neutral and free of hardcoded normative logic or prices.
 */

import type {
  EngineeringDomainDescriptor,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import type { UniversalEntityCategory } from "../../model/pdiUniversalEntity";

export const EQUIPMENT_DOMAIN_DESCRIPTOR: EngineeringDomainDescriptor = Object.freeze({
  id: "EQUIPMENT",
  label: "Equipment & Pressure Vessels Engineering",
  description:
    "Static and rotating equipment, pressure vessels, atmospheric tanks, heat exchangers, pumps, compressors, and process nozzle orientation coordinates.",
  capabilities: Object.freeze<EngineeringCapabilityId[]>([
    "2D",
    "3D",
    "COMPONENT_SELECTION",
    "CALCULATION",
    "BOM",
    "MTO",
    "DELIVERABLES",
  ]),
  allowedEntityCategories: Object.freeze<UniversalEntityCategory[]>([
    "equipment",
    "node",
    "flange",
    "cad2d",
    "dimension",
  ]),
  defaultNormativeDesignCodeRefs: Object.freeze([
    "ASME-B31.3",
    "EN-13480",
  ]),
});
