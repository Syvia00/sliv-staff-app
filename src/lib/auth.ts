import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Throws if ADMIN_PASSWORD isn't set, so misconfiguration is loud rather than silently failing auth. */
function getAdminPassword(): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD environment variable is not set.");
  return secret;
}

export function isAdminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function computeSessionToken(issuedAtSeconds: number): string {
  const hmac = createHmac("sha256", getAdminPassword());
  hmac.update(String(issuedAtSeconds));
  return `${issuedAtSeconds}.${hmac.digest("hex")}`;
}

export function verifyPassword(password: string): boolean {
  return timingSafeStringEqual(password, getAdminPassword());
}

export async function createSession(): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const token = computeSessionToken(issuedAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Verifies the session cookie by recomputing its HMAC from the current ADMIN_PASSWORD.
 * A password rotation in Railway automatically invalidates all existing sessions. */
export async function hasValidSession(): Promise<boolean> {
  if (!isAdminPasswordConfigured()) return false;
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) return false;
  const issuedAtStr = raw.slice(0, dotIndex);
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > SESSION_MAX_AGE_SECONDS) return false;

  let expected: string;
  try {
    expected = computeSessionToken(issuedAt);
  } catch {
    return false;
  }
  return timingSafeStringEqual(raw, expected);
}

export async function requireAdmin(): Promise<void> {
  if (!(await hasValidSession())) {
    throw new Error("Not authenticated.");
  }
}

// Simple in-memory login rate limiter, keyed by client IP. Resets on process restart
// and isn't shared across instances - an acceptable tradeoff at this app's scale, but
// worth knowing if this ever runs behind multiple replicas.
const loginAttempts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

export function isLoginRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_ATTEMPTS;
}
