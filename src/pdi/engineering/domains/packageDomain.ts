/**
 * PDI ENGINEERING PLATFORM — PACKAGE / SKID DOMAIN (ARCH-08)
 * Reference: ARCH-08 (Multi-Domain Engineering Architecture)
 *
 * Domain Descriptor for modular process skids, packaged equipment,
 * structural base frames, volume envelopes, and battery limit tie-in connections.
 * Strictly client-neutral and free of hardcoded normative logic or prices.
 */

import type {
  EngineeringDomainDescriptor,
  EngineeringCapabilityId,
} from "../types/engineeringDomainTypes";
import type { UniversalEntityCategory } from "../../model/pdiUniversalEntity";

export const PACKAGE_DOMAIN_DESCRIPTOR: EngineeringDomainDescriptor = Object.freeze({
  id: "PACKAGE",
  label: "Package & Skid Modular Engineering",
  description:
    "Pre-assembled modular process skids, pump/compressor skids, metering units, chemical injection skids, and boundary tie-in connections.",
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
  ]),
});
