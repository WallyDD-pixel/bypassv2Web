'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createRequest(formData: FormData) {
  const eventSlug = String(formData.get('eventSlug') || '').trim();
  const groupName = String(formData.get('groupName') || '').trim();
  const memberEmail = String(formData.get('memberEmail') || '').trim().toLowerCase();
  const amountCentsStr = String(formData.get('amountCents') || '').trim();
  const amountCents = amountCentsStr ? Number(amountCentsStr) : undefined;
  const currency = String(formData.get('currency') || 'EUR');
  const status = String(formData.get('status') || 'pending');
  if (!eventSlug || !groupName || !memberEmail) return;
  try {
    await prisma.joinRequest.create({ data: { eventSlug, groupName, memberEmail, amountCents, currency, status } as any });
  } catch { /* ignore */ }
  revalidatePath('/admin/requests');
}

export async function deleteRequest(formData: FormData) {
  const id = Number(String(formData.get('id') || ''));
  if (!id || Number.isNaN(id)) return;
  try { await prisma.joinRequest.delete({ where: { id } }); } catch {}
  revalidatePath('/admin/requests');
}
