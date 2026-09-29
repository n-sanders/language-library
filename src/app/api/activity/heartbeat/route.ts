import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getChapter } from "@/content/books";
import { handle, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

const MAX_SECONDS_PER_BEAT = 60;

const bodySchema = z.object({
  sessionId: z.number().int().optional(),
  book: z.string(),
  chapter: z.string(),
  seconds: z.number().min(0).max(3600),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = bodySchema.parse(JSON.parse(await req.text()));
  if (!getChapter(body.book, body.chapter)) return jsonError(404, "Unknown chapter.");

  const db = getDb();
  const now = new Date();
  const reported = Math.min(Math.round(body.seconds), MAX_SECONDS_PER_BEAT);

  if (body.sessionId) {
    const session = db
      .select()
      .from(schema.practiceSessions)
      .where(and(eq(schema.practiceSessions.id, body.sessionId), eq(schema.practiceSessions.userId, user.id)))
      .get();

    if (session && session.book === body.book && session.chapter === body.chapter) {
      // Never credit more time than has actually passed since the last beat.
      const elapsed = Math.ceil((now.getTime() - session.lastSeenAt.getTime()) / 1000) + 5;
      const add = Math.min(reported, elapsed);
      db.update(schema.practiceSessions)
        .set({ lastSeenAt: now, activeSeconds: session.activeSeconds + add })
        .where(eq(schema.practiceSessions.id, session.id))
        .run();
      return NextResponse.json({ sessionId: session.id });
    }
  }

  const created = db
    .insert(schema.practiceSessions)
    .values({
      userId: user.id,
      book: body.book,
      chapter: body.chapter,
      startedAt: new Date(now.getTime() - reported * 1000),
      lastSeenAt: now,
      activeSeconds: reported,
    })
    .returning({ id: schema.practiceSessions.id })
    .get();

  return NextResponse.json({ sessionId: created.id });
});
