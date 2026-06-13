import cors from "@fastify/cors";
import Fastify from "fastify";
import { Server } from "socket.io";
import { WebSocket, WebSocketServer, type RawData } from "ws";

import { roomFor, verifyUser } from "./auth.js";
import {
  loadUserState,
  markRead,
  setApproval,
  setDismissed,
  toggleWatch,
  type StatePatch,
} from "./state.js";
import { handleClerkWebhook } from "./webhooks.js";
import { runMigrations } from "./migrate.js";

const port = Number(process.env.PORT ?? 4001);
const webOrigin = process.env.WEB_ORIGIN ?? "*";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

app.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
  done(null, body);
});

await app.register(cors, {
  origin: webOrigin === "*" ? true : webOrigin.split(",").map((s) => s.trim()),
  credentials: true,
});

app.get("/health", async () => ({ ok: true }));

app.get("/state", async (request, reply) => {
  const auth = request.headers.authorization;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const user = await verifyUser(token);
  if (!user) return reply.code(401).send({ error: "Unauthorized" });
  return loadUserState(user.sub);
});

app.post("/webhooks/clerk", async (request, reply) => {
  const body = typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {});
  const result = await handleClerkWebhook(request.headers, body);
  return reply.code(result.status).send({ ok: result.ok });
});

await app.ready();

const io = new Server(app.server, {
  path: "/socket.io",
  cors: {
    origin: webOrigin === "*" ? true : webOrigin.split(",").map((s) => s.trim()),
    credentials: true,
  },
});

const nativeSocketsByUser = new Map<string, Set<WebSocket>>();
const nativeWss = new WebSocketServer({ noServer: true });

io.use(async (socket, next) => {
  const token = (socket.handshake.auth?.token as string | undefined) ?? socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
  const user = await verifyUser(token);
  if (!user) return next(new Error("unauthorized"));
  socket.data.userId = user.sub;
  next();
});

io.on("connection", (socket) => {
  const userId: string = socket.data.userId;
  const room = roomFor(userId);
  socket.join(room);

  loadUserState(userId)
    .then((state) => socket.emit("state:snapshot", state))
    .catch((err) => app.log.error({ err }, "failed to load initial state"));

  socket.on("approval:set", async (payload, ack) => {
    try {
      const patch = await mutateUserState(userId, "approval:set", payload);
      if (patch) broadcastPatch(userId, patch);
      ack?.({ ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err }, "approval:set failed");
      ack?.({ ok: false, error: "internal" });
    }
  });

  socket.on("watchlist:add", async (payload, ack) => {
    try {
      const patch = await mutateUserState(userId, "watchlist:add", payload);
      if (patch) broadcastPatch(userId, patch);
      ack?.({ ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err }, "watchlist:add failed");
      ack?.({ ok: false, error: "invalid" });
    }
  });

  socket.on("watchlist:remove", async (payload, ack) => {
    try {
      const patch = await mutateUserState(userId, "watchlist:remove", payload);
      if (patch) broadcastPatch(userId, patch);
      ack?.({ ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err }, "watchlist:remove failed");
      ack?.({ ok: false, error: "invalid" });
    }
  });

  socket.on("dismissal:set", async (payload, ack) => {
    try {
      const patch = await mutateUserState(userId, "dismissal:set", payload);
      if (patch) broadcastPatch(userId, patch);
      ack?.({ ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err }, "dismissal:set failed");
      ack?.({ ok: false, error: "invalid" });
    }
  });

  socket.on("read:mark", async (payload, ack) => {
    try {
      const patch = await mutateUserState(userId, "read:mark", payload);
      if (patch) broadcastPatch(userId, patch);
      ack?.({ ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err }, "read:mark failed");
      ack?.({ ok: false, error: "invalid" });
    }
  });
});

app.server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  if (url.pathname !== "/ws") return;

  nativeWss.handleUpgrade(request, socket, head, (ws) => {
    nativeWss.emit("connection", ws, request);
  });
});

nativeWss.on("connection", (ws) => {
  let userId: string | null = null;

  ws.on("message", async (data) => {
    const message = parseMessage(data);
    if (!message) {
      sendNative(ws, { type: "error", error: "invalid_json" });
      return;
    }

    if (!userId) {
      if (message.type !== "auth" || typeof message.token !== "string") {
        sendNative(ws, { type: "error", error: "unauthorized" });
        ws.close(1008, "unauthorized");
        return;
      }

      const user = await verifyUser(message.token);
      if (!user) {
        sendNative(ws, { type: "error", error: "unauthorized" });
        ws.close(1008, "unauthorized");
        return;
      }

      userId = user.sub;
      addNativeSocket(userId, ws);

      try {
        sendNative(ws, { type: "state:snapshot", state: await loadUserState(userId) });
      } catch (err) {
        app.log.error({ err }, "failed to load native initial state");
        sendNative(ws, { type: "error", error: "state_load_failed" });
      }
      return;
    }

    if (typeof message.type !== "string") {
      sendNative(ws, { type: "ack", id: message.id, ok: false, error: "invalid_type" });
      return;
    }

    try {
      const patch = await mutateUserState(userId, message.type, message.payload);
      if (patch) broadcastPatch(userId, patch);
      if (message.id) sendNative(ws, { type: "ack", id: message.id, ok: Boolean(patch) });
    } catch (err) {
      app.log.error({ err, type: message.type }, "native state mutation failed");
      sendNative(ws, { type: "ack", id: message.id, ok: false, error: "invalid" });
    }
  });

  ws.on("close", () => {
    if (userId) removeNativeSocket(userId, ws);
  });
});

async function mutateUserState(
  userId: string,
  type: string,
  payload: unknown,
): Promise<StatePatch | null> {
  switch (type) {
    case "approval:set":
      return setApproval(userId, payload);
    case "watchlist:add":
      return toggleWatch(userId, payload, true);
    case "watchlist:remove":
      return toggleWatch(userId, payload, false);
    case "dismissal:set":
      return setDismissed(userId, payload);
    case "read:mark":
      return markRead(userId, payload);
    default:
      return null;
  }
}

function broadcastPatch(userId: string, patch: StatePatch): void {
  io.to(roomFor(userId)).emit("state:patch", patch);
  for (const ws of nativeSocketsByUser.get(userId) ?? []) {
    sendNative(ws, { type: "state:patch", patch });
  }
}

function addNativeSocket(userId: string, ws: WebSocket): void {
  const sockets = nativeSocketsByUser.get(userId) ?? new Set<WebSocket>();
  sockets.add(ws);
  nativeSocketsByUser.set(userId, sockets);
}

function removeNativeSocket(userId: string, ws: WebSocket): void {
  const sockets = nativeSocketsByUser.get(userId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) nativeSocketsByUser.delete(userId);
}

function parseMessage(data: RawData): Record<string, unknown> | null {
  try {
    const raw = Array.isArray(data)
      ? Buffer.concat(data).toString("utf8")
      : data instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(data)).toString("utf8")
        : Buffer.from(data).toString("utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sendNative(ws: WebSocket, message: unknown): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(message));
}

if (process.env.DB_AUTO_INIT !== "false") {
  await runMigrations();
}

app.server.listen(port, "0.0.0.0", () => {
  app.log.info(`realtime server listening on :${port}`);
});
