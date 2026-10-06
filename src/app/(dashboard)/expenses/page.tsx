import { Receipt } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ExpensesPage() {
  return (
    <ModulePlaceholder
      title="Farm Expenses"
      description="Record farm operating expenses, categorize costs, and link supplier receipts."
      icon={Receipt}
      capabilities={[
        "Operational Expense Entry (Feed Purchase, Meds, Utilities, Maintenance)",
        "Supplier Purchase Order Linkage",
        "Expense Category Breakdown Analytics",
        "Date Range Expense Summaries",
        "Admin Expense Management & Audit",
      ]}
    />
  );
}
