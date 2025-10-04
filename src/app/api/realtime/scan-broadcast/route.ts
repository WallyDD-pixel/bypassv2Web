export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { emitJoinRequestUpdated } from "@/lib/events";
import { sendMemberScannedEmail, sendOwnerScannedEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

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
    // Récupérer infos organisatrice (owner) et nom du membre
    let ownerEmail: string | undefined;
    let ownerName: string | undefined | null;
    let memberName: string | undefined | null;
    try {
      const group = await prisma.group.findFirst({ where: { eventSlug: String(eventSlug), name: String(groupName) } });
      if (group) {
        ownerEmail = String(group.ownerEmail || "").toLowerCase();
        ownerName = group.ownerName || null;
      }
      const member = await prisma.user.findUnique({ where: { email: String(memberEmail).toLowerCase() } });
      memberName = member?.name || null;
    } catch {}
    // Émettre un événement "joinRequest:updated" minimal pour SSE
    const payload = {
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
        ownerEmail,
        ownerName,
        memberName,
      } as const;
    try { emitJoinRequestUpdated(payload as any); } catch {}
    // Emails (best-effort)
    try {
      if (memberEmail) {
        await sendMemberScannedEmail({ to: String(memberEmail).toLowerCase(), eventSlug: String(eventSlug), groupName: String(groupName), ownerName: ownerName || undefined });
      }
    } catch {}
    try {
      if (ownerEmail) {
        await sendOwnerScannedEmail({ to: ownerEmail, eventSlug: String(eventSlug), groupName: String(groupName), memberEmail: String(memberEmail).toLowerCase(), memberName: memberName || undefined, amountCents: amountCents == null ? null : Number(amountCents), currency: currency == null ? null : String(currency) });
      }
    } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
