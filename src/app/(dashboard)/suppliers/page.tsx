import { Truck } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function SuppliersPage() {
  return (
    <ModulePlaceholder
      title="Supplier Directory"
      description="Manage farm vendors, feed suppliers, medication providers, and equipment contacts."
      icon={Truck}
      capabilities={[
        "Supplier Directory & Contact Management",
        "Vendor Categorization (Feed, Meds, Packaging, Equipment)",
        "Supplier Procurement History",
        "Associated Expense Linkage",
        "Active Supplier Status Toggle",
      ]}
    />
  );
}
