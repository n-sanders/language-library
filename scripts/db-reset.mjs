import { rmSync } from "node:fs";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const dbPath = process.env.DATABASE_PATH || "./data/app.db";

for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(dbPath + suffix, { force: true });
}

console.log(`Deleted ${dbPath}. It will be recreated on the next start.`);
