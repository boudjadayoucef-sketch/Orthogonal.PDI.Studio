import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
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

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
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


