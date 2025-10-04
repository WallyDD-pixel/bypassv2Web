export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
  const { amount, description, intent } = await req.json();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
  const useIntent = intent === "AUTHORIZE" ? "AUTHORIZE" : "CAPTURE";
  const order = await createOrder(n, description, useIntent);
    return NextResponse.json(order);
  } catch (e: any) {
  const msg = String(e?.message || "Order creation failed");
  const isCred = msg.toLowerCase().includes("credentials missing");
  const isOAuth = msg.toLowerCase().includes("oauth failed");
  const status = isCred || isOAuth ? 400 : 500;
  return NextResponse.json({ error: msg }, { status });
  }
}
