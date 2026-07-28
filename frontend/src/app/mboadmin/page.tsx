import type { Metadata } from "next";
import { AdminRouteGate } from "@/components/admin-route-gate";

export const metadata: Metadata = {
  title: "MBO Control Room",
  robots: { index: false, follow: false, nocache: true },
};

export default function MboAdminPage() {
  return <AdminRouteGate />;
}
