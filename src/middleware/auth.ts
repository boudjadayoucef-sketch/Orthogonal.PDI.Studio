import type { Request, Response, NextFunction } from 'express';
import { getServerAdminAuth } from '../lib/firebase-admin.js';
import type { DecodedIdToken } from 'firebase-admin/auth';
import {
  isStagingSandboxMode,
  isSyntheticSandboxToken,
  isSyntheticSandboxUid,
} from '../lib/stagingSandbox.js';
import {
  isLikelySupabaseAccessToken,
  type SupabaseSessionVerificationResult,
  type SupabaseVerifiedSession,
} from '../server/supabaseAuth.js';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  supabaseSession?: SupabaseVerifiedSession;
}

/**
 * Protection C2 (STAGING-00-B3 / STAGING-00-B3-R1 / STAGING-00-B4-D):
 * 1. Immediately rejects any synthetic Sandbox identity header or Bearer token with HTTP 401
 *    (`auth/synthetic-identity-forbidden`) before any Firebase or PostgreSQL access.
 * 2. Refuses administrative, payment, webhook, and server database routes with HTTP 403
 *    (`sandbox/server-mutation-forbidden`) when Sandbox mode is active.
 */
export function createRejectInStagingSandboxMode(
  env?: Record<string, unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const effectiveEnv = env ?? process.env;
    const headers = req?.headers ?? {};
    if (headers['x-pdi-sandbox-identity']) {
      return res.status(401).json({
        error: 'Unauthorized: Synthetic Sandbox identity is strictly forbidden on server',
        code: 'auth/synthetic-identity-forbidden',
      });
    }

    const authHeader = typeof headers.authorization === 'string' ? headers.authorization : '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1]?.trim();
      if (token && isSyntheticSandboxToken(token)) {
        return res.status(401).json({
          error: 'Unauthorized: Synthetic Sandbox identity is strictly forbidden on server',
          code: 'auth/synthetic-identity-forbidden',
        });
      }
    }

    if (isStagingSandboxMode(effectiveEnv)) {
      return res.status(403).json({
        error:
          'Forbidden: Server-side administrative, payment, webhook, and database persistence routes are disabled in Sandbox mode.',
        code: 'sandbox/server-mutation-forbidden',
      });
    }
    next();
  };
}

export const rejectInStagingSandboxMode = createRejectInStagingSandboxMode();

export interface CreateRequireAuthOptions {
  getAdminAuth?: typeof getServerAdminAuth;
  verifySupabaseToken?: (token: string) => Promise<SupabaseSessionVerificationResult | null>;
  expectedSupabaseUrl?: string;
  /**
   * MIG-05-FIX-01 :
   * Lorsque `false`, rejette strictement tout jeton qui n'est pas un JWT Supabase vérifié
   * sans jamais appeler `getServerAdminAuth().verifyIdToken()` (utilisé par `/api/auth/sync-user`
   * et `/api/projects`). Conservé à `true` par défaut pour la route héritée `/api/admin/set-user-role`.
   */
  allowFirebaseFallback?: boolean;
}

