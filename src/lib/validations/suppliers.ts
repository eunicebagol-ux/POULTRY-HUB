import { z } from "zod";

export const supplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Supplier name must be at least 2 characters.")
    .max(100, "Supplier name must be at most 100 characters."),
  contact_person: z
    .string()
    .trim()
    .max(100, "Contact person must be at most 100 characters.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number must be at most 50 characters.")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address.")
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .trim()
    .max(255, "Address must be at most 255 characters.")
    .optional()
    .or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const createSupplierSchema = supplierSchema;
export const updateSupplierSchema = supplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
