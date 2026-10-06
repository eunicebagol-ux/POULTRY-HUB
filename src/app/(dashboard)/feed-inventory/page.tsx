import { Wheat } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function FeedInventoryPage() {
  return (
    <ModulePlaceholder
      title="Feed Inventory"
      description="Manage feed stock levels (in kg), receive new feed shipments, and track unit costs."
      icon={Wheat}
      capabilities={[
        "Feed Stock Level Monitoring in Kilograms (kg)",
        "Feed Intake Stock Received Logging (Admin RPC)",
        "Automatic Expense Recording for Purchased Feed",
        "Reorder Level Threshold Alerts",
        "Feed Type Catalog Management",
        "Immutable Feed Inventory Ledger",
      ]}
    />
  );
}
