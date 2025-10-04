import { NextRequest, NextResponse } from "next/server";
import { voidAuthorization } from "@/lib/paypal";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { authorizationID } = await req.json();
    if (!authorizationID) return NextResponse.json({ error: "Missing authorizationID" }, { status: 400 });
    const result = await voidAuthorization(authorizationID);
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Void failed" }, { status: 500 });
  }
}
