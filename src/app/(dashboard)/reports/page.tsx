import { BarChart3 } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      title="Reports & Farm Analytics"
      description="Generate production trends, financial P&L statements, flock performance, and feed efficiency reports."
      icon={BarChart3}
      capabilities={[
        "Daily, Weekly & Monthly Production Summaries",
        "Farm Financial Profit & Loss (P&L) Reports",
        "Feed Conversion Ratio (FCR) Performance Reports",
        "Flock Laying Rate & Mortality Analytics",
        "Exportable PDF & Spreadsheet Reports",
      ]}
    />
  );
}