export function createRequireAuth(
  env?: Record<string, unknown>,
  options: CreateRequireAuthOptions = {}
) {
  const resolveAdminAuth = options.getAdminAuth ?? getServerAdminAuth;
  const allowFirebaseFallback = options.allowFirebaseFallback !== false;

  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const effectiveEnv = env ?? process.env;
    if (req.headers['x-pdi-sandbox-identity']) {
      return res.status(401).json({
        error: 'Unauthorized: Synthetic Sandbox identity is strictly forbidden on server',
        code: 'auth/synthetic-identity-forbidden',
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized: Missing or invalid authorization header',
        code: 'auth/missing-token'
      });
    }

    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      return res.status(401).json({ 
        error: 'Unauthorized: Empty bearer token',
        code: 'auth/empty-token'
      });
    }

    // Protection C2 (STAGING-00-B3): Never accept a synthetic local Sandbox token on the server
    if (isSyntheticSandboxToken(token)) {
      return res.status(401).json({
        error: 'Unauthorized: Synthetic Sandbox identity is strictly forbidden on server',
        code: 'auth/synthetic-identity-forbidden',
      });
    }

    // STAGING-00-B3-R1 (Partie B): In Sandbox mode, server authentication is disabled
    if (isStagingSandboxMode(effectiveEnv)) {
      return res.status(403).json({
        error: 'Forbidden: Server authentication is disabled in Sandbox mode.',
        code: 'sandbox/server-auth-disabled',
      });
    }

    // MIG-04-AUTH-01 & MIG-05-FIX-01 : Vérification autoritative des JWT Supabase
    const isSupabaseCandidate = isLikelySupabaseAccessToken(token, options.expectedSupabaseUrl);
    if (options.verifySupabaseToken && isSupabaseCandidate) {
      const supabaseResult = await options.verifySupabaseToken(token);
      if (!supabaseResult) {
        return res.status(503).json({
          error: 'Service Unavailable: Supabase server authentication is not configured.',
          code: 'server/supabase-auth-unconfigured',
        });
      }
      if ('code' in supabaseResult) {
        return res.status(supabaseResult.httpStatus).json({
          error: supabaseResult.error,
          code: supabaseResult.code,
          ...(supabaseResult.profileStatus ? { profileStatus: supabaseResult.profileStatus } : {}),
        });
      }

      const session = supabaseResult.session;
      req.supabaseSession = session;
      req.user = {
        uid: session.userId,
        sub: session.userId,
        email: session.email,
        email_verified: session.emailConfirmed,
        role: session.role,
        name: session.profile.name,
        auth_provider: 'supabase',
      } as unknown as DecodedIdToken;
      return next();
    }

    if (!allowFirebaseFallback) {
      if (!options.verifySupabaseToken) {
        return res.status(503).json({
          error: 'Service Unavailable: Supabase server authentication is not configured.',
          code: 'server/supabase-auth-unconfigured',
        });
      }
      return res.status(401).json({
        error: 'Unauthorized: Valid Supabase Bearer token required',
        code: 'auth/supabase-token-required',
      });
    }

    try {
      const decodedToken = await resolveAdminAuth().verifyIdToken(token);
      if (
        isSyntheticSandboxUid(decodedToken?.uid) ||
        (decodedToken as Record<string, unknown>)?.sandbox_synthetic === true
      ) {
        return res.status(401).json({
          error: 'Unauthorized: Synthetic Sandbox identity is strictly forbidden on server',
          code: 'auth/synthetic-identity-forbidden',
        });
      }
      req.user = decodedToken;
      next();
    } catch (error: any) {
      console.error('Error verifying Firebase ID token in requireAuth:', error?.code || error?.message || error);
      if (error?.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          error: 'Unauthorized: Firebase ID token has expired. Please refresh token.',
          code: 'auth/id-token-expired'
        });
      }
      return res.status(401).json({ 
        error: 'Unauthorized: Invalid authentication token',
        code: 'auth/invalid-token'
      });
    }
  };
}

export const requireAuth = createRequireAuth();

/**
 * Verifies if user has a verified email address on their Firebase ID token.
 */
export const isEmailVerified = (user?: DecodedIdToken): boolean => {
  return user?.email_verified === true;
};

/**
 * Middleware: Requires the authenticated user to have a verified email address (email_verified === true).
 * Mandatory for sensitive administrative and identity operations (Section A2).
 */
export const requireEmailVerified = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized: User authentication required',
      code: 'auth/unauthorized'
    });
  }

  if (!isEmailVerified(user)) {
    return res.status(403).json({
      error: 'Forbidden: Email verification required for this operation',
      code: 'auth/unverified-email'
    });
  }

  next();
};

/**
 * Ensures the authenticated user has one of the allowed roles.
 * Source of Authority: STRICTLY verified Firebase ID Token Custom Claims (`user.role`).
 * Hardcoded email address authorization is strictly forbidden (SEC-01-FIX-01 Section A1).
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized: User authentication required',
        code: 'auth/unauthorized'
      });
    }

    // Source of Authority: Custom Claim role from verified ID token ONLY
    const effectiveRole = typeof user.role === 'string' ? user.role : 'client';

    if (allowedRoles.includes(effectiveRole)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Forbidden: Insufficient privileges for this operation',
      code: 'auth/forbidden-role'
    });
  };
};

export const requireSuperAdmin = requireRole(['super_admin']);


