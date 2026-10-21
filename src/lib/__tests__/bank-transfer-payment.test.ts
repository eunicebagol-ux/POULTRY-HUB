import { describe, it, expect } from "vitest";
import {
  createBankTransferAccountSchema,
  updateBankTransferAccountSchema,
} from "../validations/bank-transfer-accounts";
import { submitCustomerOrderSchema } from "../validations/customer-orders";
import {
  submitPaymentSubmissionSchema,
  verifyPaymentSubmissionSchema,
} from "../validations/customer-payments";

describe("Bank Transfer Accounts & Payment Validation", () => {
  const validUUIDv4 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  describe("createBankTransferAccountSchema", () => {
    it("accepts valid bank account with predefined bank", () => {
      const valid = {
        bank_name_select: "BDO",
        account_holder_name: "POULTRY HUB Farms Inc.",
        account_number: "0012-3456-7890",
        instructions: "Please send via Instapay or Pesonet and upload screenshot",
        is_active: true,
        display_order: 1,
      };

      const result = createBankTransferAccountSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("accepts valid bank account with 'Other' and custom bank name", () => {
      const validCustom = {
        bank_name_select: "Other",
        custom_bank_name: "Maya Bank",
        account_holder_name: "POULTRY HUB Farms Inc.",
        account_number: "123456789012",
        is_active: true,
        display_order: 2,
      };

      const result = createBankTransferAccountSchema.safeParse(validCustom);
      expect(result.success).toBe(true);
    });

    it("rejects 'Other' bank selection when custom bank name is missing or too short", () => {
      const invalidCustom = {
        bank_name_select: "Other",
        custom_bank_name: "A",
        account_holder_name: "POULTRY HUB",
        account_number: "123456789012",
      };

      const result = createBankTransferAccountSchema.safeParse(invalidCustom);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("custom_bank_name"))).toBe(true);
      }
    });

    it("rejects account number with invalid special characters", () => {
      const invalidAcc = {
        bank_name_select: "BPI",
        account_holder_name: "POULTRY HUB",
        account_number: "1234$5678#90",
      };

      const result = createBankTransferAccountSchema.safeParse(invalidAcc);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("account_number"))).toBe(true);
      }
    });
  });

  describe("updateBankTransferAccountSchema", () => {
    it("accepts valid update payload with valid UUID and bank details", () => {
      const validUpdate = {
        id: validUUIDv4,
        bank_name_select: "Metrobank" as const,
        account_holder_name: "POULTRY HUB Farm",
        account_number: "9876-5432-1098",
        instructions: "Please send payment via Instapay",
        is_active: true,
        display_order: 1,
      };

      const result = updateBankTransferAccountSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it("rejects update payload with invalid UUID", () => {
      const invalidUpdate = {
        id: "not-a-uuid",
        bank_name_select: "BDO" as const,
        account_holder_name: "POULTRY HUB",
        account_number: "1234567890",
      };

      const result = updateBankTransferAccountSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });

  describe("submitCustomerOrderSchema with BANK_TRANSFER", () => {
    const validBaseOrder = {
      fulfillment_method: "DELIVERY" as const,
      payment_method: "BANK_TRANSFER" as const,
      requested_date: "2026-11-01",
      delivery_barangay: "Ampayon",
      delivery_address: "Purok 3, Main Highway",
      items: [
        {
          size: "LARGE" as const,
          packaging: "TRAY_30" as const,
          package_quantity: 2,
          quoted_unit_price: 210,
        },
      ],
      payment_bank_name: "BDO",
      payment_sender_name: "Juan Dela Cruz",
      payment_reference: "TXN-9876543210",
      payment_date: "2026-11-01",
      payment_amount: 420,
      payment_bank_transfer_account_id: validUUIDv4,
      payment_receipt_url: "https://example.com/receipt.jpg",
    };

    it("accepts a fully filled Bank Transfer checkout order", () => {
      const result = submitCustomerOrderSchema.safeParse(validBaseOrder);
      expect(result.success).toBe(true);
    });

    it("rejects Bank Transfer if sender bank name is missing", () => {
      const invalid = {
        ...validBaseOrder,
        payment_bank_name: "",
      };

      const result = submitCustomerOrderSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_bank_name"))).toBe(true);
      }
    });

    it("rejects Bank Transfer if sender name is missing", () => {
      const invalid = {
        ...validBaseOrder,
        payment_sender_name: "",
      };

      const result = submitCustomerOrderSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_sender_name"))).toBe(true);
      }
    });

    it("rejects Bank Transfer if reference number is missing", () => {
      const invalid = {
        ...validBaseOrder,
        payment_reference: "",
      };

      const result = submitCustomerOrderSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_reference"))).toBe(true);
      }
    });

    it("rejects Bank Transfer if payment amount is zero or negative", () => {
      const invalid = {
        ...validBaseOrder,
        payment_amount: 0,
      };

      const result = submitCustomerOrderSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("payment_amount"))).toBe(true);
      }
    });
  });

  describe("submitPaymentSubmissionSchema with BANK_TRANSFER", () => {
    it("accepts a valid bank transfer submission after order confirmation", () => {
      const validSubmission = {
        order_id: validUUIDv4,
        payment_method: "BANK_TRANSFER" as const,
        declared_amount: 500,
        reference_number: "BDO-REF-12345678",
        bank_name: "BDO",
        sender_name: "Juan Dela Cruz",
        payment_date: "2026-11-01",
        bank_transfer_account_id: validUUIDv4,
        receipt_url: "https://example.com/proof.jpg",
      };

      const result = submitPaymentSubmissionSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);
    });

    it("rejects bank transfer submission when bank_name is missing", () => {
      const invalid = {
        order_id: validUUIDv4,
        payment_method: "BANK_TRANSFER" as const,
        reference_number: "REF-123",
        sender_name: "Juan Dela Cruz",
        bank_name: "",
      };

      const result = submitPaymentSubmissionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("bank_name"))).toBe(true);
      }
    });

    it("rejects bank transfer submission when sender_name is missing", () => {
      const invalid = {
        order_id: validUUIDv4,
        payment_method: "BANK_TRANSFER" as const,
        reference_number: "REF-123",
        bank_name: "LandBank",
        sender_name: "",
      };

      const result = submitPaymentSubmissionSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("sender_name"))).toBe(true);
      }
    });
  });

  describe("verifyPaymentSubmissionSchema", () => {
    it("accepts valid VERIFY action with optional notes", () => {
      const input = {
        submission_id: validUUIDv4,
        action: "VERIFY" as const,
        verification_notes: "Payment confirmed in BDO online portal.",
      };

      const result = verifyPaymentSubmissionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("accepts valid REJECT action with rejection reason", () => {
      const input = {
        submission_id: validUUIDv4,
        action: "REJECT" as const,
        rejection_reason: "Transaction reference number not found in bank statement.",
      };

      const result = verifyPaymentSubmissionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
