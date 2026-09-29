"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema } from "@/db";
import type { ActionResult } from "@/components/admin/ActionForm";
import { testConnection } from "@/lib/ai/openrouter";
import { destroyAllSessionsForUser, requireAdmin } from "@/lib/auth";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { clearApiKey as clearStoredKey, getModels, setApiKey, setModels } from "@/lib/settings";

const USERNAME_RE = /^[a-z0-9._-]{2,32}$/;

function str(fd: FormData, key: string) {
  return String(fd.get(key) ?? "").trim();
}

function parseGrade(fd: FormData): number | null {
  const n = Number(fd.get("gradeLevel"));
  return Number.isInteger(n) && n >= 0 && n <= 8 ? n : null;
}

function fail(error: string): ActionResult {
  return { error };
}

export async function createStudent(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const username = str(fd, "username").toLowerCase();
  const displayName = str(fd, "displayName");
  const password = String(fd.get("password") ?? "");
  const gradeLevel = parseGrade(fd);

  if (!USERNAME_RE.test(username)) return fail("Username: 2-32 letters, numbers, dots, dashes, or underscores.");
  if (!displayName) return fail("Enter a display name.");
  if (password.length < MIN_PASSWORD_LENGTH) return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (gradeLevel === null) return fail("Pick a grade level.");

  const db = getDb();
  const exists = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.username, username)).get();
  if (exists) return fail("That username is already taken.");

  db.insert(schema.users)
    .values({ username, displayName, role: "student", passwordHash: hashPassword(password), gradeLevel })
    .run();
  revalidatePath("/admin");
  return { ok: true, message: `Added ${displayName}.` };
}

export async function updateStudent(userId: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const displayName = str(fd, "displayName");
  const gradeLevel = parseGrade(fd);
  const active = fd.get("active") === "on";
  if (!displayName) return fail("Enter a display name.");
  if (gradeLevel === null) return fail("Pick a grade level.");

  const db = getDb();
  const result = db
    .update(schema.users)
    .set({ displayName, gradeLevel, active })
    .where(and(eq(schema.users.id, userId), eq(schema.users.role, "student")))
    .run();
  if (result.changes === 0) return fail("Student not found.");
  if (!active) destroyAllSessionsForUser(userId);

  revalidatePath(`/admin/students/${userId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Saved." };
}

export async function resetPassword(userId: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return fail(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);

  const db = getDb();
  const result = db
    .update(schema.users)
    .set({ passwordHash: hashPassword(password) })
    .where(eq(schema.users.id, userId))
    .run();
  if (result.changes === 0) return fail("User not found.");
  if (userId !== admin.id) destroyAllSessionsForUser(userId);
  return { ok: true, message: "Password updated." };
}

export async function changeUsername(userId: number, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const username = str(fd, "username").toLowerCase();
  if (!USERNAME_RE.test(username)) return fail("Username: 2-32 letters, numbers, dots, dashes, or underscores.");

  const db = getDb();
  const taken = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.username, username), ne(schema.users.id, userId)))
    .get();
  if (taken) return fail("That username is already taken.");

  db.update(schema.users).set({ username }).where(eq(schema.users.id, userId)).run();
  revalidatePath(`/admin/students/${userId}`);
  revalidatePath("/admin");
  return { ok: true, message: "Username updated." };
}

export async function saveApiKey(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const key = str(fd, "apiKey");
  if (!key) return fail("Paste an API key first.");
  if (!key.startsWith("sk-")) return fail("OpenRouter keys start with \"sk-\".");
  setApiKey(key);
  revalidatePath("/admin/settings");
  return { ok: true, message: "API key saved." };
}

export async function removeApiKey(): Promise<ActionResult> {
  await requireAdmin();
  clearStoredKey();
  revalidatePath("/admin/settings");
  return { ok: true, message: "API key removed." };
}

export async function saveModels(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const sentence = str(fd, "sentenceModel");
  const helper = str(fd, "helperModel");
  if (!sentence || !helper) return fail("Choose a model for both features.");
  setModels({ sentence, helper });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Models saved." };
}

export async function runConnectionTest(): Promise<ActionResult> {
  await requireAdmin();
  const models = getModels();
  try {
    const sentenceReply = await testConnection(models.sentence);
    const helperReply = models.helper === models.sentence ? sentenceReply : await testConnection(models.helper);
    return {
      ok: true,
      message: `Connected. Sentence model replied "${sentenceReply}", helper model replied "${helperReply}".`,
    };
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Connection failed.");
  }
}

export async function setReportStatus(
  reportId: number,
  status: "open" | "resolved" | "dismissed",
): Promise<void> {
  await requireAdmin();
  getDb().update(schema.problemReports).set({ status }).where(eq(schema.problemReports.id, reportId)).run();
  revalidatePath("/admin/reports");
}
