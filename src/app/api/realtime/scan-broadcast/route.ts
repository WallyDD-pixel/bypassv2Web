export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { emitJoinRequestUpdated } from "@/lib/events";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      eventSlug,
      groupName,
      memberEmail,
      amountCents = null,
      currency = null,
      method = null,
      status = null,
      scannedAt = new Date().toISOString(),
      payoutReleased = true,
    } = body || {};
    if (!eventSlug || !groupName || !memberEmail) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    // Émettre un événement "joinRequest:updated" minimal pour SSE
    try {
      emitJoinRequestUpdated({
        id: 0,
        eventSlug: String(eventSlug),
        groupName: String(groupName),
        memberEmail: String(memberEmail).toLowerCase(),
        amountCents: amountCents == null ? null : Number(amountCents),
        currency: currency == null ? null : String(currency),
        method: method == null ? null : String(method),
        status: status == null ? null : String(status),
        createdAt: new Date().toISOString(),
        scannedAt: scannedAt ? String(scannedAt) : new Date().toISOString(),
        payoutReleased: Boolean(payoutReleased),
      });
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
