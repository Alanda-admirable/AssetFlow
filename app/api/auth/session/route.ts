import { getActor } from "../../../lib/actor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getActor(request);
  if (!actor) return Response.json({ error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  const { sessionId: _sessionId, ...publicActor } = actor;
  return Response.json(
    { actor: publicActor },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    }
  );
}
