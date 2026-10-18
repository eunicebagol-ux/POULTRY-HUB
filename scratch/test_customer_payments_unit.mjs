import assert from 'node:assert/strict';
import { z } from 'zod';

console.log('=== RUNNING CUSTOMER PAYMENT METHODS UNIT TESTS ===\n');

// ─── 1. ZOD SCHEMAS (mirrored from src/lib/validations/customer-payments.ts) ──

const CUSTOMER_PAYMENT_METHOD_VALUES = [
  "GCASH",
  "BANK_TRANSFER",
  "CASH_ON_DELIVERY",
];

const submitPaymentSubmissionSchema = z
  .object({
    order_id: z.string().uuid("Invalid order ID."),
    payment_method: z.enum(CUSTOMER_PAYMENT_METHOD_VALUES, {
      message: "Please select a valid payment method.",
    }),
    declared_amount: z
      .number({ message: "Amount must be a number." })
      .finite("Declared amount must be a finite number.")
      .positive("Declared amount must be greater than zero.")
      .max(9_999_999, "Amount exceeds allowed maximum.")
      .optional(),
    reference_number: z
      .string()
      .trim()
      .max(200, "Reference number must be at most 200 characters.")
      .optional()
      .or(z.literal("")),
    customer_notes: z
      .string()
      .trim()
      .max(500, "Notes must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (
        (data.payment_method === "GCASH" ||
          data.payment_method === "BANK_TRANSFER") &&
        !data.reference_number?.trim()
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "A transaction reference number is required for GCash and Bank Transfer payments.",
      path: ["reference_number"],
    }
  );

const verifyPaymentSubmissionSchema = z.object({
  submission_id: z.string().uuid("Invalid submission ID."),
  action: z.enum(["VERIFY", "REJECT"], {
    message: "Action must be VERIFY or REJECT.",
  }),
  verification_notes: z
    .string()
    .trim()
    .max(500, "Verification notes must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
  rejection_reason: z
    .string()
    .trim()
    .max(500, "Rejection reason must be at most 500 characters.")
    .optional()
    .or(z.literal("")),
});

// ─── TEST 1: GCash Reference Number Requirement ───

const validUuid = "123e4567-e89b-12d3-a456-426614174000";

// GCash with valid ref
const gcashValid = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "GCASH",
  reference_number: "GCASH-987654321",
  declared_amount: 1500.5,
});
assert.equal(gcashValid.success, true);
console.log('✓ PASS: GCash with valid reference number passes validation');

// GCash without ref
const gcashNoRef = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "GCASH",
  reference_number: "",
  declared_amount: 1500.5,
});
assert.equal(gcashNoRef.success, false);
console.log('✓ PASS: GCash with empty reference number rejected');

const gcashWhitespaceRef = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "GCASH",
  reference_number: "   ",
  declared_amount: 1500.5,
});
assert.equal(gcashWhitespaceRef.success, false);
console.log('✓ PASS: GCash with whitespace reference number rejected');

// ─── TEST 2: Bank Transfer Reference Number Requirement ───

const bankValid = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "BANK_TRANSFER",
  reference_number: "BDO-TXN-112233",
  declared_amount: 3200,
});
assert.equal(bankValid.success, true);
console.log('✓ PASS: Bank Transfer with valid reference number passes validation');

const bankNoRef = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "BANK_TRANSFER",
  reference_number: "",
  declared_amount: 3200,
});
assert.equal(bankNoRef.success, false);
console.log('✓ PASS: Bank Transfer without reference number rejected');

// ─── TEST 3: Cash On Delivery Does NOT Require Reference Number ───

const codWithoutRef = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  customer_notes: "Please deliver in the morning",
});
assert.equal(codWithoutRef.success, true);
console.log('✓ PASS: Cash on Delivery without reference number passes validation');

const codWithRef = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  reference_number: "OPTIONAL-NOTE",
});
assert.equal(codWithRef.success, true);
console.log('✓ PASS: Cash on Delivery with reference number also passes validation');

// ─── TEST 4: Invalid Payment Method Rejected ───

