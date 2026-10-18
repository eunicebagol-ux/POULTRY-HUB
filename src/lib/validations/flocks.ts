import { z } from "zod";

// ── Create Flock ──────────────────────────────────────────────────────────────

export const CHICKEN_BREEDS = [
  "Lohmann Brown",
  "Hy-Line Brown",
  "ISA Brown",
  "White Leghorn",
] as const;

export const EGG_SHELL_COLORS = [
  "Brown",
  "White",
  "Cream / Tinted",
  "Other",
] as const;

/**
 * Server-side map: derive egg_shell_color from breed.
 * White Leghorn → White; all brown breeds → Brown.
 * This is the authoritative source used by both server actions and the UI.
 */
export const BREED_EGG_COLOR_MAP: Record<string, (typeof EGG_SHELL_COLORS)[number]> = {
  "Lohmann Brown": "Brown",
  "Hy-Line Brown": "Brown",
  "ISA Brown": "Brown",
  "White Leghorn": "White",
};

export const createFlockSchema = z.object({
  flock_identifier: z
    .string()
    .min(1, "Flock identifier is required")
    .max(100, "Flock identifier must be 100 characters or fewer"),
  breed: z
    .string({ message: "Please select a chicken breed" })
    .min(1, "Please select a chicken breed")
    .max(100, "Breed must be 100 characters or fewer"),
  // egg_shell_color is NOT a form input — it is derived from breed by the server action.
  acquisition_date: z.string().min(1, "Acquisition date is required"),
  initial_bird_count: z
    .number({ message: "Initial bird count must be a number" })
    .int("Initial bird count must be a whole number")
    .min(1, "Initial bird count must be at least 1"),
  notes: z.string().max(1000, "Notes must be 1000 characters or fewer").optional(),
});

export type CreateFlockInput = z.infer<typeof createFlockSchema>;

// ── Update Flock ──────────────────────────────────────────────────────────────

export const updateFlockSchema = z.object({
  id: z.string().uuid("Invalid flock ID"),
  flock_identifier: z
    .string()
    .min(1, "Flock identifier is required")
    .max(100, "Flock identifier must be 100 characters or fewer"),
  // breed selection also re-derives egg_shell_color on the server.
  breed: z.string().min(1, "Breed cannot be empty").max(100).optional(),
  acquisition_date: z.string().min(1, "Acquisition date is required"),
  status: z.enum(["ACTIVE", "RETIRED", "QUARANTINED"], {
    message: "Status must be ACTIVE, RETIRED, or QUARANTINED",
  }),
  notes: z.string().max(1000, "Notes must be 1000 characters or fewer").optional(),
});

export type UpdateFlockInput = z.infer<typeof updateFlockSchema>;

// ── Record Mortality ──────────────────────────────────────────────────────────

export const recordMortalitySchema = z.object({
  flock_id: z.string().uuid("Invalid flock ID"),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  event_date: z.string().min(1, "Event date is required"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional(),
});

export type RecordMortalityInput = z.infer<typeof recordMortalitySchema>;

// ── Record Culling ────────────────────────────────────────────────────────────

export const recordCullingSchema = z.object({
  flock_id: z.string().uuid("Invalid flock ID"),
  quantity: z
    .number({ message: "Quantity must be a number" })
    .int("Quantity must be a whole number")
    .min(1, "Quantity must be at least 1"),
  event_date: z.string().min(1, "Event date is required"),
  reason: z.string().max(500, "Reason must be 500 characters or fewer").optional(),
});

export type RecordCullingInput = z.infer<typeof recordCullingSchema>;
