import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerUserFromRequest } from "@/lib/auth-server";
import { emitMessageCreated } from "@/lib/events";
import { sendNewMessageEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/webpush";
import { isUserActive } from "@/app/api/user-visibility/route";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const { id: idStr } = await ctx.params;
	const id = Number(idStr);
	if (!Number.isFinite(id)) return NextResponse.json([], { status: 200 });
	const list = await prisma.message.findMany({ where: { conversationId: id }, orderBy: { createdAt: "asc" } });
	return NextResponse.json(list);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	const { id: idStr } = await ctx.params;
	const id = Number(idStr);
	const body = await req.json();
	const { senderEmail, content } = body || {};
	const authUser = getServerUserFromRequest(req);
	const effectiveSender = String((authUser?.email || senderEmail) || "").toLowerCase();
	if (!Number.isFinite(id) || !effectiveSender || !content) return NextResponse.json({ error: "invalid" }, { status: 400 });
	const created = await prisma.message.create({ data: { conversationId: id, senderEmail: effectiveSender, content: String(content) } });
	let senderName: string | null = null;
	try {
		const senderUser = await prisma.user.findUnique({ where: { email: created.senderEmail }, select: { name: true } });
		senderName = senderUser?.name || null;
		emitMessageCreated({
			id: created.id,
			conversationId: created.conversationId,
			senderEmail: created.senderEmail,
			senderName,
			content: created.content,
			createdAt: created.createdAt.toISOString(),
		});
	} catch {}

	// Best-effort: envoyer un email aux autres membres de la conversation
		try {
			const conv = await prisma.conversation.findUnique({ where: { id }, select: { id: true, eventSlug: true, groupName: true, members: { select: { userEmail: true } } } });
		if (conv && conv.eventSlug && conv.groupName) {
				const others = (conv.members || []).map(m => m.userEmail).filter(e => e && e !== created.senderEmail);
				const unique = Array.from(new Set(others));
				// Récupérer les noms: expéditeur + destinataires
				const senderUser = await prisma.user.findUnique({ where: { email: created.senderEmail } });
				const recips = await prisma.user.findMany({ where: { email: { in: unique } }, select: { email: true, name: true } });
				const toNameMap = new Map(recips.map(r => [r.email, r.name] as const));
						await Promise.allSettled(unique.map(async (to) => {
							// email
							await sendNewMessageEmail({
								to,
								eventSlug: conv.eventSlug!,
								groupName: conv.groupName!,
								conversationId: conv.id,
								senderEmail: created.senderEmail,
								senderName: senderUser?.name || null,
								content: created.content,
							});
							// push (seulement si l'utilisateur n'est pas actif sur le site)
							if (!isUserActive(to)) {
								await sendPushToUser(to, {
									title: `Nouveau message de ${senderUser?.name || created.senderEmail}`,
									body: created.content.slice(0, 120),
									url: `/messages/${conv.id}`,
								});
							}
						}));
		}
	} catch {}
	return NextResponse.json(created, { status: 201 });
}

