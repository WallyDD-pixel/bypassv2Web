'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createConversation(formData: FormData) {
  const eventSlug = String(formData.get('eventSlug') || '').trim();
  const groupName = String(formData.get('groupName') || '').trim();
  if (!eventSlug || !groupName) return;
  try {
    await prisma.conversation.create({ data: { eventSlug, groupName } });
  } catch {}
  revalidatePath('/admin/conversations');
}

export async function deleteConversation(formData: FormData) {
  const id = Number(String(formData.get('id') || ''));
  if (!id || Number.isNaN(id)) return;
  try { await prisma.conversation.delete({ where: { id } }); } catch {}
  revalidatePath('/admin/conversations');
}
