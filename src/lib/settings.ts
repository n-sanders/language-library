import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { decrypt, encrypt } from "./crypto";

export const SETTING_KEYS = {
  apiKey: "openrouter.api_key",
  sentenceModel: "model.sentence",
  helperModel: "model.helper",
} as const;

export const DEFAULT_MODELS = {
  sentence: "openai/gpt-4o-mini",
  helper: "openai/gpt-4o-mini",
};

function read(key: string): { value: string; isEncrypted: boolean } | undefined {
  return getDb().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
}

function write(key: string, value: string, isEncrypted = false) {
  getDb()
    .insert(schema.settings)
    .values({ key, value, isEncrypted })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, isEncrypted } })
    .run();
}

export function getApiKey(): string | null {
  const row = read(SETTING_KEYS.apiKey);
  if (!row) return null;
  try {
    return row.isEncrypted ? decrypt(row.value) : row.value;
  } catch {
    console.error("[settings] Could not decrypt the OpenRouter key. Was APP_SECRET changed? Re-enter the key.");
    return null;
  }
}

export function setApiKey(apiKey: string) {
  write(SETTING_KEYS.apiKey, encrypt(apiKey), true);
}

export function clearApiKey() {
  getDb().delete(schema.settings).where(eq(schema.settings.key, SETTING_KEYS.apiKey)).run();
}

/** Shows just enough of the key for the admin to recognize it. */
export function getApiKeyHint(): string | null {
  const key = getApiKey();
  if (!key) return null;
  return `…${key.slice(-4)}`;
}

export function getModels() {
  return {
    sentence: read(SETTING_KEYS.sentenceModel)?.value || DEFAULT_MODELS.sentence,
    helper: read(SETTING_KEYS.helperModel)?.value || DEFAULT_MODELS.helper,
  };
}

export function setModels(models: { sentence: string; helper: string }) {
  write(SETTING_KEYS.sentenceModel, models.sentence);
  write(SETTING_KEYS.helperModel, models.helper);
}
