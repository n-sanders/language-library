import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { loadOwnExercise } from "@/lib/exercises";

const bodySchema = z.object({ note: z.string().max(1000).default("") });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { exercise } = loadOwnExercise(Number(id), user.id);
  const { note } = bodySchema.parse(await req.json());

  getDb()
    .insert(schema.problemReports)
    .values({ exerciseId: exercise.id, userId: user.id, note: note.trim() })
    .run();

  return NextResponse.json({ ok: true });
});
