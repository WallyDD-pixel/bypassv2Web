import { NextRequest, NextResponse } from "next/server";

// Store pour garder en mémoire les utilisateurs actuellement actifs sur le site
// En production, il faudrait utiliser Redis ou une autre solution persistante
const activeUsers = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const { userEmail, isVisible } = await req.json();
    
    if (!userEmail) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }

    if (isVisible) {
      // L'utilisateur est actif, on met à jour le timestamp
      activeUsers.set(userEmail, Date.now());
    } else {
      // L'utilisateur n'est plus actif
      activeUsers.delete(userEmail);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user visibility:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userEmail = searchParams.get("userEmail");
    
    if (!userEmail) {
      return NextResponse.json({ error: "userEmail required" }, { status: 400 });
    }

    const lastSeen = activeUsers.get(userEmail);
    const isActive = lastSeen && (Date.now() - lastSeen < 30000); // Actif si vu dans les 30 dernières secondes
    
    return NextResponse.json({ isActive: !!isActive });
  } catch (error) {
    console.error("Error checking user visibility:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// Fonction helper pour vérifier si un utilisateur est actif (à utiliser dans d'autres APIs)
export function isUserActive(userEmail: string): boolean {
  const lastSeen = activeUsers.get(userEmail);
  return lastSeen ? (Date.now() - lastSeen < 30000) : false;
}