const invalidMethod = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "PAYPAL",
  reference_number: "REF123",
});
assert.equal(invalidMethod.success, false);
console.log('✓ PASS: Unsupported payment method rejected');

// ─── TEST 5: Declared Amount Boundaries ───

const negativeAmount = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: -50,
});
assert.equal(negativeAmount.success, false);
console.log('✓ PASS: Negative declared amount rejected');

const zeroAmount = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: 0,
});
assert.equal(zeroAmount.success, false);
console.log('✓ PASS: Zero declared amount rejected');

const excessiveAmount = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: 10_000_000,
});
assert.equal(excessiveAmount.success, false);
console.log('✓ PASS: Excessive declared amount rejected');

// ─── TEST 6: Staff Verification Schema ───

const validVerify = verifyPaymentSubmissionSchema.safeParse({
  submission_id: validUuid,
  action: "VERIFY",
  verification_notes: "Matched GCash transaction on merchant phone",
});
assert.equal(validVerify.success, true);
console.log('✓ PASS: Valid VERIFY action passes validation');

const validReject = verifyPaymentSubmissionSchema.safeParse({
  submission_id: validUuid,
  action: "REJECT",
  rejection_reason: "Reference number not found in GCash merchant history",
});
assert.equal(validReject.success, true);
console.log('✓ PASS: Valid REJECT action passes validation');

const invalidAction = verifyPaymentSubmissionSchema.safeParse({
  submission_id: validUuid,
  action: "APPROVE", // invalid enum value
});
assert.equal(invalidAction.success, false);
console.log('✓ PASS: Invalid action rejected');

// ─── TEST 7: Order Status Gating for Payment Submission ───

const ALLOWED_PAYMENT_ORDER_STATUSES = ["CONFIRMED", "PREPARING", "READY"];

function canSubmitPaymentForOrder(orderStatus) {
  return ALLOWED_PAYMENT_ORDER_STATUSES.includes(orderStatus);
}

assert.equal(canSubmitPaymentForOrder("PENDING"), false, "PENDING orders cannot accept payment before farm confirmation");
assert.equal(canSubmitPaymentForOrder("CONFIRMED"), true, "CONFIRMED orders can accept payment");
assert.equal(canSubmitPaymentForOrder("PREPARING"), true, "PREPARING orders can accept payment");
assert.equal(canSubmitPaymentForOrder("READY"), true, "READY orders can accept payment");
assert.equal(canSubmitPaymentForOrder("COMPLETED"), false, "COMPLETED orders cannot accept new payments");
assert.equal(canSubmitPaymentForOrder("CANCELLED"), false, "CANCELLED orders cannot accept payments");
console.log('✓ PASS: Order status gating correctly enforces CONFIRMED, PREPARING, and READY only');

// ─── TEST 8: Duplicate Payment Protection ───

function canSubmitNewPayment(existingSubmissions) {
  // Can only submit if there are NO active (non-REJECTED) submissions
  const activeSubmissions = existingSubmissions.filter(s => s.status !== "REJECTED");
  return activeSubmissions.length === 0;
}

assert.equal(canSubmitNewPayment([]), true, "No prior submissions allows new submission");
assert.equal(canSubmitNewPayment([{ status: "SUBMITTED" }]), false, "Active SUBMITTED prevents duplicate submission");
assert.equal(canSubmitNewPayment([{ status: "VERIFIED" }]), false, "Active VERIFIED prevents duplicate submission");
assert.equal(canSubmitNewPayment([{ status: "REJECTED" }]), true, "Prior REJECTED allows retry submission");
console.log('✓ PASS: Duplicate payment protection permits retry after rejection while blocking duplicate active payments');

// ─── TEST 9: Role-Based Verification Restriction ───

function canVerifyPayment(userRole, userIsActive) {
  if (!userIsActive) return false;
  return userRole === "STAFF" || userRole === "ADMIN";
}

