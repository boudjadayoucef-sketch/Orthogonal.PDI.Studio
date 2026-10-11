/**
 * PDI ENGINEERING PLATFORM — PIPING DOMAIN (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Domain Descriptor for in-plant process and utility piping.
 * Covers piping within battery limits (refineries, chemical plants, utilities, skids).
 * Strictly client-neutral and free of hardcoded normative logic or prices.
 */

import type {
  EngineeringDomainDescriptor,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import type { UniversalEntityCategory } from "../../model/pdiUniversalEntity";

export const PIPING_DOMAIN_DESCRIPTOR: EngineeringDomainDescriptor = Object.freeze({
  id: "PIPING",
  label: "Piping Engineering (Process & Plant Facilities)",
  description:
    "Process, utility and auxiliary industrial piping systems within battery limits, refineries, chemical facilities, power plants and industrial installations.",
  capabilities: Object.freeze<EngineeringCapabilityId[]>([
    "2D",
    "3D",
    "ISOMETRIC",
    "COMPONENT_SELECTION",
    "NORMATIVE_VALIDATION",
    "CALCULATION",
    "BOM",
    "MTO",
    "WELD",
    "SPOOL",
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
    "ASME-B31.3",
    "EN-13480",
    "ASME-B31.1",
  ]),
});
