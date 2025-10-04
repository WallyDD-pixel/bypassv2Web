export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { sendJoinAcceptedEmail, sendOwnerNotifiedAcceptedEmail, sendNewMessageEmail, sendOwnerJoinRequestedEmail } from "@/lib/email";
import { events, eventSlug } from "@/data/events";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") || "";
  const mode = (searchParams.get("mode") || "member").toLowerCase(); // member | owner | message | join-requested
  const slug = searchParams.get("eventSlug") || (events.length ? eventSlug(events[0]) : "test-event");
  const groupName = searchParams.get("groupName") || "Groupe de test";
  const memberEmail = searchParams.get("memberEmail") || "membre@test.com";
  if (!to) return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });

  try {
    if (mode === "owner") {
      const r = await sendOwnerNotifiedAcceptedEmail({ to, eventSlug: slug, groupName, memberEmail });
      return NextResponse.json({ ok: r.ok, mode, to, eventSlug: slug, groupName, memberEmail });
    } else if (mode === "message") {
      const conversationId = Number(searchParams.get("conversationId") || 1);
      const sender = searchParams.get("senderEmail") || memberEmail;
      const senderName = searchParams.get("senderName") || undefined;
      const content = searchParams.get("content") || "Salut ! Ceci est un message de test.";
      const r = await sendNewMessageEmail({ to, eventSlug: slug, groupName, conversationId, senderEmail: sender, senderName, content });
      return NextResponse.json({ ok: r.ok, mode, to, eventSlug: slug, groupName, conversationId, senderEmail: sender, senderName });
    } else if (mode === "join-requested") {
      const amountCents = searchParams.get("amountCents");
      const currency = searchParams.get("currency") || "EUR";
      const r = await sendOwnerJoinRequestedEmail({
        to,
        eventSlug: slug,
        groupName,
        applicantEmail: memberEmail,
        amountCents: amountCents != null ? Number(amountCents) : null,
        currency,
      });
      return NextResponse.json({ ok: r.ok, mode, to, eventSlug: slug, groupName, memberEmail, amountCents, currency });
    } else {
      const r = await sendJoinAcceptedEmail({ to, eventSlug: slug, groupName });
      return NextResponse.json({ ok: r.ok, mode: "member", to, eventSlug: slug, groupName });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "send failed" }, { status: 500 });
  }
}
