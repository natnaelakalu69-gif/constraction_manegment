import { NextResponse } from "next/server";
import { deleteUser, errorPayload, parseId, readBody, updateUser } from "@/server/services/rbac";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await ctx.params).id, "id");
    return NextResponse.json(await updateUser(id, await readBody(req)));
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await ctx.params).id, "id");
    return NextResponse.json(await deleteUser(id));
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
