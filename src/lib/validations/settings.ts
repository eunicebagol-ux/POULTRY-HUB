import { z } from "zod";

export const updateSettingsSchema = z.object({
  farm_name: z.string().min(2, "Farm name must be at least 2 characters."),
  currency_code: z.string().min(1, "Currency code is required."),
  currency_symbol: z.string().min(1, "Currency symbol is required."),
  default_tray_capacity: z.number().int().positive("Tray capacity must be positive."),
  timezone: z.string().min(1, "Timezone is required."),
  date_format: z.string().min(1, "Date format is required."),
  low_feed_threshold_kg: z.number().nonnegative("Threshold cannot be negative."),
  low_egg_inventory_threshold_pieces: z.number().int().nonnegative("Threshold cannot be negative."),
  gcash_account_name: z
    .string()
    .trim()
    .max(150, "GCash account name must be at most 150 characters.")
    .optional()
    .or(z.literal("")),
  gcash_account_number: z
    .string()
    .trim()
    .max(25, "GCash number must be at most 25 characters.")
    .refine(
      (val) => {
        if (!val) return true;
        const clean = val.replace(/[\s-]/g, "");
        return /^(09|\+639)\d{9}$/.test(clean);
      },
      { message: "GCash number must be a valid 11-digit mobile number (e.g., 09171234567)." }
    )
    .optional()
    .or(z.literal("")),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
