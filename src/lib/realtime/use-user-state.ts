"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import {
  type StatePatch,
  type UserState,
  getRealtimeSocket,
  isRealtimeConfigured,
} from "./client";

const EMPTY_STATE: UserState = {
  approvals: [],
  watchlist: [],
  dismissals: [],
  read: [],
};

export type UserStateActions = {
  setApproval: (findingId: string, status: UserState["approvals"][number]["status"]) => void;
  toggleWatch: (findingId: string, add?: boolean) => void;
  setDismissed: (findingId: string, dismissed?: boolean) => void;
  markRead: (findingId: string) => void;
  resetApprovals: () => void;
};

export type UserStateResult = {
  ready: boolean;
  connected: boolean;
  state: UserState;
  actions: UserStateActions;
};

const NOOP_ACTIONS: UserStateActions = {
  setApproval: () => undefined,
  toggleWatch: () => undefined,
  setDismissed: () => undefined,
  markRead: () => undefined,
  resetApprovals: () => undefined,
};

export const EMPTY_USER_STATE_RESULT: UserStateResult = {
  ready: false,
  connected: false,
  state: EMPTY_STATE,
  actions: NOOP_ACTIONS,
};

function applyPatch(state: UserState, patch: StatePatch): UserState {
  switch (patch.kind) {
    case "reset":
      return EMPTY_STATE;
    case "approval": {
      const others = state.approvals.filter((a) => a.findingId !== patch.findingId);
      return {
        ...state,
        approvals: [
          ...others,
          {
            findingId: patch.findingId,
            status: patch.status,
            note: patch.note,
            updatedAt: patch.updatedAt,
          },
        ],
      };
    }
    case "watchlist": {
      const others = state.watchlist.filter((w) => w.findingId !== patch.findingId);
      return {
        ...state,
        watchlist: patch.added
          ? [...others, { findingId: patch.findingId, addedAt: patch.at }]
          : others,
      };
    }
    case "dismissal": {
      const others = state.dismissals.filter((d) => d.findingId !== patch.findingId);
      return {
        ...state,
        dismissals: patch.dismissed
          ? [...others, { findingId: patch.findingId, dismissedAt: patch.at }]
          : others,
      };
    }
    case "read": {
      const others = state.read.filter((r) => r.findingId !== patch.findingId);
      return {
        ...state,
        read: [...others, { findingId: patch.findingId, readAt: patch.at }],
      };
    }
  }
}

export function useUserStateConnection(): UserStateResult {
  const { isSignedIn, getToken } = useAuth();
  const configured = isRealtimeConfigured();
  const active = configured && Boolean(isSignedIn);

  const [state, setState] = useState<UserState>(EMPTY_STATE);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!active) return;

    const socket = getRealtimeSocket(async () => {
      try {
        return await getToken();
      } catch {
        return null;
      }
    });
    if (!socket) return;

    const onSnapshot = (next: UserState) => setState(next ?? EMPTY_STATE);
    const onPatch = (patch: StatePatch) => setState((s) => applyPatch(s, patch));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setState(EMPTY_STATE);
    };

    socket.on("state:snapshot", onSnapshot);
    socket.on("state:patch", onPatch);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    socket.connect();

    return () => {
      socket.off("state:snapshot", onSnapshot);
      socket.off("state:patch", onPatch);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.disconnect();
    };
  }, [active, getToken]);

  const actions = useMemo<UserStateActions>(() => {
    if (!active) return NOOP_ACTIONS;

    const emit = (event: string, payload: unknown) => {
      const socket = getRealtimeSocket(async () => {
        try {
          return await getToken();
        } catch {
          return null;
        }
      });
      socket?.emit(event, payload);
    };
    return {
      setApproval: (findingId, status) => emit("approval:set", { findingId, status }),
      toggleWatch: (findingId, add = true) =>
        emit(add ? "watchlist:add" : "watchlist:remove", { findingId }),
      setDismissed: (findingId, dismissed = true) =>
        emit("dismissal:set", { findingId, dismissed }),
      markRead: (findingId) => emit("read:mark", { findingId }),
      resetApprovals: () => {
        setState((current) => ({ ...current, approvals: [] }));
        emit("approvals:reset", {});
      },
    };
  }, [active, getToken]);

  return {
    ready: active ? connected : false,
    connected: active ? connected : false,
    state: active ? state : EMPTY_STATE,
    actions,
  };
}
