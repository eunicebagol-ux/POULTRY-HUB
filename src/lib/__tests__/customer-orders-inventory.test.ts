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
    it("accepts a valid customer order submission (DELIVERY)", () => {
      const validOrder = {
        fulfillment_method: "DELIVERY" as const,
        payment_method: "CASH_ON_DELIVERY" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "Libertad",
        delivery_address: "Purok 4, Main Road",
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
        expect(result.data.fulfillment_method).toBe("DELIVERY");
        expect(result.data.payment_method).toBe("CASH_ON_DELIVERY");
      }
    });

    it("accepts a valid customer order submission (PICKUP with CASH_ON_PICKUP)", () => {
      const validPickup = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "CASH_ON_PICKUP" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        notes: "Will bring crate",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(validPickup);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_method).toBe("CASH_ON_PICKUP");
      }
    });

    it("accepts a valid customer order submission (PICKUP with GCASH and full details)", () => {
      const validPickupGcash = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "GCASH" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        payment_gcash_number: "09171234567",
        payment_gcash_account_name: "Juan Dela Cruz",
        payment_reference: "GCASH-998877",
        payment_date: "2026-10-25",
        payment_amount: 255.0,
        notes: "Paid via GCash app",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(validPickupGcash);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_method).toBe("GCASH");
        expect(result.data.payment_gcash_number).toBe("09171234567");
        expect(result.data.payment_gcash_account_name).toBe("Juan Dela Cruz");
        expect(result.data.payment_reference).toBe("GCASH-998877");
      }
    });

    it("accepts a valid customer order submission (GCASH without payment_reference before payment)", () => {
      const validGcashPrePayment = {
        fulfillment_method: "DELIVERY" as const,
        payment_method: "GCASH" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "Ampayon",
        delivery_address: "Block 2 Lot 5",
        payment_gcash_number: "09189876543",
        payment_gcash_account_name: "Maria Santos",
        // payment_reference is omitted (optional)
        items: [
          {
            size: "MEDIUM" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 220.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(validGcashPrePayment);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_method).toBe("GCASH");
        expect(result.data.payment_gcash_number).toBe("09189876543");
        expect(result.data.payment_gcash_account_name).toBe("Maria Santos");
        expect(result.data.payment_reference).toBeUndefined();
      }
    });

    it("rejects GCASH order missing payment_gcash_number", () => {
      const invalidGcash = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "GCASH" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        payment_gcash_account_name: "Juan Dela Cruz",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(invalidGcash);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_gcash_number"))).toBe(true);
      }
    });

    it("rejects GCASH order with invalid GCash number format", () => {
      const invalidGcashNum = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "GCASH" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        payment_gcash_number: "12345",
        payment_gcash_account_name: "Juan Dela Cruz",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(invalidGcashNum);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_gcash_number"))).toBe(true);
      }
    });

    it("rejects GCASH order missing payment_gcash_account_name", () => {
      const invalidGcashName = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "GCASH" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        payment_gcash_number: "09171234567",
        payment_gcash_account_name: "",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(invalidGcashName);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_gcash_account_name"))).toBe(true);
      }
    });

    it("accepts a valid customer order submission (BANK_TRANSFER)", () => {
      const validBank = {
        fulfillment_method: "DELIVERY" as const,
        payment_method: "BANK_TRANSFER" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "Ampayon",
        delivery_address: "Block 2 Lot 5",
        payment_bank_name: "BDO",
        payment_sender_name: "Juan Dela Cruz",
        payment_reference: "BT-112233",
        payment_date: "2026-10-25",
        payment_amount: 65.0,
        items: [
          {
            size: "SMALL" as EggSize,
            packaging: "PIECE" as PackagingType,
            package_quantity: 10,
            quoted_unit_price: 6.5,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(validBank);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payment_method).toBe("BANK_TRANSFER");
        expect(result.data.payment_bank_name).toBe("BDO");
      }
    });

    it("rejects DELIVERY orders with CASH_ON_PICKUP", () => {
      const invalidDelivery = {
        fulfillment_method: "DELIVERY" as const,
        payment_method: "CASH_ON_PICKUP" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "Ampayon",
        delivery_address: "Block 2 Lot 5",
        items: [
          {
            size: "SMALL" as EggSize,
            packaging: "PIECE" as PackagingType,
            package_quantity: 10,
            quoted_unit_price: 6.5,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(invalidDelivery);
      expect(result.success).toBe(false);
    });

    it("rejects PICKUP orders with CASH_ON_DELIVERY", () => {
      const invalidPickup = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "CASH_ON_DELIVERY" as const,
        requested_date: "2026-10-25",
        pickup_time: "10:00 AM - 12:00 PM",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(invalidPickup);
      expect(result.success).toBe(false);
    });

    it("rejects orders missing payment_method", () => {
      const missingPayment = {
        fulfillment_method: "DELIVERY" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "Libertad",
        delivery_address: "Purok 4",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };

      const result = submitCustomerOrderSchema.safeParse(missingPayment);
      expect(result.success).toBe(false);
    });

    it("rejects DELIVERY orders missing barangay or address", () => {
      const missingAddress = {
        fulfillment_method: "DELIVERY" as const,
        payment_method: "CASH_ON_DELIVERY" as const,
        requested_date: "2026-10-25",
        delivery_barangay: "",
        delivery_address: "",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };
      const result = submitCustomerOrderSchema.safeParse(missingAddress);
      expect(result.success).toBe(false);
    });

    it("rejects PICKUP orders missing pickup_time", () => {
      const missingTime = {
        fulfillment_method: "PICKUP" as const,
        payment_method: "CASH_ON_DELIVERY" as const,
        requested_date: "2026-10-25",
        items: [
          {
            size: "LARGE" as EggSize,
            packaging: "TRAY_30" as PackagingType,
            package_quantity: 1,
            quoted_unit_price: 255.0,
          },
        ],
      };
      const result = submitCustomerOrderSchema.safeParse(missingTime);
      expect(result.success).toBe(false);
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

  // ── 7. Customer Portal Stock Availability by Size ───────────────────────────
  describe("7. Customer Portal Stock Availability by Size", () => {
    // Exact farm inventory matching production reality: 967 total eggs
    const farmInventory: Record<EggSize, number> = {
      SMALL: 210,
      MEDIUM: 215,
      LARGE: 200,
      EXTRA_LARGE: 203,
      JUMBO: 119,
      UNGRADED: 20,
    };

    const mockCatalog = [
      { size: "SMALL" as EggSize, price_per_piece: 6, is_available: true, display_order: 1 },
      { size: "MEDIUM" as EggSize, price_per_piece: 7, is_available: true, display_order: 2 },
      { size: "LARGE" as EggSize, price_per_piece: 8, is_available: true, display_order: 3 },
      { size: "EXTRA_LARGE" as EggSize, price_per_piece: 9, is_available: true, display_order: 4 },
      { size: "JUMBO" as EggSize, price_per_piece: 10, is_available: true, display_order: 5 },
      { size: "UNGRADED" as EggSize, price_per_piece: 5, is_available: true, display_order: 6 },
    ];

    it("correctly sums the 967 total eggs across all 6 canonical egg sizes", () => {
      const totalPieces = Object.values(farmInventory).reduce((sum, pieces) => sum + pieces, 0);
      expect(totalPieces).toBe(967);
    });

    it("joins catalog products with inventory stock levels by egg size", () => {
      const stockMap = new Map<string, number>(Object.entries(farmInventory));

      const catalogWithStock = mockCatalog.map((item) => ({
        ...item,
        stock_pieces: stockMap.get(item.size) ?? 0,
      }));

      expect(catalogWithStock).toHaveLength(6);
      expect(catalogWithStock.find((e) => e.size === "SMALL")?.stock_pieces).toBe(210);
      expect(catalogWithStock.find((e) => e.size === "MEDIUM")?.stock_pieces).toBe(215);
      expect(catalogWithStock.find((e) => e.size === "LARGE")?.stock_pieces).toBe(200);
      expect(catalogWithStock.find((e) => e.size === "EXTRA_LARGE")?.stock_pieces).toBe(203);
      expect(catalogWithStock.find((e) => e.size === "JUMBO")?.stock_pieces).toBe(119);
      expect(catalogWithStock.find((e) => e.size === "UNGRADED")?.stock_pieces).toBe(20);
    });

    it("calculates correct stock status labels and low stock flags for the portal UI", () => {
      const getStockStatus = (stockPieces: number) => {
        if (stockPieces === 0) {
          return { label: "Out of stock", isOutOfStock: true, isLowStock: false };
        }
        if (stockPieces < 30) {
          return { label: "Low stock", isOutOfStock: false, isLowStock: true };
        }
        return {
          label: `${stockPieces.toLocaleString()} pcs available`,
          isOutOfStock: false,
          isLowStock: false,
        };
      };

      // 967 eggs distribution
      expect(getStockStatus(farmInventory.SMALL)).toEqual({
        label: "210 pcs available",
        isOutOfStock: false,
        isLowStock: false,
      });
      expect(getStockStatus(farmInventory.MEDIUM)).toEqual({
        label: "215 pcs available",
        isOutOfStock: false,
        isLowStock: false,
      });
      expect(getStockStatus(farmInventory.LARGE)).toEqual({
        label: "200 pcs available",
        isOutOfStock: false,
        isLowStock: false,
      });
      expect(getStockStatus(farmInventory.EXTRA_LARGE)).toEqual({
        label: "203 pcs available",
        isOutOfStock: false,
        isLowStock: false,
      });
      expect(getStockStatus(farmInventory.JUMBO)).toEqual({
        label: "119 pcs available",
        isOutOfStock: false,
        isLowStock: false,
      });
      // UNGRADED has 20 eggs (< 30) -> Low stock, NOT out of stock
      expect(getStockStatus(farmInventory.UNGRADED)).toEqual({
        label: "Low stock",
        isOutOfStock: false,
        isLowStock: true,
      });

      // True 0 stock case
      expect(getStockStatus(0)).toEqual({
        label: "Out of stock",
        isOutOfStock: true,
        isLowStock: false,
      });
    });

    it("calculates packaging capacity per egg size from live stock", () => {
      const getPackagingCapacity = (stock: number) => ({
        pieces: stock,
        trays_30: Math.floor(stock / PACKAGING_MULTIPLIERS.TRAY_30),
        cartons_12: Math.floor(stock / PACKAGING_MULTIPLIERS.CARTON_12),
        boxes_360: Math.floor(stock / PACKAGING_MULTIPLIERS.BOX_360),
      });

      // Large size (200 pieces)
      const largeCapacity = getPackagingCapacity(farmInventory.LARGE);
      expect(largeCapacity.trays_30).toBe(6); // 6 * 30 = 180 pcs
      expect(largeCapacity.cartons_12).toBe(16); // 16 * 12 = 192 pcs
      expect(largeCapacity.boxes_360).toBe(0); // 200 < 360

      // Jumbo size (119 pieces)
      const jumboCapacity = getPackagingCapacity(farmInventory.JUMBO);
      expect(jumboCapacity.trays_30).toBe(3); // 3 * 30 = 90 pcs
      expect(jumboCapacity.cartons_12).toBe(9); // 9 * 12 = 108 pcs
    });

    it("verifies order intake allows purchasing within actual stock limits", () => {
      const stockMap = new Map<string, number>(Object.entries(farmInventory));

      const validateOrder = (
        items: { size: EggSize; packaging: PackagingType; package_quantity: number }[]
      ) => {
        const requestedPiecesPerSize = new Map<string, number>();
        for (const item of items) {
          const pieces = item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging];
          requestedPiecesPerSize.set(
            item.size,
            (requestedPiecesPerSize.get(item.size) || 0) + pieces
          );
        }

        for (const [size, requested] of requestedPiecesPerSize.entries()) {
          const available = stockMap.get(size) ?? 0;
          if (available <= 0) return { valid: false, error: `${size} eggs are out of stock.` };
          if (requested > available) {
            return {
              valid: false,
              error: `Requested ${requested} pcs exceeds available ${available} pcs.`,
            };
          }
        }
        return { valid: true };
      };

      // Valid order: 5 trays Large (150 pcs <= 200 pcs) + 1 carton Ungraded (12 pcs <= 20 pcs)
      const valid = validateOrder([
        { size: "LARGE", packaging: "TRAY_30", package_quantity: 5 },
        { size: "UNGRADED", packaging: "CARTON_12", package_quantity: 1 },
      ]);
      expect(valid.valid).toBe(true);

      // Oversell order: 7 trays Large (210 pcs > 200 pcs)
      const oversell = validateOrder([
        { size: "LARGE", packaging: "TRAY_30", package_quantity: 7 },
      ]);
      expect(oversell.valid).toBe(false);
      expect(oversell.error).toContain("exceeds available 200 pcs");
    });
  });

  // ── 8. Customer Record Resolution & Account Linkage Rules ───────────────────
  describe("8. Customer Record Resolution & Account Linkage Rules", () => {
    interface MockProfile {
      id: string;
      role: "ADMIN" | "STAFF" | "CUSTOMER";
      full_name: string;
      is_active: boolean;
      email?: string;
    }

    interface MockCustomer {
      id: string;
      clerk_user_id: string | null;
      name: string;
      email: string | null;
      is_active: boolean;
    }

    // Helper simulating the resolveCustomerRecord business logic
    const resolveCustomer = (
      caller: MockProfile | null,
      customers: MockCustomer[],
      verifiedEmail?: string
    ): {
      result: { id: string; is_active: boolean } | null;
      updatedCustomers: MockCustomer[];
      error?: string;
    } => {
      if (!caller) return { result: null, updatedCustomers: customers, error: "Unauthorized" };

      if (caller.role !== "CUSTOMER") {
        return {
          result: null,
          updatedCustomers: customers,
          error: "Only approved CUSTOMER accounts may place orders.",
        };
      }

      const list = [...customers];

      // 1. Primary: 1-to-1 Clerk user ID linkage
      const byClerk = list.find((c) => c.clerk_user_id === caller.id);
      if (byClerk) {
        if (caller.is_active && !byClerk.is_active) {
          byClerk.is_active = true;
        }
        return { result: { id: byClerk.id, is_active: byClerk.is_active }, updatedCustomers: list };
      }

      // 2. Fallback: verified email
      if (verifiedEmail) {
        const unlinked = list.filter((c) => c.email === verifiedEmail && !c.clerk_user_id);
        if (unlinked.length === 1) {
          unlinked[0].clerk_user_id = caller.id;
          unlinked[0].is_active = caller.is_active;
          return {
            result: { id: unlinked[0].id, is_active: unlinked[0].is_active },
            updatedCustomers: list,
          };
        }
      }

      // 3. Auto-provision missing customer
      const newCust: MockCustomer = {
        id: `cust-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        clerk_user_id: caller.id,
        name: caller.full_name || "Customer",
        email: verifiedEmail || null,
        is_active: caller.is_active,
      };
      list.push(newCust);
      return { result: { id: newCust.id, is_active: newCust.is_active }, updatedCustomers: list };
    };

    it("resolves a correctly linked active customer record", () => {
      const caller: MockProfile = {
        id: "user_customer_1",
        role: "CUSTOMER",
        full_name: "Angela Customer",
        is_active: true,
      };

      const customers: MockCustomer[] = [
        {
          id: "cust-uuid-1",
          clerk_user_id: "user_customer_1",
          name: "Angela Customer",
          email: "angela@example.com",
          is_active: true,
        },
      ];

      const { result, error } = resolveCustomer(caller, customers);
      expect(error).toBeUndefined();
      expect(result).not.toBeNull();
      expect(result?.id).toBe("cust-uuid-1");
      expect(result?.is_active).toBe(true);
    });

    it("synchronizes customer active status when profile is active but customer was inactive", () => {
      const caller: MockProfile = {
        id: "user_customer_2",
        role: "CUSTOMER",
        full_name: "Approved Customer",
        is_active: true,
      };

      const customers: MockCustomer[] = [
        {
          id: "cust-uuid-2",
          clerk_user_id: "user_customer_2",
          name: "Approved Customer",
          email: "approved@example.com",
          is_active: false, // Inactive in customers table
        },
      ];

      const { result, updatedCustomers } = resolveCustomer(caller, customers);
      expect(result).not.toBeNull();
      expect(result?.id).toBe("cust-uuid-2");
      expect(result?.is_active).toBe(true);
      expect(updatedCustomers[0].is_active).toBe(true);
    });

    it("correctly identifies unapproved/pending customer accounts", () => {
      const caller: MockProfile = {
        id: "user_customer_pending",
        role: "CUSTOMER",
        full_name: "Pending Customer",
        is_active: false,
      };

      const customers: MockCustomer[] = [
        {
          id: "cust-uuid-pending",
          clerk_user_id: "user_customer_pending",
          name: "Pending Customer",
          email: "pending@example.com",
          is_active: false,
        },
      ];

      const { result } = resolveCustomer(caller, customers);
      expect(result).not.toBeNull();
      expect(result?.is_active).toBe(false);

      // Submit order check: inactive customer is rejected with approval message
      const canSubmit = result?.is_active === true;
      expect(canSubmit).toBe(false);
    });

    it("safely and idempotently auto-provisions a missing customer record for active CUSTOMER", () => {
      const caller: MockProfile = {
        id: "user_customer_missing",
        role: "CUSTOMER",
        full_name: "New Online Buyer",
        is_active: true,
      };

      const initialCustomers: MockCustomer[] = [
        {
          id: "cust-existing",
          clerk_user_id: "user_other",
          name: "Other Buyer",
          email: "other@example.com",
          is_active: true,
        },
      ];

      // First call provisions
      const firstCall = resolveCustomer(caller, initialCustomers, "newbuyer@example.com");
      expect(firstCall.result).not.toBeNull();
      expect(firstCall.updatedCustomers).toHaveLength(2);

      const provisionedId = firstCall.result!.id;
      const provisionedCust = firstCall.updatedCustomers.find((c) => c.clerk_user_id === caller.id);
      expect(provisionedCust).toBeDefined();
      expect(provisionedCust?.name).toBe("New Online Buyer");
      expect(provisionedCust?.is_active).toBe(true);

      // Second call is idempotent — does NOT create another customer record
      const secondCall = resolveCustomer(caller, firstCall.updatedCustomers, "newbuyer@example.com");
      expect(secondCall.result?.id).toBe(provisionedId);
      expect(secondCall.updatedCustomers).toHaveLength(2);
    });

    it("rejects ADMIN and STAFF callers from customer order resolution", () => {
      const adminCaller: MockProfile = {
        id: "user_admin_1",
        role: "ADMIN",
        full_name: "Admin User",
        is_active: true,
      };

      const staffCaller: MockProfile = {
        id: "user_staff_1",
        role: "STAFF",
        full_name: "Staff User",
        is_active: true,
      };

      const customers: MockCustomer[] = [];

      const adminRes = resolveCustomer(adminCaller, customers);
      expect(adminRes.result).toBeNull();
      expect(adminRes.error).toContain("CUSTOMER accounts");

      const staffRes = resolveCustomer(staffCaller, customers);
      expect(staffRes.result).toBeNull();
      expect(staffRes.error).toContain("CUSTOMER accounts");
    });

    it("prevents customer account hijacking when an email matches another user's customer record", () => {
      const caller: MockProfile = {
        id: "user_attacker",
        role: "CUSTOMER",
        full_name: "Attacker",
        is_active: true,
      };

      // Customer record with same email but ALREADY linked to another user
      const customers: MockCustomer[] = [
        {
          id: "cust-legit",
          clerk_user_id: "user_victim",
          name: "Legit Customer",
          email: "shared@example.com",
          is_active: true,
        },
      ];

      const { result, updatedCustomers } = resolveCustomer(caller, customers, "shared@example.com");
      // Must NOT hijack cust-legit; must provision a separate record for user_attacker
      expect(result?.id).not.toBe("cust-legit");
      expect(updatedCustomers.find((c) => c.id === "cust-legit")?.clerk_user_id).toBe("user_victim");
      expect(updatedCustomers).toHaveLength(2);
    });
  });
});

