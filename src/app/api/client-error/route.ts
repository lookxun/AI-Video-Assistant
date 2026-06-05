export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  console.error("[client-error]", {
    message: typeof body.message === "string" ? body.message.slice(0, 1000) : "",
    source: typeof body.source === "string" ? body.source.slice(0, 500) : "",
    lineno: body.lineno,
    colno: body.colno,
    stack: typeof body.stack === "string" ? body.stack.slice(0, 2000) : "",
    href: typeof body.href === "string" ? body.href.slice(0, 500) : "",
    userAgent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 500) : "",
  });

  return Response.json({ ok: true });
}
