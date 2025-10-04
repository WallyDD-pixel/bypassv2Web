export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";

export async function POST(req: NextRequest) {
  try {
    const { orderID } = await req.json();
    if (!orderID || typeof orderID !== "string") {
      return NextResponse.json({ error: "Missing orderID" }, { status: 400 });
    }
    const result = await captureOrder(orderID);
    return NextResponse.json(result);
  } catch (e: any) {
  const msg = String(e?.message || "Capture failed");
  const status = msg.toLowerCase().includes("oauth failed") ? 400 : 500;
  return NextResponse.json({ error: msg }, { status });
  }
}
