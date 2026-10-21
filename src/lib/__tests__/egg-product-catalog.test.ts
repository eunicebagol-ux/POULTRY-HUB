import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  EGG_SIZES,
  EGG_SIZE_LABELS,
  EGG_PRODUCT_IMAGES,
  EGG_PRODUCT_ALT_TEXTS,
} from "../constants";
import type { EggSize } from "@/types";

describe("Egg Product Images & Catalog Configuration", () => {
  const publicDir = path.resolve(process.cwd(), "public");

  it("defines an image asset for all 6 official egg grades", () => {
    expect(EGG_SIZES).toHaveLength(6);

    for (const size of EGG_SIZES) {
      const imagePath = EGG_PRODUCT_IMAGES[size];
      expect(imagePath).toBeDefined();
      expect(typeof imagePath).toBe("string");
      expect(imagePath).toMatch(/^\/images\/products\/egg-tray-[a-z-]+\.(jpg|jpeg|png|webp|svg)$/);
    }
  });

  it("verifies that all mapped product image files exist on disk", () => {
    for (const size of EGG_SIZES) {
      const relativeUrl = EGG_PRODUCT_IMAGES[size];
      // Strip leading '/' to resolve inside public directory
      const diskPath = path.join(publicDir, relativeUrl.replace(/^\//, ""));
      expect(fs.existsSync(diskPath)).toBe(true);

      const stats = fs.statSync(diskPath);
      expect(stats.isFile()).toBe(true);
      expect(stats.size).toBeGreaterThan(1000); // Non-empty image file
    }
  });

  it("defines accessible and informative alt text for all 6 egg grades", () => {
    for (const size of EGG_SIZES) {
      const altText = EGG_PRODUCT_ALT_TEXTS[size];
      expect(altText).toBeDefined();
      expect(typeof altText).toBe("string");
      expect(altText.length).toBeGreaterThan(15);
      expect(altText.toLowerCase()).toContain("tray");
    }
  });

  it("covers specific expected products: Small, Medium, Large, Extra Large, Jumbo, Ungraded", () => {
    const expectedSizes: EggSize[] = [
      "SMALL",
      "MEDIUM",
      "LARGE",
      "EXTRA_LARGE",
      "JUMBO",
      "UNGRADED",
    ];

    for (const size of expectedSizes) {
      expect(EGG_SIZE_LABELS[size]).toBeDefined();
      expect(EGG_PRODUCT_IMAGES[size]).toBeDefined();
      expect(EGG_PRODUCT_ALT_TEXTS[size]).toBeDefined();
    }
  });
});
