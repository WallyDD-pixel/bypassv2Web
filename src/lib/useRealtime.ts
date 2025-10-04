"use client";
import { useEffect, useRef } from "react";

type Handlers = Partial<{
  onJoinRequestCreated: (p: JoinRequestPayload) => void;
  onJoinRequestUpdated: (p: JoinRequestPayload) => void;
  onGroupCreated: (p: GroupPayload) => void;
  onMessageCreated: (p: MessagePayload) => void;
}>;

// Minimal event payloads exchanged over SSE
type JoinRequestPayload = {
  id: number;
  eventSlug?: string;
  groupName?: string;
  status?: "pending" | "accepted" | "refused" | string;
  amountCents?: number | null;
  currency?: string | null;
  method?: string | null;
  createdAt?: string;
  [k: string]: unknown;
};

type GroupPayload = {
  id?: string | number;
  name?: string;
  eventSlug?: string;
  ownerEmail?: string;
  [k: string]: unknown;
};

type MessagePayload = {
  id: number;
  conversationId: number;
  senderEmail?: string;
  content?: string;
  createdAt?: string;
  [k: string]: unknown;
};

export function useRealtime(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const url = "/api/realtime/stream";
    const es = new EventSource(url);

    const onCreated = (ev: MessageEvent) => {
      try { const p = JSON.parse(ev.data); handlersRef.current.onJoinRequestCreated?.(p); } catch {}
    };
    const onUpdated = (ev: MessageEvent) => {
      try { const p = JSON.parse(ev.data); handlersRef.current.onJoinRequestUpdated?.(p); } catch {}
    };
    const onGroup = (ev: MessageEvent) => {
      try { const p = JSON.parse(ev.data); handlersRef.current.onGroupCreated?.(p); } catch {}
    };
    const onMessage = (ev: MessageEvent) => {
      try { const p = JSON.parse(ev.data); handlersRef.current.onMessageCreated?.(p); } catch {}
    };

    es.addEventListener("joinRequest:created", onCreated);
    es.addEventListener("joinRequest:updated", onUpdated);
    es.addEventListener("group:created", onGroup);
    es.addEventListener("message:created", onMessage);

    es.onerror = () => { /* auto-reconnect is handled by browser */ };

    return () => {
      es.removeEventListener("joinRequest:created", onCreated);
      es.removeEventListener("joinRequest:updated", onUpdated);
  es.removeEventListener("group:created", onGroup);
  es.removeEventListener("message:created", onMessage);
      es.close();
    };
  }, []);
}
