import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
	const { searchParams } = new URL(req.url);
	const memberEmail = (searchParams.get("memberEmail") || "").toLowerCase();
	if (!memberEmail) return NextResponse.json([], { status: 200 });

	const list = await prisma.conversation.findMany({
		where: { members: { some: { userEmail: memberEmail } } },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			eventSlug: true,
			groupName: true,
			createdAt: true,
			_count: { select: { members: true, messages: true } },
			messages: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
		},
	});
	const shaped = list.map((c) => ({
		id: c.id,
		eventSlug: c.eventSlug,
		groupName: c.groupName,
		createdAt: c.createdAt,
		_count: c._count,
		lastMessageAt: c.messages?.[0]?.createdAt ?? null,
	}));
	return NextResponse.json(shaped);
}

