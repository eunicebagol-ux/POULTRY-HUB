import { UtensilsCrossed } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function FeedConsumptionPage() {
  return (
    <ModulePlaceholder
      title="Feed Consumption"
      description="Record daily flock feed usage and analyze Feed Conversion Ratio (FCR)."
      icon={UtensilsCrossed}
      capabilities={[
        "Daily Flock Feeding Log Entry via Atomic RPC",
        "Automatic Feed Inventory Stock Deduction",
        "Flock-Specific Feed Intake Tracking",
        "Feed Conversion Ratio (FCR) Efficiency Calculation",
        "Feed Type Usage Breakdown",
        "Consumption Ledger Audit",
      ]}
    />
  );
}
