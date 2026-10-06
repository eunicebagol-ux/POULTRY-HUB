import { Users } from "lucide-react";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export default function CustomersPage() {
  return (
    <ModulePlaceholder
      title="Customer Directory"
      description="Manage egg buyer directory, contact info, and customer purchase history."
      icon={Users}
      capabilities={[
        "Customer Directory Management (Create, Edit, Status)",
        "Contact Person & Phone Number Directory",
        "Customer Purchase History & Invoicing",
        "Wholesale & Retail Buyer Categorization",
        "Active Customer Status Control",
        "Exportable Buyer Directory",
      ]}
    />
  );
}
