import { NextResponse } from "next/server";
import { createRole, errorPayload, getSnapshot, readBody } from "@/server/services/rbac";

export async function GET() {
  try {
    return NextResponse.json(await getSnapshot());
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const role = await createRole(await readBody(req));
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
