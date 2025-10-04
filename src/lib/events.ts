import { EventEmitter } from "events";

type GlobalWithBus = typeof globalThis & { __app_bus__?: EventEmitter };

const g = globalThis as GlobalWithBus;

export const bus: EventEmitter = g.__app_bus__ || new EventEmitter();
bus.setMaxListeners(1000);

if (!g.__app_bus__) {
  g.__app_bus__ = bus;
}

export type JoinRequestEvent = {
  id: number;
  eventSlug: string;
  groupName: string;
  memberEmail: string;
  amountCents: number | null;
  currency: string | null;
  method: string | null;
  status: string | null;
  createdAt: string;
  scannedAt?: string | null;
  payoutReleased?: boolean | null;
  // Enrichissements optionnels pour contexte UI
  ownerEmail?: string;
  ownerName?: string | null;
  memberName?: string | null;
};

export type GroupCreatedEvent = {
  eventSlug: string;
  name: string;
  ownerEmail: string;
  ownerName?: string | null;
};

export function emitJoinRequestCreated(payload: JoinRequestEvent) {
  bus.emit("joinRequest:created", payload);
}

export function emitJoinRequestUpdated(payload: JoinRequestEvent) {
  bus.emit("joinRequest:updated", payload);
}

export function emitGroupCreated(payload: GroupCreatedEvent) {
  bus.emit("group:created", payload);
}

// Messages realtime
export type MessageCreatedEvent = {
  id: number;
  conversationId: number;
  senderEmail: string;
  senderName?: string | null;
  content: string;
  createdAt: string;
};

export function emitMessageCreated(payload: MessageCreatedEvent) {
  bus.emit("message:created", payload);
}
