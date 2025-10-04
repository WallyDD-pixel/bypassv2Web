import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { name, email, gender, avatarUrl } = data;
    if (!name || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    // Upsert (update si existe, sinon crée)
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, gender, avatarUrl },
      create: { name, email, gender, avatarUrl },
    });
    return NextResponse.json({ user });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
