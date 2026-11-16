import { config } from './config.js';

export const SESSION_COOKIE = 'ev_session';
export const CSRF_COOKIE = 'ev_csrf';
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function baseOptions() {
  return {
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}

export function sessionCookieOptions() {
  return { ...baseOptions(), httpOnly: true };
}

export function csrfCookieOptions() {
  return { ...baseOptions(), httpOnly: false };
}

export function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
}

export function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
}

export function clearAuthCookies(res) {
  const options = { secure: config.isProduction, sameSite: 'lax', path: '/' };
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
}
