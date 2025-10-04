export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { generateClientToken } from "@/lib/paypal";

export async function GET() {
  try {
    const token = await generateClientToken();
    return NextResponse.json({ clientToken: token });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to get client token" }, { status: 500 });
  }
}
