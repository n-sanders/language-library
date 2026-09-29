import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { hashPassword } from "@/lib/password";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

const globalForDb = globalThis as unknown as { __languageLibraryDb?: Db };

function open(): Db {
  const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/app.db");
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  seedAdmin(db);
  return db;
}

function seedAdmin(db: Db) {
  const existing = db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin")).get();
  if (existing) return;

  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin";
  db.insert(schema.users)
    .values({ username, displayName: "Admin", role: "admin", passwordHash: hashPassword(password), gradeLevel: 8 })
    .run();
  console.log(`[language-library] Created admin account "${username}".`);
}

/** Opens the database on first use, applying migrations and seeding the admin account. */
export function getDb(): Db {
  if (!globalForDb.__languageLibraryDb) {
    globalForDb.__languageLibraryDb = open();
  }
  return globalForDb.__languageLibraryDb;
}

export { schema };
