/**
 * POULTRY HUB — Customer Dashboard Financial Summary Calculations
 *
 * Rules:
 * 1. Total Purchases:
 *    - Invoiced sales from egg_sales (authoritative fulfilled orders, excluding CANCELLED).
 *    - Unfulfilled customer orders from customer_orders (quoted order lines, excluding CANCELLED).
 *    - Fulfilled orders with an associated invoice in egg_sales are deduplicated and counted
 *      only once using the authoritative invoice total_amount.
 * 2. Total Paid:
 *    - Official recorded payments from payments table (linked to egg_sales).
 *    - Verified customer payment submissions from customer_payment_submissions (status === 'VERIFIED').
 *    - Unverified (SUBMITTED, PENDING_SUBMISSION) and REJECTED/REFUNDED submissions are NEVER counted as paid.
 *    - Submissions on CANCELLED orders are excluded.
 *    - Submissions on orders whose linked invoice already has an official ledger payment are deduplicated.
 * 3. Remaining Balance:
 *    - Math.max(0, totalPurchases - totalPaid) (cannot be negative).
 * 4. Recorded Orders Count:
 *    - Non-cancelled invoices + non-cancelled unfulfilled orders.
 */

export interface SummaryPurchaseInput {
  id: string;
  total_amount: number;
  status: string;
}

export interface SummaryOrderItemInput {
  package_quantity: number;
  quoted_unit_price: number;
}

export interface SummaryOrderInput {
  id: string;
  status: string;
  sale_id: string | null;
  items?: SummaryOrderItemInput[];
}

export interface SummaryLedgerPaymentInput {
  sale_id: string;
  amount: number;
}

export interface SummaryPaymentSubmissionInput {
  order_id: string;
  declared_amount: number | null;
  status: string;
}

export interface CustomerFinancialSummaryResult {
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  orderCount: number;
}

export function calculateCustomerFinancialSummary({
  purchases,
  orders,
  ledgerPayments,
  paymentSubmissions,
}: {
  purchases: SummaryPurchaseInput[];
  orders: SummaryOrderInput[];
  ledgerPayments: SummaryLedgerPaymentInput[];
  paymentSubmissions: SummaryPaymentSubmissionInput[];
}): CustomerFinancialSummaryResult {
  // 1. Valid sales invoices from egg_sales (authoritative fulfilled orders)
  const validPurchases = purchases.filter((p) => p.status !== "CANCELLED");
  const invoiceSaleIds = new Set(validPurchases.map((p) => p.id));
  const totalFromInvoices = validPurchases.reduce(
    (sum, p) => sum + (Number(p.total_amount) || 0),
    0
  );

  // 2. Unfulfilled orders from customer_orders
  // Exclude cancelled orders
  // Exclude orders whose corresponding invoice is already in validPurchases
  const validUnfulfilledOrders = orders.filter((o) => {
    if (o.status === "CANCELLED") return false;
    if (o.sale_id && invoiceSaleIds.has(o.sale_id)) return false;
    return true;
  });

  const totalFromOrders = validUnfulfilledOrders.reduce((sum, o) => {
    const orderTotal = (o.items ?? []).reduce(
      (itemSum, item) =>
        itemSum +
        (Number(item.package_quantity) || 0) * (Number(item.quoted_unit_price) || 0),
      0
    );
    return sum + orderTotal;
  }, 0);

  const totalPurchases = Number((totalFromInvoices + totalFromOrders).toFixed(2));

  // 3. Total Paid: Actual official ledger payments + verified customer payment submissions
  const totalLedgerPaid = ledgerPayments.reduce(
    (sum, pay) => sum + (Number(pay.amount) || 0),
    0
  );

  // Track which sales already have recorded ledger payments
  const salesWithLedgerPayments = new Set(ledgerPayments.map((p) => p.sale_id));

  // Map order_id to sale_id for orders that were fulfilled
  const orderToSaleMap = new Map(
    orders.filter((o) => o.sale_id).map((o) => [o.id, o.sale_id!])
  );
  const cancelledOrderIds = new Set(
    orders.filter((o) => o.status === "CANCELLED").map((o) => o.id)
  );

  // Verified submissions: status must be strictly 'VERIFIED'
  // Exclude submissions on cancelled orders
  // Exclude submissions where official ledger payment already exists for the linked sale
  const totalVerifiedSubmissions = paymentSubmissions
    .filter((s) => {
      if (s.status !== "VERIFIED") return false;
      if (cancelledOrderIds.has(s.order_id)) return false;
      const linkedSaleId = orderToSaleMap.get(s.order_id);
      if (linkedSaleId && salesWithLedgerPayments.has(linkedSaleId)) return false;
      return true;
    })
    .reduce((sum, s) => sum + (Number(s.declared_amount) || 0), 0);

  const totalPaid = Number((totalLedgerPaid + totalVerifiedSubmissions).toFixed(2));

  // 4. Remaining Balance: purchase obligations minus verified payments (floor at 0)
  const outstandingBalance = Math.max(0, Number((totalPurchases - totalPaid).toFixed(2)));

  // 5. Total Order Count: non-cancelled invoices + non-cancelled unfulfilled orders
  const orderCount = validPurchases.length + validUnfulfilledOrders.length;

  return {
    totalPurchases,
    totalPaid,
    outstandingBalance,
    orderCount,
  };
}
