import { describe, it, expect } from "vitest";
import {
  CHICKEN_BREEDS,
  CHICKEN_BREED_DETAILS,
  BREED_DEFAULT_EGG_COLORS,
  EGG_SHELL_COLORS,
} from "../constants";
import {
  createFlockSchema,
  updateFlockSchema,
  BREED_EGG_COLOR_MAP,
  type CreateFlockInput,
  type UpdateFlockInput,
} from "../validations/flocks";
import type { ChickenBreed } from "../../types";

describe("Chicken Breed & Egg Shell Color Constants", () => {
  it("defines the exact four required chicken breeds", () => {
    expect(CHICKEN_BREEDS).toEqual([
      "Lohmann Brown",
      "Hy-Line Brown",
      "ISA Brown",
      "White Leghorn",
    ]);
  });

  it("defines the required egg shell color options", () => {
    expect(EGG_SHELL_COLORS).toEqual([
      "Brown",
      "White",
      "Cream / Tinted",
      "Other",
    ]);
  });

  it("maps typical egg shell colors correctly for each breed", () => {
    expect(BREED_DEFAULT_EGG_COLORS["Lohmann Brown"]).toBe("Brown");
    expect(BREED_DEFAULT_EGG_COLORS["Hy-Line Brown"]).toBe("Brown");
    expect(BREED_DEFAULT_EGG_COLORS["ISA Brown"]).toBe("Brown");
    expect(BREED_DEFAULT_EGG_COLORS["White Leghorn"]).toBe("White");
  });

  it("contains asset paths and descriptions for all four breeds", () => {
    for (const breed of CHICKEN_BREEDS) {
      const details = CHICKEN_BREED_DETAILS[breed];
      expect(details).toBeDefined();
      expect(details.name).toBe(breed);
      expect(details.image).toMatch(/^\/images\/breeds\//);
      expect(details.typicalEggColor).toBe(BREED_DEFAULT_EGG_COLORS[breed]);
      expect(details.description.length).toBeGreaterThan(10);
    }
  });
});

describe("BREED_EGG_COLOR_MAP (server-side derivation)", () => {
  it("derives Brown for all brown-egg breeds", () => {
    expect(BREED_EGG_COLOR_MAP["Lohmann Brown"]).toBe("Brown");
    expect(BREED_EGG_COLOR_MAP["Hy-Line Brown"]).toBe("Brown");
    expect(BREED_EGG_COLOR_MAP["ISA Brown"]).toBe("Brown");
  });

  it("derives White for White Leghorn", () => {
    expect(BREED_EGG_COLOR_MAP["White Leghorn"]).toBe("White");
  });

  it("is consistent with BREED_DEFAULT_EGG_COLORS for all known breeds", () => {
    for (const breed of CHICKEN_BREEDS) {
      expect(BREED_EGG_COLOR_MAP[breed]).toBe(BREED_DEFAULT_EGG_COLORS[breed]);
    }
  });
});

describe("Flock Validation Schemas", () => {
  // egg_shell_color is no longer part of CreateFlockInput — it is derived server-side.
  const validBaseInput: CreateFlockInput = {
    flock_identifier: "BATCH-2026-TEST",
    breed: "Lohmann Brown",
    acquisition_date: "2026-10-18",
    initial_bird_count: 500,
    notes: "Initial test batch",
  };

  it("passes validation for valid flock input with each of the four breeds", () => {
    for (const breed of CHICKEN_BREEDS) {
      const input: CreateFlockInput = { ...validBaseInput, breed };
      const result = createFlockSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.breed).toBe(breed);
        // egg_shell_color is NOT in the schema — the server action derives it
        expect("egg_shell_color" in result.data).toBe(false);
      }
    }
  });

  it("fails when chicken breed is missing or empty", () => {
    const input = {
      ...validBaseInput,
      breed: "",
    };
    const result = createFlockSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("fails when initial bird count is less than 1 or not an integer", () => {
    expect(createFlockSchema.safeParse({ ...validBaseInput, initial_bird_count: 0 }).success).toBe(false);
    expect(createFlockSchema.safeParse({ ...validBaseInput, initial_bird_count: -10 }).success).toBe(false);
    expect(createFlockSchema.safeParse({ ...validBaseInput, initial_bird_count: 12.5 }).success).toBe(false);
  });

  it("fails when flock identifier is missing", () => {
    expect(createFlockSchema.safeParse({ ...validBaseInput, flock_identifier: "" }).success).toBe(false);
  });

  it("validates update flock schema with optional breed (egg color re-derived server-side)", () => {
    const validUpdate: UpdateFlockInput = {
      id: "f27c8c59-7bf3-4cd0-b01a-a7a8742f0cf0",
      flock_identifier: "BATCH-2026-UPDATED",
      breed: "White Leghorn",
      acquisition_date: "2026-10-18",
      status: "ACTIVE",
      notes: "Updated flock notes",
    };
    const result = updateFlockSchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
    // egg_shell_color is not a field in updateFlockSchema either
    if (result.success) {
      expect("egg_shell_color" in result.data).toBe(false);
    }
  });
});

describe("Breed-to-Egg-Color Derivation Logic", () => {
  it("correctly derives egg color from breed for all four breeds", () => {
    for (const breed of CHICKEN_BREEDS) {
      const color = BREED_EGG_COLOR_MAP[breed] ?? "Brown";
      expect(color).toBe(BREED_DEFAULT_EGG_COLORS[breed as ChickenBreed]);
    }
  });

  it("falls back to Brown for an unknown breed", () => {
    const color = BREED_EGG_COLOR_MAP["Unknown Breed"] ?? "Brown";
    expect(color).toBe("Brown");
  });

  it("updates derived color automatically when breed changes", () => {
    // Simulate the server action: changing breed updates the stored egg color
    let currentBreed: ChickenBreed = "Lohmann Brown";
    let derivedColor = BREED_EGG_COLOR_MAP[currentBreed] ?? "Brown";
    expect(derivedColor).toBe("Brown");

    // Staff selects White Leghorn
    currentBreed = "White Leghorn";
    derivedColor = BREED_EGG_COLOR_MAP[currentBreed] ?? "Brown";
    expect(derivedColor).toBe("White");

    // Staff selects ISA Brown
    currentBreed = "ISA Brown";
    derivedColor = BREED_EGG_COLOR_MAP[currentBreed] ?? "Brown";
    expect(derivedColor).toBe("Brown");
  });
});
