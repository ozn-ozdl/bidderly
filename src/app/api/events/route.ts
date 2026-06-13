import { getLatestRadarSnapshot } from "@/lib/db";
import { getLiveEventSequence } from "@/lib/demo-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();
  const snapshot = await getLatestRadarSnapshot();
  const events = snapshot?.events ?? getLiveEventSequence();
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      let index = 0;

      const send = () => {
        const event = events[index];

        if (!event) {
          controller.enqueue(
            encoder.encode(
              `event: complete\ndata: ${JSON.stringify({ ok: true })}\n\n`,
            ),
          );
          controller.close();

          if (interval) {
            clearInterval(interval);
          }

          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
        index += 1;
      };

      send();
      interval = setInterval(send, 900);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
