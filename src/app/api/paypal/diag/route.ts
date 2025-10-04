import { NextResponse } from "next/server";
import { paypalBaseUrl } from "@/lib/paypal";

export const runtime = "nodejs";

export async function GET() {
  // Ne pas exposer en production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  const env = process.env.PAYPAL_ENV || "";
  const cid = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const csec = process.env.PAYPAL_CLIENT_SECRET || "";
  const maskedId = cid ? `${cid.slice(0, 6)}…(${cid.length})` : "";
  const base = paypalBaseUrl();
  return NextResponse.json({
    PAYPAL_ENV: env,
    PAYPAL_CLIENT_ID: maskedId,
    PAYPAL_CLIENT_SECRET_present: Boolean(csec),
    baseUrl: base,
    nodeEnv: process.env.NODE_ENV,
  });
}
