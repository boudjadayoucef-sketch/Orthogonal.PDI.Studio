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
 * Ensures the authenticated user has one of the allowed roles.
 * Order of authority:
 * 1. Custom Claim `role` from verified Firebase ID token (req.user.role)
 * 2. Fallback to historical Super Admin email list ONLY if no custom claim role is set.
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User authentication required' });
    }

    const email = user.email?.toLowerCase();
    const isSuperAdminEmail = email === 'boudjada.youcef@gmail.com' || email === 'superadmin@pdi-vision.dz';
    
    // 1. Primary Authority: Custom Claim role from verified ID token
    const customClaimRole = typeof user.role === 'string' ? user.role : undefined;
    
    // 2. Fallback: Super admin email compatibility fallback ONLY when custom claim is absent
    const effectiveRole = customClaimRole || (isSuperAdminEmail ? 'super_admin' : 'client');

    if (allowedRoles.includes(effectiveRole) || (!customClaimRole && isSuperAdminEmail)) {
      return next();
    }

    return res.status(403).json({ 
      error: 'Forbidden: Insufficient privileges for this operation',
      code: 'auth/forbidden-role'
    });
  };
};

export const requireSuperAdmin = requireRole(['super_admin']);

