"use client";

import { createContext, useContext, type ReactNode } from "react";

import {
  EMPTY_USER_STATE_RESULT,
  type UserStateResult,
  useUserStateConnection,
} from "@/lib/realtime/use-user-state";

const UserStateContext = createContext<UserStateResult>(EMPTY_USER_STATE_RESULT);

export function UserStateProvider({ children }: { children: ReactNode }) {
  const value = useUserStateConnection();

  return (
    <UserStateContext.Provider value={value}>{children}</UserStateContext.Provider>
  );
}

export function useUserState(): UserStateResult {
  return useContext(UserStateContext);
}
