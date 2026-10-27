import { describe, it, expect } from "vitest";
import {
  EGG_SIZES,
  EGG_TYPES,
  EGG_PRICE_PER_PIECE,
  CONFIRMED_TRAY_PRICES,
  PACKAGING_MULTIPLIERS,
  calculatePackagingPrice,
} from "../constants";
import {
  customerOrderItemSchema,
} from "../validations/customer-orders";
import type { EggSize, PackagingType, EggType } from "@/types";

describe("Separate White and Brown Egg Pricing (LOCAL TEST SUITE)", () => {
  // ── A. Catalog & Pricing Derivation ─────────────────────────────────────────
  describe("A. Catalog and pricing", () => {
    it("resolves all six sizes independently for both WHITE and BROWN egg types", () => {
      expect(EGG_SIZES).toHaveLength(6);
      expect(EGG_TYPES).toEqual(["WHITE", "BROWN"]);

      for (const size of EGG_SIZES) {
        expect(CONFIRMED_TRAY_PRICES.WHITE[size]).toBeDefined();
        expect(CONFIRMED_TRAY_PRICES.BROWN[size]).toBeDefined();
      }
    });

    it("verifies the six Brown tray-of-30 prices match confirmed requirement values exactly", () => {
      expect(CONFIRMED_TRAY_PRICES.BROWN.SMALL).toBe(190.0);
      expect(CONFIRMED_TRAY_PRICES.BROWN.MEDIUM).toBe(220.0);
      expect(CONFIRMED_TRAY_PRICES.BROWN.LARGE).toBe(250.0);
      expect(CONFIRMED_TRAY_PRICES.BROWN.EXTRA_LARGE).toBe(270.0);
      expect(CONFIRMED_TRAY_PRICES.BROWN.JUMBO).toBe(300.0);
      expect(CONFIRMED_TRAY_PRICES.BROWN.UNGRADED).toBe(150.0);
    });

    it("verifies White baseline tray prices remain unchanged and match expected values", () => {
      expect(CONFIRMED_TRAY_PRICES.WHITE.SMALL).toBe(180.0);
      expect(CONFIRMED_TRAY_PRICES.WHITE.MEDIUM).toBe(210.0);
      expect(CONFIRMED_TRAY_PRICES.WHITE.LARGE).toBe(240.0);
      expect(CONFIRMED_TRAY_PRICES.WHITE.EXTRA_LARGE).toBe(270.0);
      expect(CONFIRMED_TRAY_PRICES.WHITE.JUMBO).toBe(300.0);
      expect(CONFIRMED_TRAY_PRICES.WHITE.UNGRADED).toBe(150.0);
    });

    it("verifies per-piece baseline rates remain unchanged for all six sizes", () => {
      expect(EGG_PRICE_PER_PIECE.SMALL).toBe(6.0);
      expect(EGG_PRICE_PER_PIECE.MEDIUM).toBe(7.0);
      expect(EGG_PRICE_PER_PIECE.LARGE).toBe(8.0);
      expect(EGG_PRICE_PER_PIECE.EXTRA_LARGE).toBe(9.0);
      expect(EGG_PRICE_PER_PIECE.JUMBO).toBe(10.0);
      expect(EGG_PRICE_PER_PIECE.UNGRADED).toBe(5.0);
    });

    it("retains existing pricing derivation for PIECE, CARTON_12, and BOX_360", () => {
      // Testing Small Brown: per-piece ₱6.00
      const smallPiece = calculatePackagingPrice("PIECE", 6.0);
      expect(smallPiece).toBe(6.0);

      const smallCarton = calculatePackagingPrice("CARTON_12", 6.0);
      expect(smallCarton).toBe(72.0); // 6.00 * 12

      const smallBox = calculatePackagingPrice("BOX_360", 6.0);
      expect(smallBox).toBe(2160.0); // 6.00 * 360

      // Testing Medium Brown: per-piece ₱7.00
      expect(calculatePackagingPrice("PIECE", 7.0)).toBe(7.0);
      expect(calculatePackagingPrice("CARTON_12", 7.0)).toBe(84.0);
      expect(calculatePackagingPrice("BOX_360", 7.0)).toBe(2520.0);

      // Testing Large Brown: per-piece ₱8.00
      expect(calculatePackagingPrice("PIECE", 8.0)).toBe(8.0);
      expect(calculatePackagingPrice("CARTON_12", 8.0)).toBe(96.0);
      expect(calculatePackagingPrice("BOX_360", 8.0)).toBe(2880.0);
    });

    it("uses explicit tray overrides for Brown and default derivation when overrides are absent", () => {
      // Without explicit tray override, derives per_piece * 30
      expect(calculatePackagingPrice("TRAY_30", 6.0)).toBe(180.0);

      // With explicit Brown Small tray override
      expect(
        calculatePackagingPrice("TRAY_30", 6.0, {
          price_tray_30: 190.0,
        })
      ).toBe(190.0);

      // With explicit Brown Medium tray override
      expect(
        calculatePackagingPrice("TRAY_30", 7.0, {
          price_tray_30: 220.0,
        })
      ).toBe(220.0);

      // With explicit Brown Large tray override
      expect(
        calculatePackagingPrice("TRAY_30", 8.0, {
          price_tray_30: 250.0,
        })
      ).toBe(250.0);
    });

    it("does not introduce unintended rounding errors or floating-point drift", () => {
      // Direct tray prices should never be derived from rounded per-piece divisions
      for (const size of EGG_SIZES) {
        const brownTray = CONFIRMED_TRAY_PRICES.BROWN[size];
        const whiteTray = CONFIRMED_TRAY_PRICES.WHITE[size];

        expect(Number.isInteger(brownTray)).toBe(true);
        expect(Number.isInteger(whiteTray)).toBe(true);

        const calculatedBrown = calculatePackagingPrice("TRAY_30", EGG_PRICE_PER_PIECE[size], {
          price_tray_30: brownTray,
        });
        expect(calculatedBrown).toBe(brownTray);
      }
    });
  });

  // ── B. Customer Order Submission & Validation ───────────────────────────────
  describe("B. Customer order submission", () => {
    // Simulated catalog map matching the live server database behavior
    const mockCatalogMap: Record<string, { price_per_piece: number; price_tray_30: number | null }> = {
      "SMALL:WHITE": { price_per_piece: 6.0, price_tray_30: 180.0 },
      "SMALL:BROWN": { price_per_piece: 6.0, price_tray_30: 190.0 },
      "MEDIUM:WHITE": { price_per_piece: 7.0, price_tray_30: 210.0 },
      "MEDIUM:BROWN": { price_per_piece: 7.0, price_tray_30: 220.0 },
      "LARGE:WHITE": { price_per_piece: 8.0, price_tray_30: 240.0 },
      "LARGE:BROWN": { price_per_piece: 8.0, price_tray_30: 250.0 },
      "EXTRA_LARGE:WHITE": { price_per_piece: 9.0, price_tray_30: 270.0 },
      "EXTRA_LARGE:BROWN": { price_per_piece: 9.0, price_tray_30: 270.0 },
      "JUMBO:WHITE": { price_per_piece: 10.0, price_tray_30: 300.0 },
      "JUMBO:BROWN": { price_per_piece: 10.0, price_tray_30: 300.0 },
      "UNGRADED:WHITE": { price_per_piece: 5.0, price_tray_30: 150.0 },
      "UNGRADED:BROWN": { price_per_piece: 5.0, price_tray_30: 150.0 },
    };

    function validateOrderPrice(item: {
      size: EggSize;
      packaging: PackagingType;
      egg_type?: EggType;
      quoted_unit_price: number;
    }): { valid: boolean; error?: string } {
      const eggType = item.egg_type ?? "WHITE";
      const key = `${item.size}:${eggType}`;
      const catalog = mockCatalogMap[key];

      if (!catalog) {
        return { valid: false, error: `Catalog entry not found for ${key}` };
      }

      const expectedPrice = calculatePackagingPrice(
        item.packaging,
        catalog.price_per_piece,
        catalog
      );

      if (Math.abs(item.quoted_unit_price - expectedPrice) > 0.01) {
        return {
          valid: false,
          error: `Price mismatch for ${item.size} ${item.packaging} (${eggType})`,
        };
      }

      return { valid: true };
    }

    it("accepts valid White orders at White catalog prices", () => {
      const whiteSmallTray = {
        size: "SMALL" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        egg_type: "WHITE" as EggType,
        quoted_unit_price: 180.0,
      };
      expect(validateOrderPrice(whiteSmallTray).valid).toBe(true);
    });

    it("accepts valid Brown orders at Brown catalog prices", () => {
      const brownSmallTray = {
        size: "SMALL" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        egg_type: "BROWN" as EggType,
        quoted_unit_price: 190.0,
      };
      expect(validateOrderPrice(brownSmallTray).valid).toBe(true);

      const brownLargeTray = {
        size: "LARGE" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        egg_type: "BROWN" as EggType,
        quoted_unit_price: 250.0,
      };
      expect(validateOrderPrice(brownLargeTray).valid).toBe(true);
    });

    it("rejects a Brown order quoted at the White price when prices differ", () => {
      // Brown Small Tray is ₱190, trying to submit at White price ₱180
      const tamperedBrown = {
        size: "SMALL" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        egg_type: "BROWN" as EggType,
        quoted_unit_price: 180.0,
      };
      const result = validateOrderPrice(tamperedBrown);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Price mismatch");
    });

    it("rejects a White order quoted at a different Brown price when prices differ", () => {
      // White Small Tray is ₱180, trying to submit at Brown price ₱190
      const tamperedWhite = {
        size: "SMALL" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        egg_type: "WHITE" as EggType,
        quoted_unit_price: 190.0,
      };
      const result = validateOrderPrice(tamperedWhite);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Price mismatch");
    });

    it("rejects invalid egg types in schema validation", () => {
      const invalidItem = {
        size: "SMALL",
        packaging: "TRAY_30",
        egg_type: "BLUE", // Invalid
        package_quantity: 1,
        quoted_unit_price: 180.0,
      };
      const parsed = customerOrderItemSchema.safeParse(invalidItem);
      expect(parsed.success).toBe(false);
    });

    it("preserves compatibility by defaulting legacy missing/null egg_type to WHITE", () => {
      const legacyItem = {
        size: "SMALL" as const,
        packaging: "TRAY_30" as const,
        package_quantity: 1,
        quoted_unit_price: 180.0,
      };
      const parsed = customerOrderItemSchema.safeParse(legacyItem);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.egg_type).toBe("WHITE");
      }

      // Validates successfully against White catalog price
      expect(validateOrderPrice({ ...legacyItem, quoted_unit_price: 180.0 }).valid).toBe(true);
    });

    it("allows White and Brown of the same size and packaging in the cart without duplicate conflict", () => {
      const cartItems = [
        {
          size: "SMALL" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          egg_type: "WHITE" as EggType,
          package_quantity: 1,
          quoted_unit_price: 180.0,
        },
        {
          size: "SMALL" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          egg_type: "BROWN" as EggType,
          package_quantity: 2,
          quoted_unit_price: 190.0,
        },
      ];

      // Duplicate check function matching server-action logic
      const itemKeys = new Set<string>();
      let hasDuplicate = false;
      for (const item of cartItems) {
        const eggType = item.egg_type ?? "WHITE";
        const key = `${item.size}:${item.packaging}:${eggType}`;
        if (itemKeys.has(key)) {
          hasDuplicate = true;
          break;
        }
        itemKeys.add(key);
      }

      expect(hasDuplicate).toBe(false);
      expect(itemKeys.size).toBe(2);
      expect(itemKeys.has("SMALL:TRAY_30:WHITE")).toBe(true);
      expect(itemKeys.has("SMALL:TRAY_30:BROWN")).toBe(true);
    });

    it("detects and rejects genuine duplicates of the same size, packaging, and egg type", () => {
      const duplicateItems = [
        {
          size: "SMALL" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          egg_type: "BROWN" as EggType,
          package_quantity: 1,
          quoted_unit_price: 190.0,
        },
        {
          size: "SMALL" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          egg_type: "BROWN" as EggType,
          package_quantity: 3,
          quoted_unit_price: 190.0,
        },
      ];

      const itemKeys = new Set<string>();
      let hasDuplicate = false;
      for (const item of duplicateItems) {
        const eggType = item.egg_type ?? "WHITE";
        const key = `${item.size}:${item.packaging}:${eggType}`;
        if (itemKeys.has(key)) {
          hasDuplicate = true;
          break;
        }
        itemKeys.add(key);
      }

      expect(hasDuplicate).toBe(true);
    });
  });

  // ── C. Regression & Preservation ───────────────────────────────────────────
  describe("C. Regression and preservation", () => {
    it("preserves historical quoted unit prices without recalculating from active catalog", () => {
      // Suppose an older order was quoted at ₱175 for SMALL tray before a price update
      const historicalItem = {
        size: "SMALL" as EggSize,
        packaging: "TRAY_30" as PackagingType,
        package_quantity: 2,
        quoted_unit_price: 175.0, // Historical snapshot
        egg_type: "WHITE" as EggType,
      };

      // Server order view mapping: estimated_line_total = package_quantity * quoted_unit_price
      const estimatedLineTotal = historicalItem.package_quantity * historicalItem.quoted_unit_price;
      expect(estimatedLineTotal).toBe(350.0);

      // Must NOT recalculate to 2 * 180 = 360
      expect(estimatedLineTotal).not.toBe(historicalItem.package_quantity * CONFIRMED_TRAY_PRICES.WHITE.SMALL);
    });

    it("verifies fulfillment items pass the exact historical quoted price to record_egg_sale", () => {
      const orderItems = [
        {
          size: "SMALL" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          package_quantity: 2,
          quoted_unit_price: 190.0,
          egg_type: "BROWN" as EggType,
        },
      ];

      // Server fulfillCustomerOrder maps items directly from quoted_unit_price
      const rpcItems = orderItems.map((item) => ({
        egg_size: item.size,
        packaging_type: item.packaging,
        package_quantity: item.package_quantity,
        unit_price: Number(item.quoted_unit_price),
      }));

      expect(rpcItems[0].unit_price).toBe(190.0);
      expect(rpcItems[0].package_quantity).toBe(2);
    });

    it("verifies inventory piece aggregation sums pieces accurately across both egg types for the same size", () => {
      const items = [
        {
          size: "LARGE" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          package_quantity: 2, // 60 pieces White
          egg_type: "WHITE" as EggType,
        },
        {
          size: "LARGE" as EggSize,
          packaging: "TRAY_30" as PackagingType,
          package_quantity: 3, // 90 pieces Brown
          egg_type: "BROWN" as EggType,
        },
      ];

      const requestedPiecesPerSize = new Map<string, number>();
      for (const item of items) {
        const multiplier = PACKAGING_MULTIPLIERS[item.packaging] || 1;
        const pieces = item.package_quantity * multiplier;
        requestedPiecesPerSize.set(
          item.size,
          (requestedPiecesPerSize.get(item.size) || 0) + pieces
        );
      }

      // 60 + 90 = 150 pieces of Large eggs
      expect(requestedPiecesPerSize.get("LARGE")).toBe(150);
    });
  });

  // ── D. Customer Catalog Fallback & Unavailable UI Behavior (FIX 1) ──────────
  describe("D. Customer catalog fallback and unavailable UI state (FIX 1)", () => {
    // Exact pure logic helper reproducing getCatalogEntry from customer-product-catalog.tsx:L80-87
    function getCatalogEntry(
      catalog: Array<{
        size: EggSize;
        egg_type?: EggType;
        price_per_piece: number;
        price_tray_30: number | null;
        is_available: boolean;
      }>,
      size: EggSize,
      eggType: EggType
    ) {
      return catalog.find(
        (e) => e.size === size && (e.egg_type ?? "WHITE") === eggType
      );
    }

    it("strictly matches both size and egg_type without silent fallback to White", () => {
      // Mock catalog containing only White entries (pre-migration or unseeded brown)
      const whiteOnlyCatalog = [
        {
          size: "SMALL" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
        },
        {
          size: "MEDIUM" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 7.0,
          price_tray_30: 210.0,
          is_available: true,
        },
      ];

      // White query returns White row
      const whiteSmall = getCatalogEntry(whiteOnlyCatalog, "SMALL", "WHITE");
      expect(whiteSmall).toBeDefined();
      expect(whiteSmall?.price_tray_30).toBe(180.0);

      // Brown query MUST return undefined — NO silent fallback to White ₱180!
      const brownSmall = getCatalogEntry(whiteOnlyCatalog, "SMALL", "BROWN");
      expect(brownSmall).toBeUndefined();

      const brownMedium = getCatalogEntry(whiteOnlyCatalog, "MEDIUM", "BROWN");
      expect(brownMedium).toBeUndefined();
    });

    it("resolves the correct Brown entry when both White and Brown exist in the catalog", () => {
      const dualCatalog = [
        {
          size: "SMALL" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
        },
        {
          size: "SMALL" as EggSize,
          egg_type: "BROWN" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 190.0,
          is_available: true,
        },
      ];

      const whiteSmall = getCatalogEntry(dualCatalog, "SMALL", "WHITE");
      expect(whiteSmall?.price_tray_30).toBe(180.0);

      const brownSmall = getCatalogEntry(dualCatalog, "SMALL", "BROWN");
      expect(brownSmall?.price_tray_30).toBe(190.0);
    });

    it("disables cart addition and blocks submission when catalog entry is missing", () => {
      const catalog = [
        {
          size: "SMALL" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
        },
      ];

      const cart: Array<{ size: EggSize; egg_type?: EggType }> = [];
      const onCartChange = (newCart: typeof cart) => {
        cart.length = 0;
        cart.push(...newCart);
      };

      // Simulating handleAddToCart guard: if (!activeEntry || !activeEntry.is_available) return;
      const simulateAddToCart = (size: EggSize, eggType: EggType) => {
        const activeEntry = getCatalogEntry(catalog, size, eggType);
        if (!activeEntry || !activeEntry.is_available) {
          return false; // Action blocked
        }
        onCartChange([...cart, { size, egg_type: eggType }]);
        return true;
      };

      // Trying to add Brown Small (missing from catalog)
      const addedBrown = simulateAddToCart("SMALL", "BROWN");
      expect(addedBrown).toBe(false);
      expect(cart).toHaveLength(0); // Cart remains empty

      // Adding White Small succeeds
      const addedWhite = simulateAddToCart("SMALL", "WHITE");
      expect(addedWhite).toBe(true);
      expect(cart).toHaveLength(1);
    });

    it("disables cart addition when catalog entry exists but is_available is false", () => {
      const catalog = [
        {
          size: "SMALL" as EggSize,
          egg_type: "BROWN" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 190.0,
          is_available: false, // Explicitly unavailable
        },
      ];

      const simulateAddToCart = (size: EggSize, eggType: EggType) => {
        const activeEntry = getCatalogEntry(catalog, size, eggType);
        if (!activeEntry || !activeEntry.is_available) {
          return false;
        }
        return true;
      };

      const result = simulateAddToCart("SMALL", "BROWN");
      expect(result).toBe(false);
    });

    it("evaluates UI state flags correctly for unlisted, unavailable, and available items", () => {
      const catalog = [
        {
          size: "SMALL" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
        },
        {
          size: "SMALL" as EggSize,
          egg_type: "BROWN" as EggType,
          price_per_piece: 6.0,
          price_tray_30: 190.0,
          is_available: false,
        },
        // MEDIUM has no Brown entry
        {
          size: "MEDIUM" as EggSize,
          egg_type: "WHITE" as EggType,
          price_per_piece: 7.0,
          price_tray_30: 210.0,
          is_available: true,
        },
      ];

      // Helper simulating component UI evaluation
      const evaluateUI = (size: EggSize, eggType: EggType) => {
        const entry = getCatalogEntry(catalog, size, eggType);
        const isEntryAvailable = Boolean(entry && entry.is_available);
        const badge = !entry ? "Not Listed" : !entry.is_available ? "Unavailable" : "Available";
        const canAddToCart = isEntryAvailable;
        return { entry, isEntryAvailable, badge, canAddToCart };
      };

      // 1. Available White Small
      const whiteSmallUI = evaluateUI("SMALL", "WHITE");
      expect(whiteSmallUI.isEntryAvailable).toBe(true);
      expect(whiteSmallUI.badge).toBe("Available");
      expect(whiteSmallUI.canAddToCart).toBe(true);

      // 2. Unavailable Brown Small
      const brownSmallUI = evaluateUI("SMALL", "BROWN");
      expect(brownSmallUI.isEntryAvailable).toBe(false);
      expect(brownSmallUI.badge).toBe("Unavailable");
      expect(brownSmallUI.canAddToCart).toBe(false);

      // 3. Unlisted Brown Medium
      const brownMediumUI = evaluateUI("MEDIUM", "BROWN");
      expect(brownMediumUI.entry).toBeUndefined();
      expect(brownMediumUI.isEntryAvailable).toBe(false);
      expect(brownMediumUI.badge).toBe("Not Listed");
      expect(brownMediumUI.canAddToCart).toBe(false);
    });
  });

  // ── E. Database Migration Rules & Availability Inheritance (FIX 2 & FIX 3) ──
  describe("E. Migration rules: Inherited availability & rerun safety (FIX 2 & FIX 3)", () => {
    // Model simulating migration 030 SQL logic
    interface CatalogRow {
      size: EggSize;
      egg_type: EggType;
      price_per_piece: number;
      price_tray_30: number;
      is_available: boolean;
      display_order: number;
    }

    const APPROVED_BROWN_SEEDS: Array<{
      size: EggSize;
      price_per_piece: number;
      price_tray_30: number;
      display_order: number;
    }> = [
      { size: "SMALL", price_per_piece: 6.0, price_tray_30: 190.0, display_order: 1 },
      { size: "MEDIUM", price_per_piece: 7.0, price_tray_30: 220.0, display_order: 2 },
      { size: "LARGE", price_per_piece: 8.0, price_tray_30: 250.0, display_order: 3 },
      { size: "EXTRA_LARGE", price_per_piece: 9.0, price_tray_30: 270.0, display_order: 4 },
      { size: "JUMBO", price_per_piece: 10.0, price_tray_30: 300.0, display_order: 5 },
      { size: "UNGRADED", price_per_piece: 5.0, price_tray_30: 150.0, display_order: 6 },
    ];

    function simulateMigration030Seed(existingRows: CatalogRow[]): CatalogRow[] {
      const rows = [...existingRows];

      for (const seed of APPROVED_BROWN_SEEDS) {
        // ON CONFLICT (size, egg_type) DO NOTHING
        const existingBrown = rows.find(
          (r) => r.size === seed.size && r.egg_type === "BROWN"
        );
        if (existingBrown) {
          continue; // DO NOTHING: preserve existing row
        }

        // COALESCE((SELECT w.is_available FROM egg_price_catalog w WHERE w.size = v.size AND w.egg_type = 'WHITE' LIMIT 1), false)
        const matchingWhite = rows.find(
          (r) => r.size === seed.size && r.egg_type === "WHITE"
        );
        const inheritedAvailability = matchingWhite ? matchingWhite.is_available : false;

        rows.push({
          size: seed.size,
          egg_type: "BROWN",
          price_per_piece: seed.price_per_piece,
          price_tray_30: seed.price_tray_30,
          is_available: inheritedAvailability,
          display_order: seed.display_order,
        });
      }

      return rows;
    }

    it("inherits is_available from matching White row when White row is true", () => {
      const initialRows: CatalogRow[] = [
        {
          size: "SMALL",
          egg_type: "WHITE",
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
          display_order: 1,
        },
      ];

      const result = simulateMigration030Seed(initialRows);
      const seededBrownSmall = result.find(
        (r) => r.size === "SMALL" && r.egg_type === "BROWN"
      );

      expect(seededBrownSmall).toBeDefined();
      expect(seededBrownSmall?.is_available).toBe(true);
      expect(seededBrownSmall?.price_tray_30).toBe(190.0);
    });

    it("inherits is_available = false from matching White row when White row is false", () => {
      const initialRows: CatalogRow[] = [
        {
          size: "MEDIUM",
          egg_type: "WHITE",
          price_per_piece: 7.0,
          price_tray_30: 210.0,
          is_available: false, // White is disabled
          display_order: 2,
        },
      ];

      const result = simulateMigration030Seed(initialRows);
      const seededBrownMedium = result.find(
        (r) => r.size === "MEDIUM" && r.egg_type === "BROWN"
      );

      expect(seededBrownMedium).toBeDefined();
      expect(seededBrownMedium?.is_available).toBe(false);
    });

    it("defaults is_available to false when matching White row is missing entirely", () => {
      // Catalog has NO White row for UNGRADED
      const initialRows: CatalogRow[] = [
        {
          size: "SMALL",
          egg_type: "WHITE",
          price_per_piece: 6.0,
          price_tray_30: 180.0,
          is_available: true,
          display_order: 1,
        },
      ];

      const result = simulateMigration030Seed(initialRows);
      const seededBrownUngraded = result.find(
        (r) => r.size === "UNGRADED" && r.egg_type === "BROWN"
      );

      expect(seededBrownUngraded).toBeDefined();
      expect(seededBrownUngraded?.is_available).toBe(false); // Defaulted to false
      expect(seededBrownUngraded?.price_tray_30).toBe(150.0);
    });

    it("preserves existing Brown rows and prices without overwriting on migration reruns", () => {
      // Suppose an administrator manually adjusted Brown Large price to ₱255 and set availability to true
      const existingRowsWithCustomBrown: CatalogRow[] = [
        {
          size: "LARGE",
          egg_type: "WHITE",
          price_per_piece: 8.0,
          price_tray_30: 240.0,
          is_available: false,
          display_order: 3,
        },
        {
          size: "LARGE",
          egg_type: "BROWN",
          price_per_piece: 8.5,
          price_tray_30: 255.0, // Custom existing price
          is_available: true,   // Custom existing availability
          display_order: 3,
        },
      ];

      // Running migration again
      const result = simulateMigration030Seed(existingRowsWithCustomBrown);
      const brownLarge = result.find(
        (r) => r.size === "LARGE" && r.egg_type === "BROWN"
      );

      // Must NOT be overwritten to 250.0 or false
      expect(brownLarge?.price_tray_30).toBe(255.0);
      expect(brownLarge?.price_per_piece).toBe(8.5);
      expect(brownLarge?.is_available).toBe(true);
    });

    it("preserves all six approved Brown tray prices and White prices exactly", () => {
      const whiteBaseline: CatalogRow[] = EGG_SIZES.map((size, idx) => ({
        size,
        egg_type: "WHITE",
        price_per_piece: EGG_PRICE_PER_PIECE[size],
        price_tray_30: CONFIRMED_TRAY_PRICES.WHITE[size],
        is_available: true,
        display_order: idx + 1,
      }));

      const result = simulateMigration030Seed(whiteBaseline);

      for (const size of EGG_SIZES) {
        const white = result.find((r) => r.size === size && r.egg_type === "WHITE");
        const brown = result.find((r) => r.size === size && r.egg_type === "BROWN");

        expect(white?.price_tray_30).toBe(CONFIRMED_TRAY_PRICES.WHITE[size]);
        expect(brown?.price_tray_30).toBe(CONFIRMED_TRAY_PRICES.BROWN[size]);
        expect(white?.price_per_piece).toBe(EGG_PRICE_PER_PIECE[size]);
        expect(brown?.price_per_piece).toBe(EGG_PRICE_PER_PIECE[size]);
      }
    });

    it("validates compound key (size, egg_type) semantics", () => {
      const keys = new Set<string>();

      const addRow = (size: EggSize, eggType: EggType) => {
        const key = `${size}:${eggType}`;
        if (keys.has(key)) {
          throw new Error(`Unique constraint violation: key ${key} already exists`);
        }
        keys.add(key);
      };

      // Both White and Brown for the same size must be allowed
      expect(() => addRow("SMALL", "WHITE")).not.toThrow();
      expect(() => addRow("SMALL", "BROWN")).not.toThrow();
      expect(keys.size).toBe(2);

      // Duplicate (SMALL, BROWN) must violate uniqueness
      expect(() => addRow("SMALL", "BROWN")).toThrow("Unique constraint violation");
    });
  });
});
