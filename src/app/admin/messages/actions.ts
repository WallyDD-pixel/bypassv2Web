'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createMessage(formData: FormData) {
  const conversationId = Number(String(formData.get('conversationId') || ''));
  const senderEmail = String(formData.get('senderEmail') || '').trim().toLowerCase();
  const content = String(formData.get('content') || '').trim();
  if (!conversationId || Number.isNaN(conversationId) || !senderEmail || !content) return;
  try { await prisma.message.create({ data: { conversationId, senderEmail, content } }); } catch {}
  revalidatePath('/admin/messages');
}

export async function deleteMessage(formData: FormData) {
  const id = Number(String(formData.get('id') || ''));
  if (!id || Number.isNaN(id)) return;
  try { await prisma.message.delete({ where: { id } }); } catch {}
  revalidatePath('/admin/messages');
}
