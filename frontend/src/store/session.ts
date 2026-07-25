"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  twitter: string | null;
  wallet: string | null;
  connectTwitter: (twitter: string) => void;
  setWallet: (wallet: string) => void;
  disconnect: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      twitter: null,
      wallet: null,
      connectTwitter: (twitter) => set({ twitter }),
      setWallet: (wallet) => set({ wallet }),
      disconnect: () => set({ twitter: null, wallet: null }),
    }),
    { name: "maskborn-session-demo" },
  ),
);
