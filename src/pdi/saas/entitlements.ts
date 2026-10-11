import type { LicensePlan, PdiEntitlements } from './types';

export const DEFAULT_ENTITLEMENTS: Record<LicensePlan, PdiEntitlements> = {
  trial: {
    isometric: true,
    dxfImport: true,
    dxfExport: true,
    aiAssistant: true,
    photoReconstruction: false,
    multiUser: false,
  },
  professional: {
    isometric: true,
    dxfImport: true,
    dxfExport: true,
    aiAssistant: true,
    photoReconstruction: true,
    multiUser: false,
  },
  team: {
    isometric: true,
    dxfImport: true,
    dxfExport: true,
    aiAssistant: true,
    photoReconstruction: true,
    multiUser: true,
  },
  enterprise: {
    isometric: true,
    dxfImport: true,
    dxfExport: true,
    aiAssistant: true,
    photoReconstruction: true,
    multiUser: true,
  },
};

/**
 * Presentation defaults only. The backend must remain authoritative for
 * licensing and authorization decisions.
 */
export function getDefaultEntitlements(plan: LicensePlan): PdiEntitlements {
  return { ...DEFAULT_ENTITLEMENTS[plan] };
}
