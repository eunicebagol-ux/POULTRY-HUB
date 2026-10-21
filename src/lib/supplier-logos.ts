/**
 * Supplier Directory Verified Logo and Brand Identity Registry
 * POULTRY HUB - Butuan City & Commercial Partner Brands
 */

export interface BrandPreset {
  id: string;
  name: string;
  displayName: string;
  logoUrl: string;
  status: "VERIFIED" | "INITIALS_FALLBACK";
  location: string;
  notes: string;
  matchKeywords: string[];
}

export const VERIFIED_SUPPLIER_BRANDS: BrandPreset[] = [
  {
    id: "sm",
    name: "SM City Butuan",
    displayName: "SM / SM Prime Holdings",
    logoUrl: "/images/suppliers/sm.svg",
    status: "VERIFIED",
    location: "JC Aquino Ave, Lapu-lapu, Butuan City",
    notes: "Official SM lettermark vector artwork, SM Investments & Prime brand identity.",
    matchKeywords: [
      "sm city butuan",
      "sm city",
      "sm butuan",
      "sm mall butuan",
      "sm prime",
      "sm store",
      "the sm store",
      "sm department store",
      "sm investments",
    ],
  },
  {
    id: "sm-supermarket",
    name: "SM Supermarket Butuan",
    displayName: "SM Supermarket",
    logoUrl: "/images/suppliers/sm-supermarket.svg",
    status: "VERIFIED",
    location: "SM City Butuan, JC Aquino Ave, Butuan City",
    notes: "Official SM Supermarket blue and green retail logotype vector.",
    matchKeywords: [
      "sm supermarket",
      "sm supermarket butuan",
      "sm hypermarket",
      "sm market butuan",
      "sm food retail",
    ],
  },
  {
    id: "sm-savemore",
    name: "SM Savemore",
    displayName: "SM Savemore Market",
    logoUrl: "/images/suppliers/sm-savemore.svg",
    status: "VERIFIED",
    location: "Butuan City",
    notes: "Official Savemore Market yellow and green retail branding, SM Markets group.",
    matchKeywords: [
      "savemore",
      "sm savemore",
      "savemore market",
      "savemore butuan",
      "savemore market butuan",
    ],
  },
  {
    id: "robinsons",
    name: "Robinsons Place / Supermarket Butuan",
    displayName: "Robinsons Retail",
    logoUrl: "/images/suppliers/robinsons.svg",
    status: "VERIFIED",
    location: "JC Aquino Ave, Brgy. Bayanihan, Butuan City",
    notes: "Official Robinsons green lettermark with stylized sprout crest, JG Summit Holdings.",
    matchKeywords: [
      "robinsons",
      "robinsons place butuan",
      "robinsons place",
      "robinsons supermarket",
      "robinsons supermarket butuan",
      "robinsons butuan",
      "robinsons mall butuan",
    ],
  },
  {
    id: "puregold",
    name: "Puregold Price Club",
    displayName: "Puregold",
    logoUrl: "/images/suppliers/puregold.svg",
    status: "VERIFIED",
    location: "Montilla Blvd & Langihan, Butuan City",
    notes: "Official Puregold Price Club green and gold vector emblem.",
    matchKeywords: [
      "puregold",
      "puregold butuan",
      "puregold price club",
      "pure gold",
      "pure gold butuan",
    ],
  },
  {
    id: "gaisano-city-butuan",
    name: "Gaisano City Butuan",
    displayName: "Gaisano City Butuan (Initials Fallback)",
    logoUrl: "/images/suppliers/gaisano-city-butuan.svg",
    status: "INITIALS_FALLBACK",
    location: "JC Aquino Ave, Butuan City",
    notes: "Awaiting verified vector artwork from local corporate office. Styled initials badge fallback.",
    matchKeywords: [
      "gaisano city butuan",
      "gaisano city",
      "gaisano butuan",
      "gaisano mall butuan",
      "gaisano",
    ],
  },
  {
    id: "wing-on",
    name: "Wing-On Incorporated",
    displayName: "Wing-On Inc. (Initials Fallback)",
    logoUrl: "/images/suppliers/wing-on.svg",
    status: "INITIALS_FALLBACK",
    location: "J. Satorre St., Holy Redeemer, Butuan City",
    notes: "Local landmark wholesale/retail store in Butuan City. Initials fallback.",
    matchKeywords: [
      "wing-on",
      "wing on",
      "wing-on inc",
      "wing on inc",
      "wing-on incorporated",
      "wing on incorporated",
      "wingon",
      "wing on butuan",
    ],
  },
  {
    id: "unitop",
    name: "UNITOP General Merchandise",
    displayName: "UNITOP Butuan (Initials Fallback)",
    logoUrl: "/images/suppliers/unitop.svg",
    status: "INITIALS_FALLBACK",
    location: "Langihan / Montilla Blvd, Butuan City",
    notes: "Regional general merchandise department store. Initials fallback.",
    matchKeywords: [
      "unitop",
      "unitop butuan",
      "unitop general merchandise",
      "uni-top",
      "unitop mall",
    ],
  },
];

