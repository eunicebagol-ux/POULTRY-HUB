import { ShieldAlert } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import type { UpdateSettingsInput } from "@/lib/validations/settings";

export default async function SettingsPage() {
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
              System configuration settings require the ADMIN role.
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

  const supabase = await createClient();
  const { data: settingsData, error } = await supabase
    .from("system_settings")
    .select("setting_key, setting_value");

  if (error || !settingsData) {
    return (
      <div className="py-12 text-center text-red-500">
        Failed to load settings. Please try again later.
      </div>
    );
  }

  const initialData: UpdateSettingsInput = {
    farm_name: "",
    currency_code: "",
    currency_symbol: "",
    default_tray_capacity: 30,
    timezone: "",
    date_format: "",
    low_feed_threshold_kg: 0,
    low_egg_inventory_threshold_pieces: 0,
  };

  settingsData.forEach((setting) => {
    switch (setting.setting_key) {
      case "farm_name":
        initialData.farm_name = setting.setting_value as string;
        break;
      case "currency_code":
        initialData.currency_code = setting.setting_value as string;
        break;
      case "currency_symbol":
        initialData.currency_symbol = setting.setting_value as string;
        break;
      case "default_tray_capacity":
        initialData.default_tray_capacity = setting.setting_value as number;
        break;
      case "timezone":
        initialData.timezone = setting.setting_value as string;
        break;
      case "date_format":
        initialData.date_format = setting.setting_value as string;
        break;
      case "low_feed_threshold_kg":
        initialData.low_feed_threshold_kg = setting.setting_value as number;
        break;
      case "low_egg_inventory_threshold_pieces":
        initialData.low_egg_inventory_threshold_pieces = setting.setting_value as number;
        break;
    }
  });

  return (
    <div className="mx-auto max-w-4xl py-6">
      <SettingsForm initialData={initialData} />
    </div>
  );
}
