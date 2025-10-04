'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createUser(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const gender = String(formData.get("gender") || "") || null;
  const avatarUrl = String(formData.get("avatarUrl") || "") || null;

  if (!name) return;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  try {
    await prisma.user.create({ data: { name, email, gender: gender || undefined, avatarUrl: avatarUrl || undefined } });
  } catch (e: any) {
    // ignore errors for now
    return;
  }

  revalidatePath('/admin/users');
  return;
}

export async function deleteUser(formData: FormData) {
  const idStr = String(formData.get("id") || "");
  const id = Number(idStr);
  if (!id || Number.isNaN(id)) return;
  try {
    await prisma.user.delete({ where: { id } });
  } catch (e) {
    return;
  }
  revalidatePath('/admin/users');
  return;
}
