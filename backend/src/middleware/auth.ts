import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';

function tokenExpiry(envValue?: string, fallback: string = '7d'): SignOptions['expiresIn'] {
  return (envValue ?? fallback) as SignOptions['expiresIn'];
}

export const SESSION_COOKIE = 'sid';
export const CSRF_COOKIE = 'XSRF-TOKEN';

export interface AuthUser {
  sub: string;
  role: 'student' | 'teacher' | 'registration';
  email?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface TokenPayload {
  sub: string;
  role: 'student' | 'teacher' | 'registration';
  email?: string;
  csrf?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set');
  }
  return secret;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function signToken(payload: {
  sub: string;
  role: 'student' | 'teacher';
  email?: string;
  csrf: string;
}): string {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: tokenExpiry(process.env.JWT_EXPIRES_IN, '7d'),
  });
}

export function signRegistrationToken(pendingId: string): string {
  return jwt.sign(
    { sub: pendingId, role: 'registration' as const },
    getJwtSecret(),
    { expiresIn: tokenExpiry(process.env.REGISTRATION_TOKEN_EXPIRES_IN, '30m') }
  );
}

function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, getJwtSecret()) as TokenPayload;
  return {
    sub: decoded.sub,
    role: decoded.role,
    email: decoded.email,
  };
}

/** Sets the HttpOnly session cookie plus a non-HttpOnly CSRF double-submit cookie. */
export function setAuthCookies(
  res: Response,
  payload: { sub: string; role: 'student' | 'teacher'; email?: string }
) {
  const csrf = generateCsrfToken();
  const token = signToken({ ...payload, csrf });
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.cookie(CSRF_COOKIE, csrf, { ...cookieOptions(), httpOnly: false });
  return csrf;
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

export function getSessionToken(req: Request): string | undefined {
  const fromCookie = (req as Request & { cookies?: Record<string, string> }).cookies?.[SESSION_COOKIE];
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return undefined;
}

export function authMiddleware(allowedRoles: Array<'student' | 'teacher'>) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const token = getSessionToken(req);
    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      const user = verifyToken(token);

      if (user.role === 'registration') {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

export function registrationTokenMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Registration token required' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const user = verifyToken(token);

    if (user.role !== 'registration') {
      res.status(401).json({ error: 'Invalid registration token' });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Registration session expired. Please start again.' });
  }
}

const CSRF_EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/teacher/login',
  '/auth/register',
  '/auth/register/complete',
  '/face/enroll',
  '/config',
]);

/**
 * Double-submit CSRF protection for state-changing requests.
 * The server sets a non-HttpOnly `XSRF-TOKEN` cookie on login; clients must echo
 * its value in the `X-CSRF-Token` header. Cross-origin attackers cannot read the
 * cookie value, so forged requests fail here.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }

  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }

  const cookies = (req as Request & { cookies?: Record<string, string> }).cookies;
  const expected = cookies?.[CSRF_COOKIE];
  const received = req.headers['x-csrf-token'];

  if (!expected || !received || expected !== received) {
    res.status(403).json({ error: 'CSRF token validation failed' });
    return;
  }

  next();
}
