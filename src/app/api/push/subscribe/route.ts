export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerUserFromRequest } from "@/lib/auth-server";

export async function POST(req: NextRequest) {
  try {
    const user = getServerUserFromRequest(req);
    if (!user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const body = await req.json();
    const { endpoint, keys, userAgent } = body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await (prisma as any).pushSubscription.upsert({
      where: { endpoint },
      update: { userEmail: user.email, p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent: String(userAgent || "") },
      create: { endpoint, userEmail: user.email, p256dh: String(keys.p256dh), auth: String(keys.auth), userAgent: String(userAgent || "") },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "failed" }, { status: 500 });
  }
}
