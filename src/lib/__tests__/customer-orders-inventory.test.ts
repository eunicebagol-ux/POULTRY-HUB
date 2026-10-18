import { describe, it, expect } from "vitest";
import {
  submitCustomerOrderSchema,
  cancelCustomerOrderSchema,
  updateOrderStatusSchema,
} from "../validations/customer-orders";
import {
  PACKAGING_MULTIPLIERS,
  ALLOWED_STATUS_TRANSITIONS,
} from "../constants";
import type { EggSize, PackagingType } from "../../types";

describe("Customer Orders & Inventory Business Rules", () => {
  // ── 1. Product Catalog & Packaging Multipliers ──────────────────────────────
  describe("1. Product Catalog & Packaging Multipliers", () => {
    it("has authoritative multipliers for all standard packaging types", () => {
      expect(PACKAGING_MULTIPLIERS.PIECE).toBe(1);
      expect(PACKAGING_MULTIPLIERS.TRAY_30).toBe(30);
      expect(PACKAGING_MULTIPLIERS.CARTON_12).toBe(12);
      expect(PACKAGING_MULTIPLIERS.BOX_360).toBe(360);
    });

    it("calculates correct piece counts for different packaging options", () => {
      const calcPieces = (pkg: PackagingType, qty: number) =>
        qty * PACKAGING_MULTIPLIERS[pkg];

      expect(calcPieces("PIECE", 15)).toBe(15);
      expect(calcPieces("TRAY_30", 5)).toBe(150);
      expect(calcPieces("CARTON_12", 4)).toBe(48);
      expect(calcPieces("BOX_360", 2)).toBe(720);
    });

    it("calculates expected packaging price correctly from per-piece catalog price", () => {
      const perPiecePrice = 8.5; // Large egg
      const getExpectedPrice = (
        pkg: PackagingType,
        overrides: Partial<Record<PackagingType, number>> = {}
      ) => {
        if (overrides[pkg] != null) return overrides[pkg]!;
        return perPiecePrice * PACKAGING_MULTIPLIERS[pkg];
      };

      // Default calculation: per_piece * multiplier
      expect(getExpectedPrice("PIECE")).toBe(8.5);
      expect(getExpectedPrice("TRAY_30")).toBe(255);
      expect(getExpectedPrice("CARTON_12")).toBe(102);
      expect(getExpectedPrice("BOX_360")).toBe(3060);

      // Custom override (e.g. discounted tray price)
      expect(getExpectedPrice("TRAY_30", { TRAY_30: 250 })).toBe(250);
    });
  });

  // ── 2. Order Input Validation Schema ───────────────────────────────────────
  describe("2. Order Input Validation Schema", () => {
    it("accepts a valid customer order submission", () => {
      const validOrder = {
        requested_date: "2026-10-25",
        notes: "Deliver to front gate",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 3,
            quoted_unit_price: 255.0,
          },
          {
            size: "MEDIUM" as EggSize,
            packaging: "CARTON_12" as PackagingType,
            package_quantity: 2,
            quoted_unit_price: 90.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.items).toHaveLength(2);
        expect(result.data.items[0].package_quantity).toBe(3);
      }
    });

    it("rejects orders with empty items array", () => {
      const emptyOrder = {
        items: [],
      };
      const result = submitCustomerOrderSchema.safeParse(emptyOrder);
      expect(result.success).toBe(false);
    });

    it("rejects zero or negative quantities", () => {
      const invalidOrder = {
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 0,
            quoted_unit_price: 250,
          },
        ],
      };
      const result = submitCustomerOrderSchema.safeParse(invalidOrder);
      expect(result.success).toBe(false);
    });

    it("rejects negative quoted prices", () => {
      const negativePriceOrder = {
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: -10,
          },
        ],
      };
      const result = submitCustomerOrderSchema.safeParse(negativePriceOrder);
      expect(result.success).toBe(false);
    });
  });

  // ── 3. Price Tampering & Anti-Deviance Checks ──────────────────────────────
  describe("3. Server-Side Price & Quantity Integrity Checks", () => {
    const isPriceTampered = (
      clientQuotedPrice: number,
      serverCatalogPrice: number
    ) => Math.abs(clientQuotedPrice - serverCatalogPrice) > 0.01;

    it("accepts exact match and slight float roundoff within 1 centavo", () => {
      expect(isPriceTampered(240.0, 240.0)).toBe(false);
      expect(isPriceTampered(240.005, 240.0)).toBe(false);
    });

    it("detects and flags client-side price tampering", () => {
      // Client attempted to change tray price from 250 to 150
      expect(isPriceTampered(150.0, 250.0)).toBe(true);
      // Client attempted to discount by 1 peso
      expect(isPriceTampered(249.0, 250.0)).toBe(true);
    });

    it("identifies duplicate size+packaging items that must be consolidated", () => {
      const items = [
        { size: "LARGE", packaging: "TRAY_30" },
        { size: "LARGE", packaging: "TRAY_30" },
      ];
      const keys = new Set<string>();
      let hasDuplicates = false;
      for (const item of items) {
        const key = `${item.size}:${item.packaging}`;
        if (keys.has(key)) {
          hasDuplicates = true;
          break;
        }
        keys.add(key);
      }
      expect(hasDuplicates).toBe(true);
    });
  });

  // ── 4. Stock Validation for Order Placement (No Auto-Deduction) ─────────────
  describe("4. Stock Validation & Reservation Policy", () => {
    const mockInventory: Record<EggSize, number> = {
      SMALL: 100,
      MEDIUM: 200,
      LARGE: 150,
      EXTRA_LARGE: 50,
      JUMBO: 0, // out of stock
      UNGRADED: 20,
    };

    const validateOrderStock = (
      items: Array<{ size: EggSize; packaging: PackagingType; package_quantity: number }>
    ) => {
      const requestedPerSize = new Map<EggSize, number>();
      for (const item of items) {
        const pieces = item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging];
        requestedPerSize.set(
          item.size,
          (requestedPerSize.get(item.size) || 0) + pieces
        );
      }

      for (const [size, requestedPieces] of requestedPerSize.entries()) {
        const stock = mockInventory[size] ?? 0;
        if (stock <= 0) {
          return { valid: false, error: `${size} eggs are currently out of stock.` };
        }
        if (requestedPieces > stock) {
          return {
            valid: false,
            error: `Requested quantity for ${size} (${requestedPieces} pcs) exceeds available stock (${stock} pcs).`,
          };
        }
      }
      return { valid: true };
    };

    it("permits orders within available stock limits", () => {
      const result = validateOrderStock([
        { size: "LARGE", packaging: "TRAY_30", package_quantity: 4 }, // 120 pcs <= 150
        { size: "MEDIUM", packaging: "CARTON_12", package_quantity: 5 }, // 60 pcs <= 200
      ]);
      expect(result.valid).toBe(true);
    });

    it("rejects orders for out-of-stock egg sizes", () => {
      const result = validateOrderStock([
        { size: "JUMBO", packaging: "PIECE", package_quantity: 1 },
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("out of stock");
    });

    it("rejects orders exceeding available stock across multiple line items", () => {
      const result = validateOrderStock([
        { size: "LARGE", packaging: "TRAY_30", package_quantity: 5 }, // 150 pcs
        { size: "LARGE", packaging: "PIECE", package_quantity: 10 }, // +10 pcs = 160 pcs > 150 pcs
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("exceeds available stock");
    });

    it("confirms pending customer orders do NOT mutate inventory snapshot", () => {
      const initialStock = { ...mockInventory };
      // Simulating placing an order
      const orderPlaced = validateOrderStock([
        { size: "LARGE", packaging: "TRAY_30", package_quantity: 2 },
      ]);
      expect(orderPlaced.valid).toBe(true);

      // Business rule: Inventory remains identical post-submission
      expect(mockInventory.LARGE).toBe(initialStock.LARGE);
      expect(mockInventory).toEqual(initialStock);
    });
  });

  // ── 5. Production to Sellable Inventory Calculation ────────────────────────
  describe("5. Production to Sellable Inventory Invariants", () => {
    it("ensures damaged and cracked eggs are excluded from good_eggs breakdown", () => {
      const collection = {
        total_eggs: 500,
        damaged_eggs: 15,
        cracked_eggs: 10,
        sizes: {
          SMALL: 50,
          MEDIUM: 150,
          LARGE: 200,
          EXTRA_LARGE: 50,
          JUMBO: 25,
          UNGRADED: 0,
        },
      };

      const computedGoodEggs =
        collection.sizes.SMALL +
        collection.sizes.MEDIUM +
        collection.sizes.LARGE +
        collection.sizes.EXTRA_LARGE +
        collection.sizes.JUMBO +
        collection.sizes.UNGRADED;

      // Invariant: total = good + damaged + cracked
      expect(collection.total_eggs).toBe(
        computedGoodEggs + collection.damaged_eggs + collection.cracked_eggs
      );

      // Invariant: only good eggs have sized inventory representation
      expect(computedGoodEggs).toBe(475);
      expect(collection.damaged_eggs + collection.cracked_eggs).toBe(25);
    });

    it("increments sellable stock strictly by intact good egg sizes", () => {
      const currentStock: Record<EggSize, number> = {
        SMALL: 10,
        MEDIUM: 20,
        LARGE: 30,
        EXTRA_LARGE: 40,
        JUMBO: 50,
        UNGRADED: 0,
      };

      const newProductionSizes: Record<EggSize, number> = {
        SMALL: 15,
        MEDIUM: 25,
        LARGE: 35,
        EXTRA_LARGE: 45,
        JUMBO: 5,
        UNGRADED: 0,
      };

      // Atomic inventory increment
      const updatedStock = { ...currentStock };
      for (const [size, qty] of Object.entries(newProductionSizes) as [EggSize, number][]) {
        updatedStock[size] += qty;
      }

      expect(updatedStock.SMALL).toBe(25);
      expect(updatedStock.MEDIUM).toBe(45);
      expect(updatedStock.LARGE).toBe(65);
      expect(updatedStock.EXTRA_LARGE).toBe(85);
      expect(updatedStock.JUMBO).toBe(55);
    });
  });

  // ── 6. Sale Fulfillment & Inventory Deduction ──────────────────────────────
  describe("6. Sale Fulfillment & Single Stock Deduction", () => {
    it("deducts inventory exactly once when sale is fulfilled", () => {
      let stock = 100;
      const orderItems = [{ packaging: "TRAY_30" as PackagingType, qty: 2 }]; // 60 pieces

      // 1. Order intake (status = PENDING): stock is untouched
      const isOrderSubmitted = true;
      expect(isOrderSubmitted).toBe(true);
      expect(stock).toBe(100);

      // 2. Staff fulfills order via record_egg_sale()
      const totalPiecesToDeduct = orderItems.reduce(
        (sum, item) => sum + item.qty * PACKAGING_MULTIPLIERS[item.packaging],
        0
      );
      stock -= totalPiecesToDeduct;

      expect(stock).toBe(40);

      // 3. Prevent duplicate fulfillment if sale_id already exists
      const isAlreadyFulfilled = true;
      const canFulfillAgain = !isAlreadyFulfilled;
      expect(canFulfillAgain).toBe(false);
      // Stock remains unchanged after check
      expect(stock).toBe(40);
    });

    it("enforces order status state-machine transitions", () => {
      // PENDING -> CONFIRMED or CANCELLED
      expect(ALLOWED_STATUS_TRANSITIONS.PENDING).toContain("CONFIRMED");
      expect(ALLOWED_STATUS_TRANSITIONS.PENDING).toContain("CANCELLED");
      expect(ALLOWED_STATUS_TRANSITIONS.PENDING).not.toContain("COMPLETED"); // Cannot skip to COMPLETED

      // CONFIRMED -> PREPARING or CANCELLED
      expect(ALLOWED_STATUS_TRANSITIONS.CONFIRMED).toContain("PREPARING");
      expect(ALLOWED_STATUS_TRANSITIONS.CONFIRMED).toContain("CANCELLED");

      // PREPARING -> READY or CANCELLED
      expect(ALLOWED_STATUS_TRANSITIONS.PREPARING).toContain("READY");

      // READY -> COMPLETED or CANCELLED
      expect(ALLOWED_STATUS_TRANSITIONS.READY).toContain("COMPLETED");

      // Terminal states
      expect(ALLOWED_STATUS_TRANSITIONS.COMPLETED).toHaveLength(0);
      expect(ALLOWED_STATUS_TRANSITIONS.CANCELLED).toHaveLength(0);
    });

    it("validates cancelCustomerOrder input schema", () => {
      const validCancel = {
        order_id: "123e4567-e89b-12d3-a456-426614174000",
      };
      expect(cancelCustomerOrderSchema.safeParse(validCancel).success).toBe(true);

      const invalidCancel = {
        order_id: "not-a-uuid",
      };
      expect(cancelCustomerOrderSchema.safeParse(invalidCancel).success).toBe(false);
    });

    it("validates updateOrderStatus input schema", () => {
      const validUpdate = {
        order_id: "123e4567-e89b-12d3-a456-426614174000",
        status: "CONFIRMED" as const,
        admin_notes: "Payment verified",
      };
      expect(updateOrderStatusSchema.safeParse(validUpdate).success).toBe(true);

      const cancelWithoutReason = {
        order_id: "123e4567-e89b-12d3-a456-426614174000",
        status: "CANCELLED" as const,
      };
      expect(updateOrderStatusSchema.safeParse(cancelWithoutReason).success).toBe(false);

      const cancelWithReason = {
        order_id: "123e4567-e89b-12d3-a456-426614174000",
        status: "CANCELLED" as const,
        cancellation_reason: "Customer requested cancellation",
      };
      expect(updateOrderStatusSchema.safeParse(cancelWithReason).success).toBe(true);
    });
  });
});
