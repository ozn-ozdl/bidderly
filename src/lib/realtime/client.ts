"use client";

import { io, type Socket } from "socket.io-client";

export type ApprovalStatus = "pending" | "approved" | "needs_info";

export type UserState = {
  approvals: Array<{
    findingId: string;
    status: ApprovalStatus;
    note: string | null;
    updatedAt: string;
  }>;
  watchlist: Array<{ findingId: string; addedAt: string }>;
  dismissals: Array<{ findingId: string; dismissedAt: string }>;
  read: Array<{ findingId: string; readAt: string }>;
};

export type StatePatch =
  | {
      kind: "approval";
      findingId: string;
      status: ApprovalStatus;
      note: string | null;
      updatedAt: string;
    }
  | { kind: "watchlist"; findingId: string; added: boolean; at: string }
  | { kind: "dismissal"; findingId: string; dismissed: boolean; at: string }
  | { kind: "read"; findingId: string; at: string }
  | { kind: "reset" };

const REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL;

type TokenFetcher = () => Promise<string | null | undefined>;

let socket: Socket | null = null;
let activeTokenFetcher: TokenFetcher | null = null;

export function isRealtimeConfigured(): boolean {
  return Boolean(REALTIME_URL);
}

export function getRealtimeSocket(tokenFetcher: TokenFetcher): Socket | null {
  if (!REALTIME_URL) return null;

  if (!socket) {
    socket = io(REALTIME_URL, {
      path: "/socket.io",
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      auth: async (cb: (data: { token?: string }) => void) => {
        const token = activeTokenFetcher ? await activeTokenFetcher() : undefined;
        cb(token ? { token } : {});
      },
    });

    socket.on("connect", () => {
      socket?.emit("client:hello", { at: Date.now() });
    });
  }

  activeTokenFetcher = tokenFetcher;
  return socket;
}

export function disconnectRealtimeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  activeTokenFetcher = null;
}
