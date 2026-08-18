import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "../../db";
import { hashSessionToken } from "../../db/security";
import { authSessions, departments, roles, users } from "../../db/schema";

export const SESSION_COOKIE = "assetflow_session";

export type Actor = {
  id: number;
  username: string | null;
  email: string;
  fullName: string;
  roleCode: string | null;
  roleName: string | null;
  departmentId: number | null;
  departmentName: string | null;
  mustChangePassword: boolean;
  sessionId: number;
};

export function getCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  for (const part of cookies.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export async function getActor(request: Request): Promise<Actor | null> {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const db = getDb();
  const tokenHash = await hashSessionToken(token);
  const [actor] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      roleCode: roles.code,
      roleName: roles.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
      mustChangePassword: users.mustChangePassword,
      sessionId: authSessions.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .leftJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(
      eq(authSessions.tokenHash, tokenHash),
      isNull(authSessions.revokedAt),
      gt(authSessions.expiresAt, new Date().toISOString()),
      eq(users.status, "active"),
    ))
    .limit(1);
  if (!actor) return null;
  await db.update(authSessions).set({ lastSeenAt: new Date().toISOString() }).where(eq(authSessions.id, actor.sessionId));
  return actor;
}

export function canManage(actor: Actor | null) {
  return actor?.roleCode === "admin" || actor?.roleCode === "asset_officer";
}

export function canApprove(actor: Actor | null) {
  return actor?.roleCode === "admin" || actor?.roleCode === "approver";
}

export function isAdmin(actor: Actor | null) {
  return actor?.roleCode === "admin";
}
