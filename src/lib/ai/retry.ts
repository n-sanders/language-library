import { ZodError } from "zod";
import { AnswerKeyError } from "./answerKey";
import { AiNotConfiguredError, OpenRouterError } from "./openrouter";

export const MAX_GENERATION_TRIES = 3;
export const GENERATION_DEADLINE_MS = 45_000;
export const DEFAULT_ATTEMPT_TIMEOUT_MS = 20_000;
/** Don't start a new attempt with less time than this left before the deadline. */
const MIN_ATTEMPT_MS = 5_000;

export class GenerationFailedError extends Error {
  constructor(
    public attempts: number,
    public lastReason: string,
  ) {
    super("Professor Hoot couldn't write a good sentence about that topic. Try a different topic!");
  }
}

/** Errors another attempt can't fix: a missing key, bad credentials, or no credits. */
function isFatal(err: unknown): boolean {
  if (err instanceof AiNotConfiguredError) return true;
  return err instanceof OpenRouterError && [401, 402, 403].includes(err.status);
}

function reasonFor(err: unknown): string {
  if (err instanceof AnswerKeyError) return err.message;
  if (err instanceof ZodError || err instanceof SyntaxError) return "The JSON did not match the required format.";
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Runs `attemptFn` up to MAX_GENERATION_TRIES times within GENERATION_DEADLINE_MS. A rejected answer key's
 * reason is passed to the next attempt so the model can fix it. Each attempt gets a time budget it must
 * pass to the AI call so a slow response can't outlast the deadline.
 */
export async function generateWithRetries<T>(
  attemptFn: (attempt: number, previousError: string | undefined, timeoutMs: number) => Promise<T>,
  opts: { attemptTimeoutMs?: number; label?: string } = {},
): Promise<T> {
  const started = Date.now();
  const perAttempt = opts.attemptTimeoutMs ?? DEFAULT_ATTEMPT_TIMEOUT_MS;
  const label = opts.label ?? "generate";
  let previousError: string | undefined;
  let attempt = 0;

  while (attempt < MAX_GENERATION_TRIES) {
    const remaining = GENERATION_DEADLINE_MS - (Date.now() - started);
    if (remaining < MIN_ATTEMPT_MS) break;
    attempt++;
    try {
      return await attemptFn(attempt, previousError, Math.min(perAttempt, remaining));
    } catch (err) {
      if (isFatal(err)) throw err;
      previousError = reasonFor(err);
      console.warn(`[${label}] attempt ${attempt}/${MAX_GENERATION_TRIES} rejected: ${previousError}`);
    }
  }

  const reason = previousError ?? "Ran out of time before the first attempt.";
  console.error(`[${label}] giving up after ${attempt} attempt(s) in ${Date.now() - started}ms. Last reason: ${reason}`);
  throw new GenerationFailedError(attempt, reason);
}
