import { ShoppingCart } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function EggSalesPage() {
  return (
    <ModulePlaceholder
      title="Egg Sales & Invoicing"
      description="Record egg sales, issue sales invoices, and deduct egg inventory atomically via RPC."
      icon={ShoppingCart}
      capabilities={[
        "Atomic Sales Invoice Creation via `record_egg_sale()` RPC",
        "Server-Side Packaging Multipliers (Piece, Tray, Carton, Box)",
        "PostgreSQL Server-Calculated Line & Grand Totals",
        "Automatic Egg Inventory Deduction with FOR UPDATE Locks",
        "Discount Validation & Revenue Calculation",
        "Invoice Print & Export Formatting",
      ]}
    />
  );
}
