export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** Server and client codes that mean "this topic didn't work out; offer a different one". */
export const isGenerationFailure = (err: unknown) =>
  err instanceof ApiError && (err.code === "generation_failed" || err.code === "timeout");

/** Long enough to outlast the server's generation deadline, so the server's own answer normally arrives first. */
export const GENERATE_TIMEOUT_MS = 60_000;

export async function postJson<T>(url: string, body: unknown, opts: { timeoutMs?: number } = {}): Promise<T> {
  const signal = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw new ApiError("That took too long.", 0, "timeout");
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status, data?.code);
  return data as T;
}
