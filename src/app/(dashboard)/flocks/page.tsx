import { Layers } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function FlocksPage() {
  return (
    <ModulePlaceholder
      title="Flock Management"
      description="Track laying hen batches, monitor bird count updates, and log mortality and culling events."
      icon={Layers}
      capabilities={[
        "Flock Batch Creation & Status Tracking (Active, Retired)",
        "Bird Count Integrity Enforcement",
        "Mortality Event Logging via RPC",
        "Culling Event Logging via RPC",
        "Compensating Reversal Entries for Ledger Errors",
        "Flock Performance Analytics",
      ]}
    />
  );
}
