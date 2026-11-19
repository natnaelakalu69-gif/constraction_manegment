import { NextResponse } from "next/server";
import { errorPayload, parseId, readBody, updatePermission } from "@/server/services/rbac";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await ctx.params).id, "id");
    return NextResponse.json(await updatePermission(id, await readBody(req)));
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