assert.equal(canVerifyPayment("CUSTOMER", true), false, "Active CUSTOMER cannot verify payment");
assert.equal(canVerifyPayment("STAFF", true), true, "Active STAFF can verify payment");
assert.equal(canVerifyPayment("ADMIN", true), true, "Active ADMIN can verify payment");
assert.equal(canVerifyPayment("STAFF", false), false, "Inactive STAFF cannot verify payment");
assert.equal(canVerifyPayment("ADMIN", false), false, "Inactive ADMIN cannot verify payment");
console.log('✓ PASS: Only active STAFF and ADMIN can verify payments; customers strictly forbidden');

// ─── TEST 10: Finite Number Validation (NaN, Infinity, -Infinity) ───

const nanTest = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: NaN,
});
assert.equal(nanTest.success, false, "NaN declared amount rejected");

const infTest = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: Infinity,
});
assert.equal(infTest.success, false, "Infinity declared amount rejected");

const negInfTest = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: -Infinity,
});
assert.equal(negInfTest.success, false, "-Infinity declared amount rejected");

const validFiniteAmount = submitPaymentSubmissionSchema.safeParse({
  order_id: validUuid,
  payment_method: "CASH_ON_DELIVERY",
  declared_amount: 1450.75,
});
assert.equal(validFiniteAmount.success, true, "Valid positive finite amount accepted");
console.log('✓ PASS: Finite number validation rejects NaN, Infinity, -Infinity and accepts valid floats');

// ─── TEST 11: Server-Side Strict Numeric Guard ───

function validateDeclaredAmountRuntime(declared_amount) {
  if (declared_amount === undefined || declared_amount === null) {
    return { valid: true };
  }
  if (
    typeof declared_amount !== "number" ||
    !Number.isFinite(declared_amount) ||
    Number.isNaN(declared_amount) ||
    declared_amount <= 0 ||
    declared_amount > 9_999_999
  ) {
    return {
      valid: false,
      error: "Declared amount must be a valid positive number up to 9,999,999.",
    };
  }
  return { valid: true };
}

assert.equal(validateDeclaredAmountRuntime(undefined).valid, true);
assert.equal(validateDeclaredAmountRuntime(null).valid, true);
assert.equal(validateDeclaredAmountRuntime(2500).valid, true);
assert.equal(validateDeclaredAmountRuntime("2500").valid, false);
assert.equal(validateDeclaredAmountRuntime(0).valid, false);
assert.equal(validateDeclaredAmountRuntime(-10).valid, false);
assert.equal(validateDeclaredAmountRuntime(NaN).valid, false);
assert.equal(validateDeclaredAmountRuntime(Infinity).valid, false);
assert.equal(validateDeclaredAmountRuntime(10_000_000).valid, false);
console.log('✓ PASS: Server-side runtime guard strictly enforces valid finite positive numbers');

// ─── TEST 12: Server-Side Trusted Estimated Total Computation ───

function calculateTrustedEstimatedTotal(rawOrderItems) {
  const items = rawOrderItems ?? [];
  return items.reduce((sum, item) => {
    const qty = Number(item.package_quantity) || 0;
    const price = Number(item.quoted_unit_price) || 0;
    return sum + qty * price;
  }, 0);
}

const mockOrderItems = [
  { package_quantity: 10, quoted_unit_price: 220.00 }, // 2200
  { package_quantity: 5, quoted_unit_price: "240.50" }, // 1202.50
];
const computedTotal = calculateTrustedEstimatedTotal(mockOrderItems);
assert.equal(computedTotal, 3402.50, "Computed total must sum all items accurately");
assert.equal(calculateTrustedEstimatedTotal([]), 0, "Empty items array produces 0 total");
assert.equal(calculateTrustedEstimatedTotal(null), 0, "Null items array produces 0 total");
console.log('✓ PASS: Server-side calculation computes trusted estimated total from order items');

// ─── TEST 13: Amount Mismatch Detection Logic ───

function detectAmountMismatch(declaredAmount, estimatedTotal) {
  if (declaredAmount === null || declaredAmount === undefined || estimatedTotal === undefined) {
    return false;
  }
  return Math.abs(declaredAmount - estimatedTotal) > 0.01;
}

