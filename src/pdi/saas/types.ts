export type UserRole = 'owner' | 'admin' | 'engineer' | 'designer' | 'viewer';

export type LicensePlan = 'trial' | 'professional' | 'team' | 'enterprise';

export interface PdiUser {
  id: string;
  email: string;
  displayName: string;
  organizationId: string;
  role: UserRole;
}

export interface PdiOrganization {
  id: string;
  name: string;
  country?: string;
  createdAt: string;
}

export interface PdiLicense {
  id: string;
  organizationId: string;
  plan: LicensePlan;
  status: 'trialing' | 'active' | 'expired' | 'suspended';
  seats: number;
  expiresAt?: string;
  activationKeyId?: string;
}

export interface PdiEntitlements {
  isometric: boolean;
  dxfImport: boolean;
  dxfExport: boolean;
  aiAssistant: boolean;
  photoReconstruction: boolean;
  multiUser: boolean;
}

export interface PdiProject {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
