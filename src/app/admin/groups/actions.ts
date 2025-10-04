'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createGroup(formData: FormData) {
  const eventSlug = String(formData.get('eventSlug') || '').trim();
  const name = String(formData.get('name') || '').trim();
  const ownerEmail = String(formData.get('ownerEmail') || '').trim().toLowerCase();
  const ownerName = String(formData.get('ownerName') || '').trim() || undefined;
  const pricePerMaleStr = String(formData.get('pricePerMale') || '').trim();
  const pricePerMale = pricePerMaleStr ? Number(pricePerMaleStr) : undefined;
  if (!eventSlug || !name || !ownerEmail) return;
  try {
    await prisma.group.create({ data: { eventSlug, name, ownerEmail, ownerName, pricePerMale } as any });
  } catch (e) { /* ignore */ }
  revalidatePath('/admin/groups');
}

export async function deleteGroup(formData: FormData) {
  const id = Number(String(formData.get('id') || ''));
  if (!id || Number.isNaN(id)) return;
  try {
    await prisma.group.delete({ where: { id } });
  } catch (e) { /* ignore */ }
  revalidatePath('/admin/groups');
}
