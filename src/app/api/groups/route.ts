import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitGroupCreated, emitMessageCreated } from "@/lib/events";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || undefined;
  const ownerEmail = searchParams.get("ownerEmail") || undefined;
  const where: any = {};
  if (slug) where.eventSlug = slug;
  if (ownerEmail) where.ownerEmail = ownerEmail;
  const groups = await prisma.group.findMany({ where, orderBy: { createdAt: "desc" } });
  return new Response(JSON.stringify(groups), { status: 200, headers: { "content-type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventSlug, name, ownerEmail, ownerName, avatarUrl, femaleCount, maleCount, members, pricePerMale, arrivalTime } = body || {};
  if (!eventSlug || !name || !ownerEmail) {
    return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400 });
  }
  const created = await prisma.group.create({
    data: {
      eventSlug,
      name,
      ownerEmail,
      ownerName,
      avatarUrl,
      femaleCount: Number(femaleCount ?? 0),
      maleCount: Number(maleCount ?? 0),
      members: Number(members ?? 0),
      pricePerMale: pricePerMale != null ? Number(pricePerMale) : null,
      arrivalTime: arrivalTime ?? null,
    },
  });
  // Upsert conversation et ajouter le propriétaire comme membre
  try {
    const conv = await prisma.conversation.upsert({
      where: { eventSlug_groupName: { eventSlug, groupName: name } },
      update: {},
      create: { eventSlug, groupName: name },
    });
  await prisma.conversationMember.upsert({
      where: { conversationId_userEmail: { conversationId: conv.id, userEmail: ownerEmail.toLowerCase() } },
      update: {},
      create: { conversationId: conv.id, userEmail: ownerEmail.toLowerCase() },
    });
    // Premier message système: création de groupe
    try {
      const createdMsg = await prisma.message.create({
        data: {
          conversationId: conv.id,
          senderEmail: ownerEmail.toLowerCase(),
          content: "a créé le groupe",
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
  try { emitGroupCreated({ eventSlug, name, ownerEmail, ownerName }); } catch {}
  return new Response(JSON.stringify(created), { status: 201, headers: { "content-type": "application/json" } });
}
