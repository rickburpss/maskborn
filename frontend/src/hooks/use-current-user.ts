"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

type CurrentUser = {
  id: string;
  role: "USER" | "ADMIN";
  displayName: string | null;
  avatarUrl: string | null;
  socialAccounts: Array<{ provider: "X_MANUAL" | "DISCORD"; username: string; verificationState: string }>;
  wallets: Array<{ id: string; chain: "EVM" | "SOLANA"; address: string; isPrimary: boolean }>;
};

export function useCurrentUser() {
  return useQuery({
    queryKey: ["session"],
    queryFn: () => apiFetch<{ user: CurrentUser }>("/session"),
    retry: false,
    staleTime: 60_000,
  });
}
