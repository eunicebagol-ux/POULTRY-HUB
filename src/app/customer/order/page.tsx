import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getEggPriceCatalog } from "@/actions/customer-orders";
import { getOfficialGcashSettings } from "@/actions/settings";
import { getActiveBankTransferAccounts } from "@/actions/bank-transfer-accounts";
import { getLatestCustomerOrderNotification } from "@/actions/customer-order-notifications";
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

  // ── Fetch product catalog, official GCash settings, bank accounts & notifications concurrently
  const [catalogResult, gcashResult, bankAccountsResult, notificationResult] =
    await Promise.all([
      getEggPriceCatalog(),
      getOfficialGcashSettings(),
      getActiveBankTransferAccounts(),
      getLatestCustomerOrderNotification(),
    ]);

  return (
    <OrderPageClient
      catalog={catalogResult.success ? (catalogResult.data ?? []) : []}
      catalogError={catalogResult.success ? null : catalogResult.error}
      officialGcashSettings={gcashResult.success ? gcashResult.data : undefined}
      activeBankAccounts={
        bankAccountsResult.success ? (bankAccountsResult.data ?? []) : []
      }
      initialNotification={
        notificationResult.success ? notificationResult.data : null
      }
    />
  );
}
