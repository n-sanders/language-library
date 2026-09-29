import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const target = ".env.local";

if (existsSync(target)) {
  console.log(`${target} already exists; leaving it unchanged.`);
} else {
  const template = readFileSync(".env.example", "utf8");
  const secret = randomBytes(32).toString("hex");
  const contents = template.replace(/^APP_SECRET=.*$/m, `APP_SECRET=${secret}`);
  writeFileSync(target, contents);
  console.log(`Created ${target} with a random APP_SECRET.`);
}

console.log("Next: npm run dev, then open http://localhost:3000 (admin / admin).");
