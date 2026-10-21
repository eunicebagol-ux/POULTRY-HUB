import { describe, it, expect } from "vitest";
import {
  detectBrandFromName,
  resolveSupplierLogo,
  getSupplierInitials,
  VERIFIED_SUPPLIER_BRANDS,
} from "../supplier-logos";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "../validations/suppliers";

describe("Supplier Brand Registry & Live Detection", () => {
  it("includes all recognized Butuan City brands and sub-brands", () => {
    const brandIds = VERIFIED_SUPPLIER_BRANDS.map((b) => b.id);
    expect(brandIds).toContain("sm");
    expect(brandIds).toContain("sm-supermarket");
    expect(brandIds).toContain("sm-savemore");
    expect(brandIds).toContain("robinsons");
    expect(brandIds).toContain("puregold");
    expect(brandIds).toContain("gaisano-city-butuan");
    expect(brandIds).toContain("wing-on");
    expect(brandIds).toContain("unitop");
  });

  describe("detectBrandFromName live matching", () => {
    it("distinguishes SM City Butuan (mall) from SM Supermarket and SM Savemore", () => {
      // SM City Butuan (Mall / Prime)
      const smMall = detectBrandFromName("SM City Butuan");
      expect(smMall?.id).toBe("sm");
      expect(smMall?.logoUrl).toBe("/images/suppliers/sm.svg");
      expect(smMall?.status).toBe("VERIFIED");

      // SM Supermarket (Grocery)
      const smSupermarket = detectBrandFromName("SM Supermarket");
      expect(smSupermarket?.id).toBe("sm-supermarket");
      expect(smSupermarket?.logoUrl).toBe("/images/suppliers/sm-supermarket.svg");
      expect(smSupermarket?.status).toBe("VERIFIED");

      // SM Savemore (Neighborhood grocery)
      const smSavemore = detectBrandFromName("SM Savemore");
      expect(smSavemore?.id).toBe("sm-savemore");
      expect(smSavemore?.logoUrl).toBe("/images/suppliers/sm-savemore.svg");
      expect(smSavemore?.status).toBe("VERIFIED");

      // Savemore without SM prefix
      const savemoreDirect = detectBrandFromName("Savemore Market Butuan");
      expect(savemoreDirect?.id).toBe("sm-savemore");
    });

    it("matches recognized Robinsons variations", () => {
      const robPlace = detectBrandFromName("Robinsons Place Butuan");
      expect(robPlace?.id).toBe("robinsons");
      expect(robPlace?.status).toBe("VERIFIED");

      const robSupermarket = detectBrandFromName("Robinsons Supermarket");
      expect(robSupermarket?.id).toBe("robinsons");
      expect(robSupermarket?.status).toBe("VERIFIED");

      const robJust = detectBrandFromName("Robinsons Butuan");
      expect(robJust?.id).toBe("robinsons");
    });

    it("matches Puregold variations", () => {
      const puregold1 = detectBrandFromName("Puregold Butuan");
      expect(puregold1?.id).toBe("puregold");
      expect(puregold1?.status).toBe("VERIFIED");

      const puregold2 = detectBrandFromName("Puregold Price Club");
      expect(puregold2?.id).toBe("puregold");

      const puregold3 = detectBrandFromName("Pure Gold");
      expect(puregold3?.id).toBe("puregold");
    });

    it("matches Gaisano City Butuan as INITIALS_FALLBACK (unverified)", () => {
      const gaisano = detectBrandFromName("Gaisano City Butuan");
      expect(gaisano?.id).toBe("gaisano-city-butuan");
      expect(gaisano?.status).toBe("INITIALS_FALLBACK");
      expect(gaisano?.logoUrl).toBe("/images/suppliers/gaisano-city-butuan.svg");
      expect(gaisano?.notes).toContain("Awaiting verified vector artwork");
    });

    it("matches Wing-On Incorporated and UNITOP Butuan as INITIALS_FALLBACK", () => {
      const wingOn = detectBrandFromName("Wing-On Incorporated");
      expect(wingOn?.id).toBe("wing-on");
      expect(wingOn?.status).toBe("INITIALS_FALLBACK");

      const unitop = detectBrandFromName("UNITOP Butuan");
      expect(unitop?.id).toBe("unitop");
      expect(unitop?.status).toBe("INITIALS_FALLBACK");
    });

    it("prevents false-positive and ambiguous matches", () => {
      // Must not confuse "small" or "smart" with SM
      expect(detectBrandFromName("Small Scale Poultry")).toBeNull();
      expect(detectBrandFromName("Smart Agro Milling")).toBeNull();
      expect(detectBrandFromName("Smile Feeds")).toBeNull();

      // Must not match generic words
      expect(detectBrandFromName("Gold Harvest")).toBeNull();
      expect(detectBrandFromName("City Hardware")).toBeNull();
      expect(detectBrandFromName("Supermarket Supplies")).toBeNull();
      expect(detectBrandFromName("General Milling")).toBeNull();
      expect(detectBrandFromName("On Time Logistics")).toBeNull();
      expect(detectBrandFromName("Top Quality Eggs")).toBeNull();

      // Unknown suppliers
      expect(detectBrandFromName("Mindanao Corn Depot")).toBeNull();
      expect(detectBrandFromName("Acme Feed Mills")).toBeNull();
      expect(detectBrandFromName("VetCare Phils")).toBeNull();

      // Edge cases
      expect(detectBrandFromName("")).toBeNull();
      expect(detectBrandFromName("   ")).toBeNull();
      expect(detectBrandFromName("S")).toBeNull();
    });
  });

  describe("Name change and dynamic detection updates", () => {
    it("updates detection immediately when name changes", () => {
      // User starts typing "SM"
      const step1 = detectBrandFromName("SM");
      expect(step1?.id).toBe("sm");

      // User continues typing "SM Supermarket" -> changes from mall to grocery
      const step2 = detectBrandFromName("SM Supermarket");
      expect(step2?.id).toBe("sm-supermarket");

      // User changes input to unknown supplier
      const step3 = detectBrandFromName("Agway Chemicals");
      expect(step3).toBeNull();

      // User changes input to Puregold Butuan
      const step4 = detectBrandFromName("Puregold Butuan");
      expect(step4?.id).toBe("puregold");
    });
  });

  describe("resolveSupplierLogo & Custom Overrides", () => {
    it("prioritizes custom uploaded logo_url over name auto-detection", () => {
      const customUrl =
        "https://tlvjjgpmxwcfhixxpsei.supabase.co/storage/v1/object/public/supplier-logos/custom.png";
      // Name matches SM, but admin uploaded custom logo
      const resolved = resolveSupplierLogo({
        name: "SM Supermarket",
        logo_url: customUrl,
      });
      expect(resolved.status).toBe("CUSTOM_UPLOAD");
      expect(resolved.url).toBe(customUrl);
      expect(resolved.isAutoDetected).toBe(false);
    });

    it("resolves auto-detection when logo_url is null or empty", () => {
      const resolved = resolveSupplierLogo({
        name: "Robinsons Place Butuan",
        logo_url: null,
      });
      expect(resolved.status).toBe("VERIFIED");
      expect(resolved.url).toBe("/images/suppliers/robinsons.svg");
      expect(resolved.isAutoDetected).toBe(true);
    });

    it("returns status NONE for unknown vendors with no logo_url", () => {
      const resolved = resolveSupplierLogo({
        name: "Agusan Agri Supply",
        logo_url: null,
      });
      expect(resolved.status).toBe("NONE");
      expect(resolved.url).toBeNull();
      expect(resolved.isAutoDetected).toBe(false);
    });
  });

  describe("Edit Mode Logo Preservation", () => {
    it("preserves saved logo_url even when supplier has an atypical name", () => {
      const savedLogo = "/images/suppliers/puregold.svg";
      const resolved = resolveSupplierLogo({
        name: "Langihan Branch Wholesale",
        logo_url: savedLogo,
      });
      expect(resolved.url).toBe(savedLogo);
      expect(resolved.status).toBe("VERIFIED");
      expect(resolved.isAutoDetected).toBe(false);
    });
  });
});

