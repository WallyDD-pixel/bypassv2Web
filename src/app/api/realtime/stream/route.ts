export const runtime = "nodejs";
import { NextRequest } from "next/server";
import { bus } from "@/lib/events";

export async function GET(_req: NextRequest) {
  const encoder = new TextEncoder();
  let doCleanup: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(chunk));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      const send = (event: string, data: any) => {
        const payload = `event: ${event}\n` + `data: ${JSON.stringify(data)}\n\n`;
        safeEnqueue(payload);
      };

  const onCreated = (p: any) => send("joinRequest:created", p);
  const onUpdated = (p: any) => send("joinRequest:updated", p);
  const onGroup = (p: any) => send("group:created", p);
  const onMessage = (p: any) => send("message:created", p);

      bus.on("joinRequest:created", onCreated);
      bus.on("joinRequest:updated", onUpdated);
  bus.on("group:created", onGroup);
  bus.on("message:created", onMessage);

      // heartbeat to keep connection alive
      const hb = setInterval(() => {
        safeEnqueue(":\n\n");
      }, 25000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        try { clearInterval(hb); } catch {}
        try { bus.off("joinRequest:created", onCreated); } catch {}
        try { bus.off("joinRequest:updated", onUpdated); } catch {}
  try { bus.off("group:created", onGroup); } catch {}
  try { bus.off("message:created", onMessage); } catch {}
        try { controller.close(); } catch {}
      };
      doCleanup = cleanup;

      // send initial comment
      safeEnqueue(": connected\n\n");
    },
    cancel() {
      try { doCleanup?.(); } catch {}
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
