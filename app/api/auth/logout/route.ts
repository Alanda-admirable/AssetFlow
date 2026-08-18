import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { activityLogs, authSessions } from "../../../../db/schema";
import { getActor, SESSION_COOKIE } from "../../../lib/actor";

export async function POST(request: Request) {
  const actor = await getActor(request);
  if (actor) {
    const db = getDb();
    await db.update(authSessions).set({ revokedAt: new Date().toISOString() }).where(eq(authSessions.id, actor.sessionId));
    await db.insert(activityLogs).values({ userId: actor.id, action: "auth.logout", targetType: "session", targetId: actor.sessionId, summary: "ออกจากระบบ" });
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0${secure}`);
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
