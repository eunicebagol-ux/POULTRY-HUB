import { AlertTriangle, UserX } from "lucide-react";

interface ProfilePendingBannerProps {
  isInactive?: boolean;
}

/**
 * POULTRY HUB — Profile Pending Banner
 *
 * Non-blocking informational banner displayed inside the dashboard shell
 * when the authenticated Clerk user's Supabase profile has not yet been
 * provisioned (webhook pending) or has been deactivated by an admin.
 *
 * This banner does NOT block the dashboard UI — it sits above the page
 * content so the user can still see the real layout with honest empty states.
 */
export function ProfilePendingBanner({ isInactive = false }: ProfilePendingBannerProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50/80 dark:bg-amber-950/30 px-4 py-3 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-400 mt-0.5">
          {isInactive ? (
            <UserX className="size-4" />
          ) : (
            <AlertTriangle className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {isInactive ? "Account Deactivated" : "Profile Setup Pending"}
          </p>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/70 mt-0.5 leading-relaxed">
            {isInactive
              ? "Your POULTRY HUB staff profile has been deactivated by an administrator. You can view the dashboard but operational actions are disabled. Contact your farm system administrator to reactivate your account."
              : "Your POULTRY HUB staff profile is being set up. Dashboard data will appear once your profile is provisioned through the system. Operational actions such as recording production, sales, and inventory changes will become available after activation."}
          </p>
        </div>
      </div>
    </div>
  );
}