assert.equal(detectAmountMismatch(3402.50, 3402.50), false, "Exact match has no mismatch");
assert.equal(detectAmountMismatch(3402.501, 3402.50), false, "Within 1 cent has no mismatch");
assert.equal(detectAmountMismatch(3400.00, 3402.50), true, "Discrepancy is flagged");
assert.equal(detectAmountMismatch(1.00, 3402.50), true, "Tampered declared amount is flagged");
assert.equal(detectAmountMismatch(null, 3402.50), false, "No declared amount has no mismatch flag");
console.log('✓ PASS: Amount mismatch detection correctly distinguishes matching vs discrepancies');

// ─── TEST 14: Postgres Unique Constraint (23505) Error Handling ───

function handleInsertError(insertErr) {
  if (!insertErr) return { success: true };
  if (insertErr.code === "23505") {
    return {
      success: false,
      error: "This order already has an active payment submission. Please contact the farm team if you need to make changes.",
    };
  }
  return { success: false, error: insertErr.message || "Insert failed" };
}

const simulatedUniqueErr = { code: "23505", message: "duplicate key value violates unique constraint" };
const handledUniqueRes = handleInsertError(simulatedUniqueErr);
assert.equal(handledUniqueRes.success, false);
assert.match(handledUniqueRes.error, /already has an active payment submission/);

const simulatedOtherErr = { code: "42P01", message: "table not found" };
const handledOtherRes = handleInsertError(simulatedOtherErr);
assert.equal(handledOtherRes.success, false);
assert.equal(handledOtherRes.error, "table not found");
console.log('✓ PASS: Postgres error code 23505 is caught and formatted as friendly active submission error');

// ─── TEST 15: DB CHECK Constraint Logic for Reference Number ───

function satisfiesDbReferenceCheck(payment_method, reference_number) {
  if (payment_method === "CASH_ON_DELIVERY") {
    return true;
  }
  return reference_number !== null && reference_number !== undefined && reference_number.trim() !== "";
}

assert.equal(satisfiesDbReferenceCheck("GCASH", "GC-12345"), true);
assert.equal(satisfiesDbReferenceCheck("GCASH", null), false);
assert.equal(satisfiesDbReferenceCheck("GCASH", ""), false);
assert.equal(satisfiesDbReferenceCheck("GCASH", "   "), false);
assert.equal(satisfiesDbReferenceCheck("BANK_TRANSFER", "BDO-999"), true);
assert.equal(satisfiesDbReferenceCheck("BANK_TRANSFER", ""), false);
assert.equal(satisfiesDbReferenceCheck("CASH_ON_DELIVERY", null), true);
assert.equal(satisfiesDbReferenceCheck("CASH_ON_DELIVERY", ""), true);
assert.equal(satisfiesDbReferenceCheck("CASH_ON_DELIVERY", "COD-REF"), true);
console.log('✓ PASS: DB CHECK constraint logic correctly requires reference number for digital methods only');

// ─── TEST 16: Physical Cash on Delivery Verification Safeguards ───

function requiresPhysicalCashWarning(payment_method, status) {
  return payment_method === "CASH_ON_DELIVERY" && status === "SUBMITTED";
}

assert.equal(requiresPhysicalCashWarning("CASH_ON_DELIVERY", "SUBMITTED"), true, "Pending COD requires physical cash warning");
assert.equal(requiresPhysicalCashWarning("CASH_ON_DELIVERY", "VERIFIED"), false, "Already verified COD does not require prompt");
assert.equal(requiresPhysicalCashWarning("GCASH", "SUBMITTED"), false, "GCash does not require physical cash warning");
assert.equal(requiresPhysicalCashWarning("BANK_TRANSFER", "SUBMITTED"), false, "Bank transfer does not require physical cash warning");
console.log('✓ PASS: Physical cash warning correctly triggers only for active Cash on Delivery submissions');

console.log('\n=== ALL 16 CUSTOMER PAYMENT METHODS UNIT TESTS PASSED ===');
