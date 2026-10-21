import { UtensilsCrossed } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  getFeedConsumptionHistory,
  getActiveFlocksForFeeding,
  getAvailableFeedTypes,
} from "@/actions/feed-consumption";
import { ConsumptionTable } from "@/components/feed-consumption/consumption-table";
import { RecordConsumptionDialog } from "@/components/feed-consumption/record-consumption-dialog";

export const metadata = {
  title: "Feed Consumption — POULTRY HUB",
  description: "Record and track daily flock feed usage.",
};

export default async function FeedConsumptionPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <UtensilsCrossed className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Feed Consumption
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  const isAuthorized = profile.role === "ADMIN" || profile.role === "STAFF";

  const [historyResult, flocksResult, feedTypesResult] = await Promise.all([
    getFeedConsumptionHistory(100),
    getActiveFlocksForFeeding(),
    getAvailableFeedTypes(),
  ]);

  const history = historyResult.success ? historyResult.data ?? [] : [];
  const flocks = flocksResult.success ? flocksResult.data ?? [] : [];
  const feedTypes = feedTypesResult.success ? feedTypesResult.data ?? [] : [];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Feed Consumption
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Record daily feed consumed by active flocks. Stock is deducted automatically via atomic RPC.
          </p>
        </div>
        {isAuthorized && (
          <RecordConsumptionDialog
            flocks={flocks}
            feedTypes={feedTypes}
            isAuthorized={isAuthorized}
          />
        )}
      </div>

      <ConsumptionTable
        records={history}
        errorMessage={!historyResult.success ? historyResult.error : null}
      />
    </div>
  );
}
