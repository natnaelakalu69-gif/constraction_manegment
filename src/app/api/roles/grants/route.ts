import { NextResponse } from "next/server";
import {
  errorPayload, grantPermission, grantUserRole, parseId,
  readBody, revokePermission, revokeUserRole,
} from "@/server/services/rbac";

export async function POST(req: Request) {
  try {
    const b = await readBody(req);
    if (b.type === "permission") return NextResponse.json(await grantPermission(b));
    if (b.type === "role") return NextResponse.json(await grantUserRole(b));
    return NextResponse.json({ error: "type must be 'permission' or 'role'." }, { status: 400 });
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    const roleId = parseId(params.get("roleId"), "roleId");
    if (params.get("type") === "permission") {
      return NextResponse.json(await revokePermission(roleId, parseId(params.get("permissionId"), "permissionId")));
    }
    if (params.get("type") === "role") {
      return NextResponse.json(await revokeUserRole(parseId(params.get("userId"), "userId"), roleId));
    }
    return NextResponse.json({ error: "type must be 'permission' or 'role'." }, { status: 400 });
  } catch (error) {
    const { error: message, status } = errorPayload(error);
    return NextResponse.json({ error: message }, { status });
  }
}
