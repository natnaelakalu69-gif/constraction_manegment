import { NextResponse } from "next/server";
import { createPermission, errorPayload, readBody } from "@/server/services/rbac";

export async function POST(req: Request) {
  try {
    const permission = await createPermission(await readBody(req));
    return NextResponse.json(permission, { status: 201 });
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
