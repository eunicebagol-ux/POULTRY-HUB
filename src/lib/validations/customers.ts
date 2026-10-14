import { z } from "zod";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Customer name must be at least 2 characters.")
    .max(100, "Customer name must be at most 100 characters."),
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

export const createCustomerSchema = customerSchema;
export const updateCustomerSchema = customerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
