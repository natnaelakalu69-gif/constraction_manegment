import { NextResponse } from "next/server";
import { createUser, errorPayload, readBody } from "@/server/services/rbac";

export async function POST(req: Request) {
  try {
    const user = await createUser(await readBody(req));
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
