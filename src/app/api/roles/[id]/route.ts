import { NextResponse } from "next/server";
import { deleteRole, errorPayload, parseId, readBody, updateRole } from "@/server/services/rbac";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await ctx.params).id, "id");
    return NextResponse.json(await updateRole(id, await readBody(req)));
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = parseId((await ctx.params).id, "id");
    return NextResponse.json(await deleteRole(id));
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
