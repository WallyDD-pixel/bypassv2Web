import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, gender, avatarUrl } = data as { name?: string; email?: string; gender?: string; avatarUrl?: string };
    if (!name || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const emailLower = String(email).toLowerCase();
    // Rechercher une entrée existante en "quasi" insensible à la casse
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { email: emailLower }, { email: String(email).toUpperCase() }],
      },
    });
    let user;
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { name, gender, avatarUrl, email: emailLower }, // normaliser à la baisse
      });
    } else {
      user = await prisma.user.create({ data: { name, email: emailLower, gender, avatarUrl } });
    }
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }
    const emailLower = String(email).toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email }, { email: emailLower }, { email: String(email).toUpperCase() }] },
    });
    if (!user) return NextResponse.json({ user: null }, { status: 200 });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