describe("Supplier Initials Generator", () => {
  it("extracts 2 letters from two-word supplier names", () => {
    expect(getSupplierInitials("Acme Feeds")).toBe("AF");
    expect(getSupplierInitials("San Miguel")).toBe("SM");
    expect(getSupplierInitials("Vet Care")).toBe("VC");
  });

  it("extracts 2 characters from single word supplier names", () => {
    expect(getSupplierInitials("SM")).toBe("SM");
    expect(getSupplierInitials("Puregold")).toBe("PU");
    expect(getSupplierInitials("B")).toBe("B");
  });

  it("handles whitespace and empty strings safely", () => {
    expect(getSupplierInitials("   ")).toBe("SP");
    expect(getSupplierInitials("")).toBe("SP");
  });
});

describe("Supplier Schema Validations", () => {
  it("validates successful supplier input with auto-detected or custom logo_url", () => {
    const input = {
      name: "SM Supermarket",
      contact_person: "Procurement Officer",
      phone: "0917-123-4567",
      email: "procurement@sm.com",
      address: "JC Aquino Ave, Butuan City",
      logo_url: "/images/suppliers/sm-supermarket.svg",
      is_active: true,
    };
    const parsed = createSupplierSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("allows null or empty logo_url for suppliers using initials", () => {
    const input = {
      name: "Local Corn Mill",
      logo_url: "",
      is_active: true,
    };
    const parsed = createSupplierSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("supports partial update with logo_url", () => {
    const updateInput = {
      logo_url: "/images/suppliers/robinsons.svg",
    };
    const parsed = updateSupplierSchema.safeParse(updateInput);
    expect(parsed.success).toBe(true);
  });
});

describe("Supplier Form Automatic Logo Detection & Persistence Workflow", () => {
  it("simulates Add Supplier form: auto-detects logo path from typed name for database saving", () => {
    const typedName = "SM Supermarket Butuan";
    // 1. Live detection as user types
    const detected = detectBrandFromName(typedName);
    expect(detected).not.toBeNull();
    expect(detected?.logoUrl).toBe("/images/suppliers/sm-supermarket.svg");

    // 2. Form submission payload includes auto-detected logo path
    const formPayload = {
      name: typedName,
      logo_url: detected?.logoUrl || null,
      is_active: true,
    };
    const parsed = createSupplierSchema.safeParse(formPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.logo_url).toBe("/images/suppliers/sm-supermarket.svg");
    }
  });

  it("simulates name change: immediately updates logo and drops old logo", () => {
    let currentLogoUrl: string | null = null;

    // Step 1: Admin types "SM City Butuan"
    const brand1 = detectBrandFromName("SM City Butuan");
    currentLogoUrl = brand1 ? brand1.logoUrl : null;
    expect(currentLogoUrl).toBe("/images/suppliers/sm.svg");

    // Step 2: Admin clears and types unknown vendor "Mindanao Agri Feeds"
    const brand2 = detectBrandFromName("Mindanao Agri Feeds");
    currentLogoUrl = brand2 ? brand2.logoUrl : null;
    expect(currentLogoUrl).toBeNull(); // Does not retain previous SM logo!

    // Step 3: Admin types "Puregold Butuan"
    const brand3 = detectBrandFromName("Puregold Butuan");
    currentLogoUrl = brand3 ? brand3.logoUrl : null;
    expect(currentLogoUrl).toBe("/images/suppliers/puregold.svg");
  });

  it("simulates Edit Supplier: preserves existing saved custom logo without accidental overwrite", () => {
    // Existing supplier with saved custom uploaded logo
    const existingSupplier = {
      id: "sup-123",
      name: "Custom Agri Mill",
      logo_url: "https://example.com/custom-logo.png",
      is_active: true,
    };

    const manualOverride = Boolean(existingSupplier.logo_url);
    let formLogoUrl = existingSupplier.logo_url;

    // User edits the name to "Custom Agri Mill Butuan"
    const editedName = "Custom Agri Mill Butuan";
    if (!manualOverride) {
      const match = detectBrandFromName(editedName);
      formLogoUrl = match ? match.logoUrl : "";
    }

    // Existing saved logo must remain preserved!
    expect(formLogoUrl).toBe("https://example.com/custom-logo.png");
  });
});

