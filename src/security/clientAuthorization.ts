/**
 * ORTHOGONAL PD&I STUDIO — SÉCURITÉ CLIENT AUTHENTICATION & AUTORISATION
 * SEC-01-FIX-03 — Helper pur d'autorisation Super Admin côté client.
 * 
 * RÈGLE D'AUTORITÉ UNIQUE :
 * La seule et unique source d'autorité Super Admin est :
 * Firebase Authentication + ID Token vérifié + Custom Claim role === "super_admin" + email_verified === true.
 * 
 * SOURCES EXPLICITEMENT REJETÉES ET NON FIABLES :
 * - Adresse email (même whitelistée ou contenant 'boudjada').
 * - profile.role (donnée Firestore non sécurisée, falsifiable côté client).
 * - localStorage / sessionStorage.
 * - Paramètres URL / hash / state du navigateur.
 * - Profil utilisateur mis en cache.
 */

export interface TokenClaims {
  role?: unknown;
  email_verified?: unknown;
  [key: string]: unknown;
}

export interface FirebaseUserLike {
  emailVerified?: boolean;
  email?: string | null;
  getIdTokenResult?: (forceRefresh?: boolean) => Promise<{ claims: Record<string, unknown> }>;
}

export const SUPER_ADMIN_RESTRICTED_VIEWS = new Set<string>([
  'super_admin_console',
  'license_keys'
]);

/**
 * Détermine si des Custom Claims de token confèrent le statut Super Admin.
 * 
 * Exigences strictes :
 * 1. claims doit être un objet non nul.
 * 2. claims.role doit être strictement égal à "super_admin".
 * 3. L'email doit être vérifié :
 *    - soit claims.email_verified === true
 *    - soit userEmailVerified === true (propriété emailVerified du User Firebase Auth)
 * 4. Aucun fallback par email, ni par profile.role, ni par localStorage.
 */
export function isSuperAdminClaimAuthorized(
  claims: TokenClaims | null | undefined,
  userEmailVerified?: boolean
): boolean {
  if (!claims || typeof claims !== 'object') {
    return false;
  }

  // Vérification stricte du rôle dans les Custom Claims
  if (claims.role !== 'super_admin') {
    return false;
  }

  // Vérification stricte que l'email est vérifié sans contradiction ni falsification
  // Si claims.email_verified est présent, il doit valoir strictement boolean true.
  if ('email_verified' in claims && claims.email_verified !== true) {
    return false;
  }

  // L'email doit être vérifié soit au niveau du claim, soit au niveau de l'utilisateur Firebase Auth
  const isVerified = (claims.email_verified === true) || (userEmailVerified === true);
  if (!isVerified) {
    return false;
  }

  return true;
}

/**
 * Évalue l'autorité Super Admin directement depuis un IDTokenResult Firebase.
 */
export function isSuperAdminFromTokenResult(
  tokenResult: { claims?: Record<string, unknown> } | null | undefined,
  userEmailVerified?: boolean
): boolean {
  if (!tokenResult?.claims) {
    return false;
  }
  return isSuperAdminClaimAuthorized(tokenResult.claims, userEmailVerified);
}

/**
 * Helper sécurisé asynchrone qui interroge l'ID Token frais d'un utilisateur Firebase Auth.
 */
export async function verifySuperAdminFromFirebaseUser(
  user: FirebaseUserLike | null | undefined,
  forceRefresh = false
): Promise<boolean> {
  if (!user || typeof user.getIdTokenResult !== 'function') {
    return false;
  }

  try {
    const tokenResult = await user.getIdTokenResult(forceRefresh);
    return isSuperAdminClaimAuthorized(tokenResult.claims, user.emailVerified);
  } catch {
    return false;
  }
}

/**
 * Vérifie si un nom de vue ou de module requiert les privilèges Super Admin.
 */
export function isRestrictedAdminView(viewName: string | null | undefined): boolean {
  if (!viewName || typeof viewName !== 'string') return false;
  return SUPER_ADMIN_RESTRICTED_VIEWS.has(viewName);
}

/**
 * Détermine la vue autorisée en fonction des privilèges Super Admin réels.
 * Si une vue administrative est demandée sans autorité vérifiée, redirige vers la vue de repli non privilégiée.
 */
export function getAuthorizedView(
  requestedView: string | null | undefined,
  isSuperAdmin: boolean,
  fallbackView = 'isometric'
): string {
  if (!requestedView) return fallbackView;
  if (isRestrictedAdminView(requestedView) && !isSuperAdmin) {
    return fallbackView;
  }
  return requestedView;
}
