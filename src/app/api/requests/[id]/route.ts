export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitJoinRequestUpdated } from "@/lib/events";
import { sendJoinAcceptedEmail, sendOwnerNotifiedAcceptedEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/webpush";

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await _req.json();
    const { status, scannedAt, payoutReleased } = body || {};
    // Récupérer l'état précédent pour détecter un changement de statut
    const prev = await prisma.joinRequest.findUnique({ where: { id } });
    if (!prev) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.joinRequest.update({
      where: { id },
      data: {
        status: status || undefined,
        scannedAt: scannedAt ? new Date(scannedAt) : undefined,
        payoutReleased: payoutReleased != null ? Boolean(payoutReleased) : undefined,
      },
    });
    const justAccepted = prev.status !== "accepted" && updated.status === "accepted";
  // Si la demande vient d'être acceptée (changement de statut), garantir la conversation et l'adhésion du membre
  if (justAccepted) {
      try {
        // Assure l'existence de la conversation (eventSlug + groupName)
        const conv = await prisma.conversation.upsert({
          where: { eventSlug_groupName: { eventSlug: updated.eventSlug, groupName: updated.groupName } },
          update: {},
          create: { eventSlug: updated.eventSlug, groupName: updated.groupName },
        });

        // Ajoute le membre à la conversation
        await prisma.conversationMember.upsert({
          where: { conversationId_userEmail: { conversationId: conv.id, userEmail: updated.memberEmail.toLowerCase() } },
          update: {},
          create: { conversationId: conv.id, userEmail: updated.memberEmail.toLowerCase() },
        });
      } catch {}
      // Email de notification au membre (best-effort)
      try {
        await sendJoinAcceptedEmail({
          to: updated.memberEmail,
          eventSlug: updated.eventSlug,
          groupName: updated.groupName,
        });
        await sendPushToUser(updated.memberEmail, {
          title: "Votre demande a été acceptée",
          body: `${updated.groupName} — ${updated.eventSlug}`,
          url: `/qr/${updated.eventSlug}/${encodeURIComponent(updated.groupName)}`,
        });
      } catch {}
      // Email de notification à l’organisatrice du groupe (best-effort)
      try {
        // retrouver l’owner du groupe
        const group = await prisma.group.findFirst({ where: { eventSlug: updated.eventSlug, name: updated.groupName } });
        const ownerEmail = group?.ownerEmail;
        if (ownerEmail) {
          await sendOwnerNotifiedAcceptedEmail({
            to: ownerEmail,
            eventSlug: updated.eventSlug,
            groupName: updated.groupName,
            memberEmail: updated.memberEmail,
          });
        }
      } catch {}
    }
    try {
      emitJoinRequestUpdated({
        id: updated.id,
        eventSlug: updated.eventSlug,
        groupName: updated.groupName,
        memberEmail: updated.memberEmail,
        amountCents: updated.amountCents,
        currency: updated.currency,
        method: updated.method,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        scannedAt: updated.scannedAt ? updated.scannedAt.toISOString() : null,
        payoutReleased: updated.payoutReleased ?? null,
      });
    } catch {}
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
