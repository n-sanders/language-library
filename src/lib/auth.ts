import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb, schema } from "@/db";
import type { User } from "@/db/schema";

const COOKIE_NAME = "ll_session";
const SESSION_DAYS = 30;
const RENEW_WHEN_DAYS_LEFT = 15;

export type SessionUser = Pick<User, "id" | "username" | "displayName" | "role" | "gradeLevel">;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function expiryFromNow() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = expiryFromNow();
  getDb().insert(schema.sessions).values({ id: hashToken(token), userId, expiresAt }).run();

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Served over plain HTTP on the home LAN; set COOKIE_SECURE=true if you add HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    getDb().delete(schema.sessions).where(eq(schema.sessions.id, hashToken(token))).run();
  }
  jar.delete(COOKIE_NAME);
}

export function destroyAllSessionsForUser(userId: number) {
  getDb().delete(schema.sessions).where(eq(schema.sessions.userId, userId)).run();
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const id = hashToken(token);
  const row = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      role: schema.users.role,
      gradeLevel: schema.users.gradeLevel,
      active: schema.users.active,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .get();

  if (!row || !row.active) return null;

  const daysLeft = (row.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
  if (daysLeft < RENEW_WHEN_DAYS_LEFT) {
    db.update(schema.sessions).set({ expiresAt: expiryFromNow() }).where(eq(schema.sessions.id, id)).run();
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    gradeLevel: row.gradeLevel,
  };
});

/** For pages: redirects to the login page when signed out. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** For pages and server actions: redirects non-admins away. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** For route handlers: throws an HttpError instead of redirecting. */
export async function requireApiUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, "Please sign in again.");
  return user;
}
