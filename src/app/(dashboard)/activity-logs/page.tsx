import { History, ShieldAlert } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function ActivityLogsPage() {
  const profile = await getCurrentUserProfile();

  if (profile?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-4">
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 mb-2">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-base font-bold text-foreground">Access Restricted</CardTitle>
            <CardDescription className="text-xs">
              Viewing system audit activity logs requires the ADMIN role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }), "bg-slate-900 text-white hover:bg-slate-800")}
            >
              Return to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ModulePlaceholder
      title="Activity Logs & Audit Trail"
      description="Inspect system-wide audit entries for all production, sales, inventory, and administrative actions."
      icon={History}
      adminOnly
      capabilities={[
        "Immutable Audit Trail Viewer (Append-Only PostgreSQL Table)",
        "Actor ID, Action, Entity Table & Timestamp Inspector",
        "Action Metadata JSON Payload Viewer",
        "Date & Actor Filtering Controls",
        "Full Security Audit Verification",
      ]}
    />
  );
}