export interface ResolvedLogo {
  url: string | null;
  status: "VERIFIED" | "INITIALS_FALLBACK" | "CUSTOM_UPLOAD" | "NONE";
  brandName?: string;
  notes?: string;
  isAutoDetected?: boolean;
}

/**
 * Automatically detects a recognized brand from the input name.
 * Respects specificity (e.g. SM Supermarket vs SM City Butuan) and prevents ambiguous matches.
 */
export function detectBrandFromName(name: string): BrandPreset | null {
  if (!name || typeof name !== "string") return null;
  const raw = name.trim().toLowerCase();
  if (raw.length < 2) return null;

  // Clean common punctuation to simplify matching
  const clean = raw
    .replace(/['".,\-_/()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean || clean.length < 2) return null;

  // Reject generic standalone keywords that must not falsely match brands
  const genericExcluded = [
    "small",
    "smart",
    "smile",
    "smooth",
    "market",
    "supermarket",
    "city",
    "place",
    "mall",
    "store",
    "gold",
    "on",
    "unit",
    "top",
    "general",
    "merchandise",
    "feeds",
    "poultry",
    "farms",
    "farm",
  ];
  if (genericExcluded.includes(clean)) return null;

  // 1. SM Savemore (Highest specificity for Savemore grocery chain)
  if (clean.includes("savemore")) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "sm-savemore") || null;
  }

  // 2. SM Supermarket (Specific grocery brand - must precede generic SM City)
  if (
    clean.includes("sm supermarket") ||
    clean.includes("sm hypermarket") ||
    clean.includes("sm market") ||
    (clean.includes("supermarket") && (/\bsm\b/.test(clean) || clean.startsWith("sm ")))
  ) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "sm-supermarket") || null;
  }

  // 3. Robinsons (Supermarket or Place Butuan)
  if (clean.includes("robinsons")) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "robinsons") || null;
  }

  // 4. Puregold Price Club (requires puregold or pure gold; isolated "gold" disallowed)
  if (clean.includes("puregold") || clean.includes("pure gold")) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "puregold") || null;
  }

  // 5. Gaisano City Butuan (Initials Fallback - Unverified)
  if (clean.includes("gaisano")) {
    return (
      VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "gaisano-city-butuan") ||
      null
    );
  }

  // 6. Wing-On Incorporated
  if (clean.includes("wing on") || clean.includes("wingon")) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "wing-on") || null;
  }

  // 7. UNITOP General Merchandise
  if (clean.includes("unitop") || clean.includes("uni top")) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "unitop") || null;
  }

  // 8. SM City Butuan / SM Prime / The SM Store
  const smBrandTerms = [
    "sm city butuan",
    "sm city",
    "sm butuan",
    "sm mall",
    "sm prime",
    "sm store",
    "the sm store",
    "sm department store",
    "sm investments",
  ];
  if (smBrandTerms.some((term) => clean === term || clean.includes(term))) {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "sm") || null;
  }

  // Exact standalone "sm" (e.g. seeded "SM")
  if (clean === "sm") {
    return VERIFIED_SUPPLIER_BRANDS.find((b) => b.id === "sm") || null;
  }

  return null;
}

/**
 * Resolves the logo for a supplier:
 * 1. If explicit `logo_url` is present in DB, uses it (custom upload or explicit preset).
 * 2. If no `logo_url`, performs automatic matching against verified Butuan City brands.
 * 3. Returns null/NONE if no match, triggering initials avatar fallback.
 */
export function resolveSupplierLogo(supplier: {
  name: string;
  logo_url?: string | null;
}): ResolvedLogo {
  if (supplier.logo_url && supplier.logo_url.trim() !== "") {
    const trimmed = supplier.logo_url.trim();
    // Check if it's one of our built-in preset SVGs
    const matchedPreset = VERIFIED_SUPPLIER_BRANDS.find(
      (b) => b.logoUrl === trimmed
    );
    if (matchedPreset) {
      return {
        url: matchedPreset.logoUrl,
        status: matchedPreset.status,
        brandName: matchedPreset.name,
        notes: matchedPreset.notes,
        isAutoDetected: false,
      };
    }

    return {
      url: trimmed,
      status: "CUSTOM_UPLOAD",
      brandName: supplier.name,
      notes: "Custom uploaded brand logo stored in Supabase Storage.",
      isAutoDetected: false,
    };
  }

  // Automatic matching based on supplier name
  const detected = detectBrandFromName(supplier.name);
  if (detected) {
    return {
      url: detected.logoUrl,
      status: detected.status,
      brandName: detected.name,
      notes: detected.notes,
      isAutoDetected: true,
    };
  }

  return {
    url: null,
    status: "NONE",
    isAutoDetected: false,
  };
}

/**
 * Extracts 1-2 character initials for clean fallback avatars.
 */
export function getSupplierInitials(name: string): string {
  if (!name || !name.trim()) return "SP";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
