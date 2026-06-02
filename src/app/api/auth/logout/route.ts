import { clearCurrentSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearCurrentSession();
  return Response.json({ ok: true });
}
