import { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';

const SESSION_COOKIE = 'caw-session';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory session store — survives per process lifetime
const sessions = new Map<string, { createdAt: number }>();

export function isAuthEnabled(): boolean {
  return !!config.uiPassword;
}

export function isAuthenticated(req: Request): boolean {
  if (!isAuthEnabled()) return true; // no password = fully open
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_MAX_AGE) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/** Middleware: requires auth for the route, returns 401 if not authenticated */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) { next(); return; }
  res.status(401).json({ error: 'Authentication required' });
}

/** Login endpoint handler */
export function login(req: Request, res: Response): void {
  if (!isAuthEnabled()) { res.json({ ok: true }); return; }
  const { password } = req.body as { password?: string };
  if (!password || !config.uiPassword) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  // Timing-safe comparison
  const a = Buffer.from(password);
  const b = Buffer.from(config.uiPassword);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'Invalid password' });
    return;
  }
  const token = randomBytes(32).toString('hex');
  sessions.set(token, { createdAt: Date.now() });
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE });
  res.json({ ok: true });
}

/** Logout endpoint handler */
export function logout(req: Request, res: Response): void {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
}

/** Check auth status */
export function authStatus(req: Request, res: Response): void {
  res.json({ authenticated: isAuthenticated(req), authRequired: isAuthEnabled() });
}
