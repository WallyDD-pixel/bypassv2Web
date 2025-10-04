export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitJoinRequestUpdated, emitMessageCreated } from "@/lib/events";
import { sendJoinAcceptedEmail, sendOwnerNotifiedAcceptedEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/webpush";

export async function PATCH(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    const body = await _req.json();
    const { status, scannedAt, payoutReleased } = body || {};
    const updated = await prisma.joinRequest.update({
      where: { id },
      data: {
        status: status || undefined,
        scannedAt: scannedAt ? new Date(scannedAt) : undefined,
        payoutReleased: payoutReleased != null ? Boolean(payoutReleased) : undefined,
      },
    });

  // Si la demande est acceptée, garantir la conversation et l'adhésion du membre
  if ((status || updated.status) === "accepted") {
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

        // Crée un message de bienvenue dans la conversation
        try {
          const content = "a rejoint le groupe";
          const createdMsg = await prisma.message.create({
            data: {
              conversationId: conv.id,
              senderEmail: updated.memberEmail.toLowerCase(),
              content,
            },
          });
          try {
            emitMessageCreated({
              id: createdMsg.id,
              conversationId: createdMsg.conversationId,
              senderEmail: createdMsg.senderEmail,
              content: createdMsg.content,
              createdAt: createdMsg.createdAt.toISOString(),
            });
          } catch {}
        } catch {}
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
          url: `/scan`,
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
