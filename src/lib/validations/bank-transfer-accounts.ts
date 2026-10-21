import { z } from "zod";

export const SUPPORTED_BANK_OPTIONS = [
  "BDO",
  "BPI",
  "LandBank",
  "Metrobank",
  "UnionBank",
  "PNB",
  "Security Bank",
  "RCBC",
  "Chinabank",
  "Other",
] as const;

export type SupportedBankOption = (typeof SUPPORTED_BANK_OPTIONS)[number];

export const createBankTransferAccountSchema = z
  .object({
    bank_name_select: z.enum(SUPPORTED_BANK_OPTIONS, {
      message: "Please select a valid bank option.",
    }),
    custom_bank_name: z
      .string()
      .trim()
      .max(100, "Bank name must be at most 100 characters.")
      .optional()
      .or(z.literal("")),
    account_holder_name: z
      .string()
      .trim()
      .min(1, "Account holder name is required.")
      .max(150, "Account holder name must be at most 150 characters."),
    account_number: z
      .string()
      .trim()
      .min(5, "Account number must be at least 5 characters.")
      .max(30, "Account number must be at most 30 characters.")
      .regex(/^[0-9A-Za-z\s-]+$/, "Account number can only contain numbers, letters, spaces, and hyphens."),
    instructions: z
      .string()
      .trim()
      .max(500, "Instructions must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
    is_active: z.boolean().default(true),
    display_order: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.bank_name_select === "Other") {
        return !!data.custom_bank_name && data.custom_bank_name.trim().length >= 2;
      }
      return true;
    },
    {
      message: "Custom bank name must be at least 2 characters when 'Other' is selected.",
      path: ["custom_bank_name"],
    }
  );

export type CreateBankTransferAccountInput = z.infer<
  typeof createBankTransferAccountSchema
>;

export const updateBankTransferAccountSchema = z
  .object({
    id: z.string().uuid("Invalid bank account ID."),
    bank_name_select: z.enum(SUPPORTED_BANK_OPTIONS, {
      message: "Please select a valid bank option.",
    }),
    custom_bank_name: z
      .string()
      .trim()
      .max(100, "Bank name must be at most 100 characters.")
      .optional()
      .or(z.literal("")),
    account_holder_name: z
      .string()
      .trim()
      .min(1, "Account holder name is required.")
      .max(150, "Account holder name must be at most 150 characters."),
    account_number: z
      .string()
      .trim()
      .min(5, "Account number must be at least 5 characters.")
      .max(30, "Account number must be at most 30 characters.")
      .regex(/^[0-9A-Za-z\s-]+$/, "Account number can only contain numbers, letters, spaces, and hyphens."),
    instructions: z
      .string()
      .trim()
      .max(500, "Instructions must be at most 500 characters.")
      .optional()
      .or(z.literal("")),
    is_active: z.boolean().default(true),
    display_order: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      if (data.bank_name_select === "Other") {
        return !!data.custom_bank_name && data.custom_bank_name.trim().length >= 2;
      }
      return true;
    },
    {
      message: "Custom bank name must be at least 2 characters when 'Other' is selected.",
      path: ["custom_bank_name"],
    }
  );

export type UpdateBankTransferAccountInput = z.infer<
  typeof updateBankTransferAccountSchema
>;
