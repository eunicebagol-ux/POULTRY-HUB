import { describe, it, expect } from "vitest";
import { updateSettingsSchema } from "../validations/settings";

describe("Settings Schema & Official GCash Configuration", () => {
  const baseValidSettings = {
    farm_name: "POULTRY HUB Farm",
    currency_code: "PHP",
    currency_symbol: "₱",
    default_tray_capacity: 30,
    timezone: "Asia/Manila",
    date_format: "YYYY-MM-DD",
    low_feed_threshold_kg: 50,
    low_egg_inventory_threshold_pieces: 300,
  };

  it("accepts valid settings with official GCash account details configured", () => {
    const withGcash = {
      ...baseValidSettings,
      gcash_account_name: "POULTRY HUB Farm Official",
      gcash_account_number: "09171234567",
    };

    const result = updateSettingsSchema.safeParse(withGcash);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gcash_account_name).toBe("POULTRY HUB Farm Official");
      expect(result.data.gcash_account_number).toBe("09171234567");
    }
  });

  it("accepts valid settings with +63 format GCash number", () => {
    const withPlus63 = {
      ...baseValidSettings,
      gcash_account_name: "Farm Administrator",
      gcash_account_number: "+639181234567",
    };

    const result = updateSettingsSchema.safeParse(withPlus63);
    expect(result.success).toBe(true);
  });

  it("accepts settings when GCash receiving details are empty (unconfigured)", () => {
    const unconfigured = {
      ...baseValidSettings,
      gcash_account_name: "",
      gcash_account_number: "",
    };

    const result = updateSettingsSchema.safeParse(unconfigured);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gcash_account_name).toBe("");
      expect(result.data.gcash_account_number).toBe("");
    }
  });

  it("accepts settings when GCash receiving fields are omitted (defaults to undefined/empty)", () => {
    const result = updateSettingsSchema.safeParse(baseValidSettings);
    expect(result.success).toBe(true);
  });

  it("rejects settings when GCash number is invalid format", () => {
    const invalidNumber = {
      ...baseValidSettings,
      gcash_account_name: "Farm Official",
      gcash_account_number: "0912", // too short
    };

    const result = updateSettingsSchema.safeParse(invalidNumber);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.includes("gcash_account_number"))
      ).toBe(true);
    }
  });

  it("rejects settings when GCash number contains non-phone characters", () => {
    const invalidChars = {
      ...baseValidSettings,
      gcash_account_name: "Farm Official",
      gcash_account_number: "0917-ABC-DEFG",
    };

    const result = updateSettingsSchema.safeParse(invalidChars);
    expect(result.success).toBe(false);
  });
});
