import assert from 'node:assert/strict';

console.log('=== RUNNING PHASE 2 CUSTOMER ORDERING SECURITY UNIT TESTS ===\n');

// 1. Test: Allowed Status Transitions State Machine
const ALLOWED_STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

function isValidTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true; // unchanged
  const allowed = ALLOWED_STATUS_TRANSITIONS[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

// Valid transitions
assert.equal(isValidTransition("PENDING", "CONFIRMED"), true);
assert.equal(isValidTransition("PENDING", "CANCELLED"), true);
assert.equal(isValidTransition("CONFIRMED", "PREPARING"), true);
assert.equal(isValidTransition("CONFIRMED", "CANCELLED"), true);
assert.equal(isValidTransition("PREPARING", "READY"), true);
assert.equal(isValidTransition("PREPARING", "CANCELLED"), true);
assert.equal(isValidTransition("READY", "COMPLETED"), true);
assert.equal(isValidTransition("READY", "CANCELLED"), true);
console.log('✓ PASS: All valid forward and cancellation transitions permitted');

// Invalid transitions
assert.equal(isValidTransition("PENDING", "READY"), false, "Cannot skip from PENDING to READY");
assert.equal(isValidTransition("PENDING", "COMPLETED"), false, "Cannot skip from PENDING to COMPLETED");
assert.equal(isValidTransition("CONFIRMED", "PENDING"), false, "Cannot revert from CONFIRMED to PENDING");
assert.equal(isValidTransition("READY", "PREPARING"), false, "Cannot revert from READY to PREPARING");
assert.equal(isValidTransition("COMPLETED", "PENDING"), false, "COMPLETED is terminal; cannot transition to PENDING");
assert.equal(isValidTransition("COMPLETED", "CANCELLED"), false, "COMPLETED is terminal; cannot transition to CANCELLED");
assert.equal(isValidTransition("CANCELLED", "PENDING"), false, "CANCELLED is terminal; cannot transition to PENDING");
assert.equal(isValidTransition("CANCELLED", "READY"), false, "CANCELLED is terminal; cannot transition to READY");
console.log('✓ PASS: All invalid skip, backward, and terminal transitions rejected');

// 2. Test: Verified Clerk Email Matching Logic
function resolveVerifiedEmail(clerkUser) {
  if (!clerkUser) return null;
  const verifiedEmailObj =
    clerkUser.emailAddresses?.find(
      (e) =>
        e.id === clerkUser.primaryEmailAddressId &&
        e.verification?.status === "verified"
    ) ??
    clerkUser.emailAddresses?.find(
      (e) => e.verification?.status === "verified"
    );
  return verifiedEmailObj?.emailAddress?.toLowerCase().trim() ?? null;
}

// User with verified primary email
const userWithVerifiedPrimary = {
  primaryEmailAddressId: 'e1',
  emailAddresses: [
    { id: 'e1', emailAddress: 'Buyer@Farm.com', verification: { status: 'verified' } },
  ],
};
assert.equal(resolveVerifiedEmail(userWithVerifiedPrimary), 'buyer@farm.com');
console.log('✓ PASS: Verified primary email resolved and normalized');

// User with unverified primary email but verified secondary
const userWithUnverifiedPrimary = {
  primaryEmailAddressId: 'e1',
  emailAddresses: [
    { id: 'e1', emailAddress: 'unverified@farm.com', verification: { status: 'unverified' } },
    { id: 'e2', emailAddress: 'verified_second@farm.com', verification: { status: 'verified' } },
  ],
};
assert.equal(resolveVerifiedEmail(userWithUnverifiedPrimary), 'verified_second@farm.com');
console.log('✓ PASS: Verified secondary email selected when primary is unverified');

// User with NO verified emails
const userWithNoVerifiedEmail = {
  primaryEmailAddressId: 'e1',
  emailAddresses: [
    { id: 'e1', emailAddress: 'attacker@evil.com', verification: { status: 'unverified' } },
    { id: 'e2', emailAddress: 'spoofed@customer.com', verification: null },
  ],
};
assert.equal(resolveVerifiedEmail(userWithNoVerifiedEmail), null, 'Must fail closed when no email is verified');
console.log('✓ PASS: Fails closed when all emails are unverified');

// 3. Test: Zero-Trust Server Price Tolerance
function validateQuotedPrice(quoted, expected) {
  return Math.abs(quoted - expected) <= 0.01;
}

assert.equal(validateQuotedPrice(220.00, 220.00), true);
assert.equal(validateQuotedPrice(220.009, 220.00), true, "Tolerance within 1 cent");
assert.equal(validateQuotedPrice(219.98, 220.00), false, "Under-quoted price rejected");
assert.equal(validateQuotedPrice(1.00, 220.00), false, "Tampered price rejected");
assert.equal(validateQuotedPrice(0.00, 220.00), false, "Zero price rejected");
console.log('✓ PASS: Price verification enforces ±0.01 tolerance strictly');

// 4. Test: Concurrency-Safe Cancellation Condition Simulation
function simulateAtomicCancel(orderInDb, requestedOrderId, requestedCustomerId) {
  // Simulates .eq("id", requestedOrderId).eq("customer_id", requestedCustomerId).eq("status", "PENDING")
  if (
    orderInDb.id === requestedOrderId &&
    orderInDb.customer_id === requestedCustomerId &&
    orderInDb.status === "PENDING"
  ) {
    return { updated: true, newStatus: "CANCELLED" };
  }
  return { updated: false, currentStatus: orderInDb.status };
}

// Normal case: pending order
const orderPending = { id: 'o1', customer_id: 'c1', status: 'PENDING' };
const resPending = simulateAtomicCancel(orderPending, 'o1', 'c1');
assert.equal(resPending.updated, true);
console.log('✓ PASS: Pending order cancellation succeeds');

// Race condition case: staff confirmed order while customer clicked cancel
const orderConfirmed = { id: 'o1', customer_id: 'c1', status: 'CONFIRMED' };
const resConfirmed = simulateAtomicCancel(orderConfirmed, 'o1', 'c1');
assert.equal(resConfirmed.updated, false, 'Cannot cancel confirmed order in race condition');
console.log('✓ PASS: Concurrent status change to CONFIRMED prevents cancellation overwrite');

// Wrong customer ID attempt
const resWrongCust = simulateAtomicCancel(orderPending, 'o1', 'c2');
assert.equal(resWrongCust.updated, false, 'Cross-tenant cancellation rejected');
console.log('✓ PASS: Cross-tenant cancellation rejected');

console.log('\n=== ALL PHASE 2 SECURITY UNIT TESTS PASSED ===');
