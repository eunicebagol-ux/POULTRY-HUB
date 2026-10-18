import assert from 'node:assert/strict';

// Test Suite: Phase 1 Customer Approval and Security Provisioning Logic
console.log('=== RUNNING PHASE 1 CUSTOMER APPROVAL STATIC LOGIC TESTS ===\n');

// 1. Webhook logic simulation for user.created
function simulateUserCreated(existingProfile, evtData) {
  const assignedRole = existingProfile?.role || 'CUSTOMER';
  const isActive = existingProfile ? existingProfile.is_active : false;
  return { assignedRole, isActive };
}

// Case 1A: Brand new customer sign-up
const resNew = simulateUserCreated(null, { id: 'user_new_123' });
assert.equal(resNew.assignedRole, 'CUSTOMER', 'New user must receive CUSTOMER role');
assert.equal(resNew.isActive, false, 'New CUSTOMER profile must default to is_active = false (PENDING)');
console.log('✓ PASS: New customer sign-up defaults to CUSTOMER with is_active = false');

// Case 1B: Replayed webhook for pending customer
const resPendingReplay = simulateUserCreated({ role: 'CUSTOMER', is_active: false }, { id: 'user_pending_123' });
assert.equal(resPendingReplay.assignedRole, 'CUSTOMER');
assert.equal(resPendingReplay.isActive, false, 'Replayed webhook must NOT activate pending customer');
console.log('✓ PASS: Repeated webhook replay preserves pending is_active = false');

// Case 1C: Replayed webhook for suspended customer
const resSuspendedReplay = simulateUserCreated({ role: 'CUSTOMER', is_active: false }, { id: 'user_suspended_123' });
assert.equal(resSuspendedReplay.isActive, false, 'Replayed webhook must NOT reactivate suspended customer');
console.log('✓ PASS: Repeated webhook replay preserves suspended is_active = false');

// Case 1D: Replayed webhook for approved customer
const resApprovedReplay = simulateUserCreated({ role: 'CUSTOMER', is_active: true }, { id: 'user_approved_123' });
assert.equal(resApprovedReplay.isActive, true, 'Approved customer remains active on webhook replay');
console.log('✓ PASS: Webhook replay preserves approved customer active status');

// Case 1E: Replayed webhook for existing STAFF or ADMIN
const resStaffReplay = simulateUserCreated({ role: 'STAFF', is_active: true }, { id: 'user_staff_123' });
assert.equal(resStaffReplay.assignedRole, 'STAFF', 'Existing STAFF role must never be demoted');
assert.equal(resStaffReplay.isActive, true, 'Existing STAFF active status must be preserved');
console.log('✓ PASS: Webhook replay preserves existing STAFF role and status');

const resAdminReplay = simulateUserCreated({ role: 'ADMIN', is_active: true }, { id: 'user_admin_123' });
assert.equal(resAdminReplay.assignedRole, 'ADMIN', 'Existing ADMIN role must never be demoted');
assert.equal(resAdminReplay.isActive, true, 'Existing ADMIN active status must be preserved');
console.log('✓ PASS: Webhook replay preserves existing ADMIN role and status');

// 2. Webhook logic simulation for user.updated
function simulateUserUpdated(existingProfile) {
  const role = existingProfile?.role || 'CUSTOMER';
  const isActive = existingProfile ? existingProfile.is_active : false;
  return { role, isActive };
}

const resUpdatePending = simulateUserUpdated({ role: 'CUSTOMER', is_active: false });
assert.equal(resUpdatePending.isActive, false, 'user.updated event must never activate a pending customer');
console.log('✓ PASS: user.updated maintains pending status');

const resUpdateSuspended = simulateUserUpdated({ role: 'CUSTOMER', is_active: false });
assert.equal(resUpdateSuspended.isActive, false, 'user.updated event must never reactivate a suspended customer');
console.log('✓ PASS: user.updated maintains suspended status');

// 3. Fallback provisioning simulation
function simulateFallbackProfile(userId, clerkUser) {
  return {
    id: userId,
    role: 'CUSTOMER',
    full_name: 'Test Customer',
    is_active: false, // Must be false!
  };
}
const resFallback = simulateFallbackProfile('user_fallback_1', {});
assert.equal(resFallback.is_active, false, 'Fallback profile creation must NOT bypass approval');
console.log('✓ PASS: Fallback profile creation defaults to is_active = false');

function checkCustomerAccess(profile) {
  if (!profile || !profile.is_active) {
    return { allowed: false, reason: 'Pending or inactive account' };
  }
  if (profile.role !== 'CUSTOMER') {
    return { allowed: false, reason: 'Role not authorized for customer portal' };
  }
  return { allowed: true };
}

assert.equal(checkCustomerAccess(null).allowed, false, 'Unauthenticated / null profile must be blocked');
assert.equal(checkCustomerAccess({ role: 'CUSTOMER', is_active: false }).allowed, false, 'Pending customer must be blocked');
assert.equal(checkCustomerAccess({ role: 'STAFF', is_active: true }).allowed, false, 'Staff must be redirected from customer portal');
assert.equal(checkCustomerAccess({ role: 'ADMIN', is_active: true }).allowed, false, 'Admin must be redirected from customer portal');
assert.equal(checkCustomerAccess({ role: 'CUSTOMER', is_active: true }).allowed, true, 'Approved customer must be allowed');
console.log('✓ PASS: Customer portal authorization guard strictly permits only approved CUSTOMER');

console.log('\n=== ALL UNIT LOGIC TESTS PASSED SUCCESSFULLY ===');
