import { NextResponse } from "next/server";
import { getPublicVapidKey } from "@/lib/webpush";

export function GET() {
  return NextResponse.json({ key: getPublicVapidKey() });
}
