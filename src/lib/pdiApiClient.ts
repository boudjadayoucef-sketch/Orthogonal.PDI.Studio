/**
 * ORTHOGONAL - ENG · PIPING DESIGN & ISOMETRICS (PD&I)
 * UNIFIED AUTHORIZED CLIENT API HELPER
 * Ensures all requests to /api/* carry valid Firebase Auth ID tokens
 */

import { auth } from './firebase.ts';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Retrieves the current user's Firebase ID token.
 * Forces token refresh if requested or expired.
 */
export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  try {
    return await currentUser.getIdToken(forceRefresh);
  } catch (err) {
    console.error('Failed to retrieve Firebase ID token:', err);
    return null;
  }
}

/**
 * Standard fetch wrapper that automatically appends Bearer Authorization token
 * and handles automatic token refresh on 401 (token expired).
 */
export async function pdiApiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(endpoint, {
    ...options,
    headers,
  });

  // If unauthorized due to token expiration, retry once with forceRefresh
  if (res.status === 401 && token) {
    const refreshedToken = await getAuthToken(true);
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      res = await fetch(endpoint, {
        ...options,
        headers,
      });
    }
  }

  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: res.statusText };
    }
    throw new ApiError(
      errorData.error || `Erreur serveur (${res.status})`,
      res.status,
      errorData.code
    );
  }

  return res.json();
}

/**
 * Projects API endpoints
 */
export const projectsApi = {
  syncUser: async (displayName?: string, photoUrl?: string) => {
    return pdiApiFetch('/api/auth/sync-user', {
      method: 'POST',
      body: JSON.stringify({ displayName, photoUrl }),
    });
  },

  getProjects: async () => {
    const res = await pdiApiFetch<{ projects: any[] }>('/api/projects');
    return res.projects || [];
  },

  saveProject: async (projectData: any) => {
    const res = await pdiApiFetch<{ project: any }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
    return res.project;
  },

  deleteProject: async (projectId: number) => {
    return pdiApiFetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  },

  setUserRole: async (targetUid: string, role: string) => {
    return pdiApiFetch<{ success: boolean; targetUid: string; role: string }>('/api/admin/set-user-role', {
      method: 'POST',
      body: JSON.stringify({ targetUid, role }),
    });
  },
};
