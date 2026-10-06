import { Wheat } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  getFeedInventory,
  getFeedTransactions,
  getActiveSuppliers,
} from "@/actions/feed-inventory";
import { InventoryTable } from "@/components/feed-inventory/inventory-table";
import { TransactionLedger } from "@/components/feed-inventory/transaction-ledger";
import { ReceiveStockDialog } from "@/components/feed-inventory/receive-stock-dialog";

export const metadata = {
  title: "Feed Inventory — POULTRY HUB",
  description: "Monitor feed stock levels and record feed stock deliveries.",
};

export default async function FeedInventoryPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <Wheat className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Feed Inventory</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  const [invResult, txResult, supResult] = await Promise.all([
    getFeedInventory(),
    getFeedTransactions(100),
    getActiveSuppliers(),
  ]);

  const inventory = invResult.success ? (invResult.data ?? []) : [];
  const transactions = txResult.success ? (txResult.data ?? []) : [];
  const suppliers = supResult.success ? (supResult.data ?? []) : [];

  const existingFeedTypes = inventory.map(i => i.feed_type);
  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <Wheat className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">Feed Inventory</h1>
        </div>
        {isAdmin && (
          <ReceiveStockDialog
            existingFeedTypes={existingFeedTypes}
            suppliers={suppliers}
            isAdmin={isAdmin}
          />
        )}
      </div>

      <InventoryTable inventory={inventory} />

      <div className="pt-4">
        <TransactionLedger transactions={transactions} />
      </div>
    </div>
  );
}
