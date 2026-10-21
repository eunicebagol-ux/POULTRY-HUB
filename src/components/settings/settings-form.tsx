"use client";

import { useTransition, useRef } from "react";
import { toast } from "sonner";
import { Settings, Smartphone } from "lucide-react";
import { type UpdateSettingsInput } from "@/lib/validations/settings";
import { updateSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettingsFormProps {
  initialData: UpdateSettingsInput;
}

export function SettingsForm({ initialData }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;
    
    const formData = new FormData(formRef.current);
    
    // Using string casts based on select/input elements
    const data: UpdateSettingsInput = {
      farm_name: formData.get("farm_name") as string,
      currency_code: formData.get("currency_code") as string,
      currency_symbol: formData.get("currency_symbol") as string,
      default_tray_capacity: parseInt(formData.get("default_tray_capacity") as string, 10) || 0,
      timezone: formData.get("timezone") as string,
      date_format: formData.get("date_format") as string,
      low_feed_threshold_kg: parseFloat(formData.get("low_feed_threshold_kg") as string) || 0,
      low_egg_inventory_threshold_pieces: parseInt(formData.get("low_egg_inventory_threshold_pieces") as string, 10) || 0,
      gcash_account_name: (formData.get("gcash_account_name") as string)?.trim() || "",
      gcash_account_number: (formData.get("gcash_account_number") as string)?.trim() || "",
    };

    startTransition(async () => {
      const result = await updateSettings(data);
      if (result.success) {
        toast.success("Settings updated successfully");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure farm identity, default capacities, currency, and thresholds.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>General Identity</CardTitle>
              <CardDescription>
                Basic information about the farm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farm_name">Farm Name</Label>
                <Input id="farm_name" name="farm_name" defaultValue={initialData.farm_name} />
                <p className="text-xs text-muted-foreground">Display name shown in reports and UI headers.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Localization</CardTitle>
              <CardDescription>
                Currency, timezone, and date formats.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currency_code">Currency Code</Label>
                  <Select name="currency_code" defaultValue={initialData.currency_code}>
                    <SelectTrigger id="currency_code">
                      <SelectValue placeholder="Select code" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PHP">PHP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency_symbol">Currency Symbol</Label>
                  <Input id="currency_symbol" name="currency_symbol" defaultValue={initialData.currency_symbol} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select name="timezone" defaultValue={initialData.timezone}>
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Manila">Asia/Manila</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date_format">Date Format</Label>
                  <Select name="date_format" defaultValue={initialData.date_format}>
                    <SelectTrigger id="date_format">
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Inventory & Production</CardTitle>
              <CardDescription>
                Defaults for trays and alert thresholds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="default_tray_capacity">Default Tray Capacity (pieces)</Label>
                <Input
                  id="default_tray_capacity"
                  name="default_tray_capacity"
                  type="number"
                  defaultValue={initialData.default_tray_capacity}
                />
                <p className="text-xs text-muted-foreground">Number of eggs per standard tray.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_feed_threshold_kg">Low Feed Threshold (kg)</Label>
                <Input
                  id="low_feed_threshold_kg"
                  name="low_feed_threshold_kg"
                  type="number"
                  step="0.1"
                  defaultValue={initialData.low_feed_threshold_kg}
                />
                <p className="text-xs text-muted-foreground">Feed stock level below which a low-stock alert is triggered.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="low_egg_inventory_threshold_pieces">Low Egg Inventory Threshold (pieces)</Label>
                <Input
                  id="low_egg_inventory_threshold_pieces"
                  name="low_egg_inventory_threshold_pieces"
                  type="number"
                  defaultValue={initialData.low_egg_inventory_threshold_pieces}
                />
                <p className="text-xs text-muted-foreground">Egg inventory level below which a low-stock alert is triggered.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="size-5 text-blue-500" />
                Official GCash Receiving Account
              </CardTitle>
              <CardDescription>
                Configure the farm&apos;s official GCash receiving details displayed to customers during checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="gcash_account_name">Official GCash Account Name</Label>
                <Input
                  id="gcash_account_name"
                  name="gcash_account_name"
                  defaultValue={initialData.gcash_account_name}
                  placeholder="e.g. POULTRY HUB FARM / Juan Dela Cruz"
                  maxLength={150}
                />
                <p className="text-xs text-muted-foreground">
                  The verified GCash account name registered for the farm.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gcash_account_number">Official GCash Receiving Number</Label>
                <Input
                  id="gcash_account_number"
                  name="gcash_account_number"
                  defaultValue={initialData.gcash_account_number}
                  placeholder="09XXXXXXXXX (11 digits)"
                  maxLength={25}
                />
                <p className="text-xs text-muted-foreground">
                  The farm&apos;s GCash mobile number where customers will send their payments.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            <Settings className="mr-2 size-4" />
            {isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
