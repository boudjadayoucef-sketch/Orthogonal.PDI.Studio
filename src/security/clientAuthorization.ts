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
  // Callback après démontage : aucun changement d'état
  if (!sessionContext.isSubscribed) {
    return currentAuthMode;
  }

  // B3 : Incohérence entre l'utilisateur actif (activeUid) et l'utilisateur du callback :
  // Ne jamais laisser subsister une autorisation privilégiée.
  if (!sessionContext.activeUid) {
    return currentAuthMode === 'super_admin' || currentAuthMode === 'admin' ? 'guest' : currentAuthMode;
  }
  if (!user || user.uid !== sessionContext.activeUid) {
    if (sessionContext.callbackSeq === sessionContext.currentSeq) {
      return currentAuthMode === 'super_admin' || currentAuthMode === 'admin' ? 'client' : currentAuthMode;
    }
    return currentAuthMode;
  }

  // Callback obsolète supplanté par une séquence plus récente : ignorer
  if (sessionContext.callbackSeq !== sessionContext.currentSeq) {
    return currentAuthMode;
  }

  const isSuper = isSuperAdminClaimAuthorized(tokenClaims, user.emailVerified);
  if (isSuper) {
    return 'super_admin';
  }

  // Token client ou droits révoqués -> rétrogradation immédiate
  return currentAuthMode === 'super_admin' || currentAuthMode === 'admin' ? 'client' : currentAuthMode;
}

export interface TokenMonitorUser extends FirebaseUserLike {
  uid: string;
}

export interface SuperAdminTokenMonitorOptions {
  auth: { readonly currentUser: { readonly uid: string } | null };
  subscribeIdTokenChanged: (
    callback: (user: TokenMonitorUser | null) => void | Promise<void>
  ) => () => void;
  setAuthMode: (updater: (prev: string) => string) => void;
  onAdminRevoked?: () => void;
}

function demotePrivilegedToClient(prev: string): string {
  return prev === 'super_admin' || prev === 'admin' ? 'client' : prev;
}

function demotePrivilegedToGuest(prev: string): string {
  return prev === 'super_admin' || prev === 'admin' ? 'guest' : prev;
}

/**
 * SEC-01-FIX-03-R2 (B1 / B2 / B3) :
 * Gestionnaire de production du listener Firebase `onIdTokenChanged` assurant :
 * - B1 : Fail-closed immédiat (synchrone) dès la détection d'un changement de compte
 *        ou d'une session non encore validée, avant toute attente de `getIdTokenResult()`.
 * - A1 : Rafraîchissement forcé (`getIdTokenResult(true)`) au démarrage de chaque nouvelle session UID,
 *        puis `getIdTokenResult(false)` lors des rafraîchissements suivants du même UID pour éviter toute boucle.
 * - A2 : Protection contre les courses asynchrones via numéro de séquence et drapeau de montage (`isSubscribed`).
 * - B3 : Révocation immédiate des privilèges en cas d'incohérence entre `auth.currentUser.uid` et `fbUser.uid`.
 */
export function attachSuperAdminTokenMonitor(
  options: SuperAdminTokenMonitorOptions
): () => void {
  const { auth, subscribeIdTokenChanged, setAuthMode, onAdminRevoked } = options;
  let isSubscribed = true;
  let currentAuthSequence = 0;
  let lastSessionUid: string | null = null;
  let activeVerifiedSuperUid: string | null = null;

  const revokeToClient = () => {
    activeVerifiedSuperUid = null;
    setAuthMode(demotePrivilegedToClient);
    onAdminRevoked?.();
  };

  const revokeToGuest = () => {
    lastSessionUid = null;
    activeVerifiedSuperUid = null;
    setAuthMode(demotePrivilegedToGuest);
    onAdminRevoked?.();
  };

  const unsubscribe = subscribeIdTokenChanged(async (fbUser) => {
    currentAuthSequence += 1;
    const callbackSeq = currentAuthSequence;

    if (!isSubscribed) {
      return;
    }

    // Déconnexion explicite : suppression immédiate de tout état Super Admin / Admin
    if (!fbUser || typeof fbUser.uid !== 'string' || fbUser.uid.length === 0) {
      revokeToGuest();
      return;
    }

    const targetUid = fbUser.uid;

    // B3 : Vérification immédiate de cohérence entre auth.currentUser.uid et le compte traité
    const currentActiveUser = auth.currentUser;
    if (!currentActiveUser || typeof currentActiveUser.uid !== 'string' || currentActiveUser.uid.length === 0) {
      revokeToGuest();
      return;
    }
    if (currentActiveUser.uid !== targetUid) {
      lastSessionUid = currentActiveUser.uid;
      revokeToClient();
      return;
    }

    // B1 : Fail-closed immédiat au changement de compte ou tant que le compte courant
    // n'est pas déjà le Super Admin vérifié actif. Aucun privilège du compte précédent
    // ne peut subsister pendant l'attente asynchrone du token du nouveau compte.
    const isNewAccountSession = lastSessionUid !== targetUid;
    if (isNewAccountSession || activeVerifiedSuperUid !== targetUid) {
      revokeToClient();
    }
    lastSessionUid = targetUid;

    if (typeof fbUser.getIdTokenResult !== 'function') {
      revokeToClient();
      return;
    }

    try {
      // A1 : Actualisation forcée au démarrage de la session pour ce compte, sans boucle infinie
      const shouldForceRefresh = isNewAccountSession;
      const tokenResult = await fbUser.getIdTokenResult(shouldForceRefresh);

      // A2 : Après démontage du composant, aucun callback ne peut modifier l'état
      if (!isSubscribed) {
        return;
      }

      // B3 : Après l'attente asynchrone, vérifier que auth.currentUser existe et correspond toujours à targetUid
      const postAwaitCurrentUser = auth.currentUser;
      if (!postAwaitCurrentUser || typeof postAwaitCurrentUser.uid !== 'string' || postAwaitCurrentUser.uid.length === 0) {
        revokeToGuest();
        return;
      }
      if (postAwaitCurrentUser.uid !== targetUid) {
        // Incohérence entre UID actif et UID du callback : ne jamais laisser subsister une autorisation privilégiée
        if (activeVerifiedSuperUid === targetUid || callbackSeq === currentAuthSequence) {
          revokeToClient();
        }
        return;
      }

      // A2 : Ignorer tout callback obsolète supplanté par une séquence plus récente
      if (callbackSeq !== currentAuthSequence) {
        return;
      }

      const isSuper = isSuperAdminClaimAuthorized(tokenResult?.claims, fbUser.emailVerified);
      if (isSuper) {
        activeVerifiedSuperUid = targetUid;
        setAuthMode(() => 'super_admin');
      } else {
        revokeToClient();
      }
    } catch {
      if (!isSubscribed) {
        return;
      }
      const postErrorCurrentUser = auth.currentUser;
      if (!postErrorCurrentUser || typeof postErrorCurrentUser.uid !== 'string' || postErrorCurrentUser.uid.length === 0) {
        revokeToGuest();
        return;
      }
      if (
        callbackSeq === currentAuthSequence ||
        postErrorCurrentUser.uid === targetUid ||
        activeVerifiedSuperUid === targetUid
      ) {
        revokeToClient();
      }
    }
  });

  return () => {
    isSubscribed = false;
    currentAuthSequence += 1;
    lastSessionUid = null;
    activeVerifiedSuperUid = null;
    unsubscribe();
  };
}

