export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerUserFromRequest } from "@/lib/auth-server";
import { sendPushToUser } from "@/lib/webpush";
import { sendOwnerJoinRequestedEmail } from "@/lib/email";
import { isUserActive } from "@/app/api/user-visibility/route";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const eventSlug = searchParams.get("eventSlug") || undefined;
  const memberEmail = searchParams.get("memberEmail") || undefined;
  const groupName = searchParams.get("groupName") || undefined;
  const where: any = {};
  if (eventSlug) where.eventSlug = eventSlug;
  if (memberEmail) where.memberEmail = memberEmail;
  if (groupName) where.groupName = groupName;
  const list = await prisma.joinRequest.findMany({ where, orderBy: { createdAt: "desc" } });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  try {
  const authUser = getServerUserFromRequest(req);
    const body = await req.json();
    const { eventSlug, groupName, memberEmail, amountCents, currency, method, status } = body || {};
    if (!eventSlug || !groupName || !memberEmail) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    // Guard: éviter les doublons actifs le même jour pour le même utilisateur/groupe/évènement
    try {
    const existing = await prisma.joinRequest.findFirst({
        where: {
          eventSlug: String(eventSlug),
          groupName: String(groupName),
          memberEmail: String(memberEmail).toLowerCase(),
      // 'in' doit recevoir un tableau de chaînes (champ non-nullable)
      status: { in: ["pending", "accepted"] },
        },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        return NextResponse.json(existing, { status: 200 });
      }
    } catch {}
  const created = await prisma.joinRequest.create({
      data: {
        eventSlug,
        groupName,
    memberEmail: String((authUser?.email || memberEmail)).toLowerCase(),
        amountCents: amountCents != null ? Number(amountCents) : null,
        currency: currency || null,
        method: method || null,
        status: status || undefined,
      },
    });
    try {
      const payload = {
        id: created.id,
        eventSlug: created.eventSlug,
        groupName: created.groupName,
        memberEmail: created.memberEmail,
        amountCents: created.amountCents,
        currency: created.currency,
        method: created.method,
        status: created.status,
        createdAt: created.createdAt.toISOString(),
        scannedAt: created.scannedAt ? created.scannedAt.toISOString() : null,
        payoutReleased: created.payoutReleased ?? null,
      } as const;
      const { emitJoinRequestCreated } = await import("@/lib/events");
      emitJoinRequestCreated(payload);
    } catch {}

    // Best-effort: notifier l'organisatrice par email
    try {
      const group = await prisma.group.findFirst({ where: { eventSlug, name: groupName } });
      const ownerEmail = group?.ownerEmail;
      if (ownerEmail) {
        await sendOwnerJoinRequestedEmail({
          to: ownerEmail,
          eventSlug,
          groupName,
      applicantEmail: String(memberEmail).toLowerCase(),
      applicantName: authUser?.name || undefined,
          amountCents: amountCents != null ? Number(amountCents) : null,
          currency: currency || null,
        });
        // push (seulement si l'utilisateur n'est pas actif sur le site)
        if (!isUserActive(ownerEmail)) {
          await sendPushToUser(ownerEmail, {
            title: "Nouvelle demande de groupe",
            body: `${authUser?.name || String(memberEmail)} propose de rejoindre ${groupName}`,
            url: `/events/${eventSlug}/requests`,
          });
        }
      }
    } catch {}
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
