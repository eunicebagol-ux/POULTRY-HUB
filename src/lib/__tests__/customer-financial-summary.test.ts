import { describe, it, expect } from "vitest";
import {
  calculateCustomerFinancialSummary,
  type SummaryPurchaseInput,
  type SummaryOrderInput,
  type SummaryLedgerPaymentInput,
  type SummaryPaymentSubmissionInput,
} from "../customer-financial-summary";

describe("calculateCustomerFinancialSummary", () => {
  it("returns zeros when customer has no orders, purchases, or payments", () => {
    const summary = calculateCustomerFinancialSummary({
      purchases: [],
      orders: [],
      ledgerPayments: [],
      paymentSubmissions: [],
    });

    expect(summary).toEqual({
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      orderCount: 0,
    });
  });

  it("calculates Total Purchases correctly from unfulfilled orders", () => {
    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "CONFIRMED",
        sale_id: null,
        items: [
          { package_quantity: 1, quoted_unit_price: 240 },
        ],
      },
      {
        id: "ord-2",
        status: "PENDING",
        sale_id: null,
        items: [
          { package_quantity: 2, quoted_unit_price: 150 }, // 300
          { package_quantity: 1, quoted_unit_price: 90 },  // 90
        ],
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases: [],
      orders,
      ledgerPayments: [],
      paymentSubmissions: [],
    });

    expect(summary.totalPurchases).toBe(630); // 240 + 390
    expect(summary.totalPaid).toBe(0);
    expect(summary.outstandingBalance).toBe(630);
    expect(summary.orderCount).toBe(2);
  });

  it("excludes cancelled orders from Total Purchases and Remaining Balance", () => {
    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "CONFIRMED",
        sale_id: null,
        items: [{ package_quantity: 1, quoted_unit_price: 240 }],
      },
      {
        id: "ord-2",
        status: "CANCELLED",
        sale_id: null,
        items: [{ package_quantity: 2, quoted_unit_price: 200 }], // 400 (should be excluded)
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases: [],
      orders,
      ledgerPayments: [],
      paymentSubmissions: [],
    });

    expect(summary.totalPurchases).toBe(240);
    expect(summary.outstandingBalance).toBe(240);
    expect(summary.orderCount).toBe(1);
  });

  it("excludes cancelled sales invoices from Total Purchases and Remaining Balance", () => {
    const purchases: SummaryPurchaseInput[] = [
      { id: "sale-1", total_amount: 500, status: "COMPLETED" },
      { id: "sale-2", total_amount: 300, status: "CANCELLED" },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases,
      orders: [],
      ledgerPayments: [],
      paymentSubmissions: [],
    });

    expect(summary.totalPurchases).toBe(500);
    expect(summary.orderCount).toBe(1);
  });

  it("deduplicates fulfilled orders when invoice is already present in purchases", () => {
    const purchases: SummaryPurchaseInput[] = [
      { id: "sale-100", total_amount: 480, status: "COMPLETED" },
    ];

    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "COMPLETED",
        sale_id: "sale-100", // linked to invoice sale-100!
        items: [{ package_quantity: 2, quoted_unit_price: 240 }], // 480
      },
      {
        id: "ord-2",
        status: "CONFIRMED",
        sale_id: null,
        items: [{ package_quantity: 1, quoted_unit_price: 240 }], // 240
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases,
      orders,
      ledgerPayments: [],
      paymentSubmissions: [],
    });

    // Should count sale-100 once (480) + ord-2 (240) = 720, NOT 480 + 480 + 240
    expect(summary.totalPurchases).toBe(720);
    expect(summary.orderCount).toBe(2);
  });

  it("counts only verified payment submissions and ignores pending/submitted/rejected", () => {
    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "CONFIRMED",
        sale_id: null,
        items: [{ package_quantity: 1, quoted_unit_price: 240 }],
      },
      {
        id: "ord-2",
        status: "CONFIRMED",
        sale_id: null,
        items: [{ package_quantity: 1, quoted_unit_price: 240 }],
      },
    ];

    const paymentSubmissions: SummaryPaymentSubmissionInput[] = [
      {
        order_id: "ord-1",
        declared_amount: 240,
        status: "VERIFIED", // Verified -> counted!
      },
      {
        order_id: "ord-2",
        declared_amount: 240,
        status: "SUBMITTED", // Awaiting review -> NOT counted!
      },
      {
        order_id: "ord-3",
        declared_amount: 100,
        status: "REJECTED", // Rejected -> NOT counted!
      },
      {
        order_id: "ord-4",
        declared_amount: 100,
        status: "PENDING_SUBMISSION", // Pending -> NOT counted!
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases: [],
      orders,
      ledgerPayments: [],
      paymentSubmissions,
    });

    expect(summary.totalPurchases).toBe(480);
    expect(summary.totalPaid).toBe(240); // Only ord-1 verified submission
    expect(summary.outstandingBalance).toBe(240); // 480 - 240
  });

  it("ignores verified payment submissions on cancelled orders", () => {
    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "CANCELLED",
        sale_id: null,
        items: [{ package_quantity: 1, quoted_unit_price: 240 }],
      },
    ];

    const paymentSubmissions: SummaryPaymentSubmissionInput[] = [
      {
        order_id: "ord-1",
        declared_amount: 240,
        status: "VERIFIED",
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases: [],
      orders,
      ledgerPayments: [],
      paymentSubmissions,
    });

    expect(summary.totalPurchases).toBe(0);
    expect(summary.totalPaid).toBe(0);
    expect(summary.outstandingBalance).toBe(0);
  });

  it("prevents duplicate payment counting between ledger payments and verified submissions", () => {
    const purchases: SummaryPurchaseInput[] = [
      { id: "sale-100", total_amount: 500, status: "COMPLETED" },
    ];

    const orders: SummaryOrderInput[] = [
      {
        id: "ord-1",
        status: "COMPLETED",
        sale_id: "sale-100",
        items: [{ package_quantity: 2, quoted_unit_price: 250 }],
      },
    ];

    const ledgerPayments: SummaryLedgerPaymentInput[] = [
      { sale_id: "sale-100", amount: 500 },
    ];

    const paymentSubmissions: SummaryPaymentSubmissionInput[] = [
      {
        order_id: "ord-1", // customer submitted proof that was verified
        declared_amount: 500,
        status: "VERIFIED",
      },
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases,
      orders,
      ledgerPayments,
      paymentSubmissions,
    });

    expect(summary.totalPurchases).toBe(500);
    // Should NOT be 1000 (500 ledger + 500 submission). Must be 500!
    expect(summary.totalPaid).toBe(500);
    expect(summary.outstandingBalance).toBe(0);
  });

  it("floors Remaining Balance at 0 if payments exceed purchases", () => {
    const purchases: SummaryPurchaseInput[] = [
      { id: "sale-1", total_amount: 200, status: "COMPLETED" },
    ];

    const ledgerPayments: SummaryLedgerPaymentInput[] = [
      { sale_id: "sale-1", amount: 250 }, // overpayment
    ];

    const summary = calculateCustomerFinancialSummary({
      purchases,
      orders: [],
      ledgerPayments,
      paymentSubmissions: [],
    });

    expect(summary.totalPurchases).toBe(200);
    expect(summary.totalPaid).toBe(250);
    expect(summary.outstandingBalance).toBe(0); // Never negative
  });
});
