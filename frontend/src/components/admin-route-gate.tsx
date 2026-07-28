"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { apiFetch } from "@/lib/api";

const AdminDashboard = dynamic(
  () => import("@/components/admin-dashboard").then((module) => module.AdminDashboard),
  {
    ssr: false,
    loading: () => <AdminGateState message="Opening the control room…" />,
  },
);

function AdminGateState({ message }: { message: string }) {
  return (
    <main className="admin-access-gate" aria-live="polite">
      <div><span>MBO</span><p>{message}</p></div>
    </main>
  );
}

export function AdminRouteGate() {
  const router = useRouter();
  const access = useQuery({
    queryKey: ["mboadmin", "access"],
    queryFn: () => apiFetch<{ authorized: true }>("/mboadmin/access"),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const status = (access.error as Error & { status?: number } | null)?.status;
  const unauthorized = status === 401 || status === 403;

  useEffect(() => {
    if (unauthorized) router.replace("/");
  }, [router, unauthorized]);

  if (access.isPending || access.isFetching || unauthorized) {
    return <AdminGateState message={unauthorized ? "Returning to Mask Born Order…" : "Verifying administrator access…"} />;
  }
  if (access.isError) {
    return <AdminGateState message="Administrator access could not be verified. Try again shortly." />;
  }
  return <AdminDashboard />;
}
