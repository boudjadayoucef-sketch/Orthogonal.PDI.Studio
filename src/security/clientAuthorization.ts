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
 * Exigences strictes SEC-01-FIX-03-R1 :
 * 1. claims doit être un objet valide non nul.
 * 2. claims.role === "super_admin".
 * 3. claims.email_verified === true obligatoirement (strict boolean).
 * 4. L'absence du claim email_verified entraîne obligatoirement un refus.
 * 5. userEmailVerified ne doit JAMAIS compenser l'absence ou la fausseté du claim.
 * 6. Si userEmailVerified est fourni, il peut agir comme contrôle de cohérence
 *    complémentaire (si userEmailVerified === false, refus), mais JAMAIS comme substitut.
 * 7. Aucun fallback par email, ni par profile.role, ni par localStorage.
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

  // Règle A3 : Le claim email_verified doit être STRICTEMENT boolean true
  // L'absence du claim, ou toute valeur autre que true (false, string, undefined, etc.) est refusée
  if (claims.email_verified !== true) {
    return false;
  }

  // Contrôle complémentaire éventuel : si userEmailVerified est explicitement false, refuser
  if (userEmailVerified === false) {
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

/**
 * Helper pur testable pour la résolution d'état d'authentification lors de changements de token.
 * Résout le rôle ('super_admin' ou rétrogradation 'client'/'guest') en fonction du token et des conditions de session.
 */
export function resolveNextAuthMode(
  currentAuthMode: string,
  user: { uid: string; emailVerified?: boolean } | null | undefined,
  tokenClaims: TokenClaims | null | undefined,
  sessionContext: {
    isSubscribed: boolean;
    callbackSeq: number;
    currentSeq: number;
    activeUid: string | null | undefined;
  }
): string {
  // Callback obsolète, désabonné ou session changée : aucun changement d'état autorisé
  if (!sessionContext.isSubscribed || sessionContext.callbackSeq !== sessionContext.currentSeq) {
    return currentAuthMode;
  }
  if (!user || user.uid !== sessionContext.activeUid) {
    return currentAuthMode === 'super_admin' || currentAuthMode === 'admin' ? 'guest' : currentAuthMode;
  }

  const isSuper = isSuperAdminClaimAuthorized(tokenClaims, user.emailVerified);
  if (isSuper) {
    return 'super_admin';
  }

  // Token client ou droits révoqués -> rétrogradation immédiate
  return currentAuthMode === 'super_admin' ? 'client' : currentAuthMode;
}
