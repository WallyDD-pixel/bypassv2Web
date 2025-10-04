import { NextRequest } from "next/server";

export type ServerUser = { email: string; name?: string };

export function getServerUserFromRequest(req: NextRequest): ServerUser | null {
  try {
    const email = req.cookies.get("auth-email")?.value?.toLowerCase() || "";
    const name = req.cookies.get("auth-name")?.value || undefined;
    if (!email) return null;
    return { email, name };
  } catch {
    return null;
  }
}
