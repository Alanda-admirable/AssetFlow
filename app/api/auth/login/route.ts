import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { createSessionToken, hashSessionToken, verifyPassword } from "../../../../db/security";
import { ensureDemoCredentials, seedDatabaseIfEmpty } from "../../../../db/seed";
import { activityLogs, authSessions, roles, users } from "../../../../db/schema";
import { SESSION_COOKIE } from "../../../lib/actor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await seedDatabaseIfEmpty();
    await ensureDemoCredentials();
    const body = await request.json() as { username?: string; password?: string };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!username || !password) return Response.json({ error: "กรุณากรอก User ID และรหัสผ่าน" }, { status: 400 });

    const db = getDb();
    const [account] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        fullName: users.fullName,
        passwordHash: users.passwordHash,
        passwordSalt: users.passwordSalt,
        passwordIterations: users.passwordIterations,
        mustChangePassword: users.mustChangePassword,
        status: users.status,
        roleCode: roles.code,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.username, username), eq(users.status, "active")))
      .limit(1);

    const valid = account?.passwordHash && account.passwordSalt
      ? await verifyPassword(password, account.passwordHash, account.passwordSalt, account.passwordIterations)
      : false;
    if (!account || !valid) return Response.json({ error: "User ID หรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });

    const token = createSessionToken();
    const tokenHash = await hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
    await db.insert(authSessions).values({
      tokenHash,
      userId: account.id,
      expiresAt: expiresAt.toISOString(),
      ipAddress: request.headers.get("cf-connecting-ip"),
      userAgent: request.headers.get("user-agent"),
    });
    await db.update(users).set({ lastLoginAt: now.toISOString(), updatedAt: now.toISOString() }).where(eq(users.id, account.id));
    await db.insert(activityLogs).values({
      userId: account.id,
      action: "auth.login",
      targetType: "session",
      summary: `เข้าสู่ระบบด้วย User ID ${account.username}`,
      ipAddress: request.headers.get("cf-connecting-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    const response = Response.json({
      user: { id: account.id, username: account.username, fullName: account.fullName, roleCode: account.roleCode, roleName: account.roleName },
      mustChangePassword: !!account.mustChangePassword,
    });
    response.headers.set("Set-Cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ" }, { status: 500 });
  }
}
