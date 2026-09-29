"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { createSession, destroySession } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { error: "Enter your username and password." };

  const user = getDb().select().from(schema.users).where(eq(schema.users.username, username)).get();
  if (!user || !user.active || !verifyPassword(user.passwordHash, password)) {
    return { error: "That username and password don't match." };
  }

  await createSession(user.id);
  redirect(user.role === "admin" ? "/admin" : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
