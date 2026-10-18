import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getEggPriceCatalog } from "@/actions/customer-orders";
import { OrderPageClient } from "./order-page-client";

export const metadata = {
  title: "Place an Order — POULTRY HUB Customer Portal",
  description:
    "Browse available egg sizes and submit a purchase request for farm delivery or pickup.",
};

export default async function CustomerOrderPage() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    redirect("/customer/dashboard");
  }

  if (profile.role !== "CUSTOMER") {
    // ADMIN and STAFF use the internal /egg-sales workflow
    redirect("/egg-sales");
  }

  // ── Fetch product catalog ───────────────────────────────────────────────────
  const catalogResult = await getEggPriceCatalog();

  return (
    <OrderPageClient
      catalog={catalogResult.success ? (catalogResult.data ?? []) : []}
      catalogError={catalogResult.success ? null : catalogResult.error}
    />
  );
}
