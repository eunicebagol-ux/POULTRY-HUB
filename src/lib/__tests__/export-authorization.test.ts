import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock user-profile
vi.mock("../user-profile", () => ({
  getCurrentUserProfile: vi.fn(),
}));

// Mock egg production report action
vi.mock("../../actions/egg-production-reports", () => ({
  getEggProductionPeriodReport: vi.fn().mockImplementation((period = "daily", dateInput) => {
    const dateKey = dateInput || (period === "monthly" ? "2026-10" : period === "weekly" ? "2026-10-19" : period === "yearly" ? "2026" : "2026-10-20");
    return Promise.resolve({
      success: true,
      data: {
        period,
        dateKey,
        startDate: dateKey,
        endDate: dateKey,
        formattedDateRange: `Test ${period} Range`,
        periodLabel: `${period} Report`,
        summary: {
          totalEggs: 500,
          goodEggs: 480,
          crackedEggs: 12,
          damagedEggs: 8,
          goodEggsRate: 96,
          crackedEggsRate: 2.4,
          damagedEggsRate: 1.6,
          periodAverage: 500,
          averageLabel: "Shift Average",
          recordCount: 1,
        },
        comparison: null,
        chartData: [],
        records: [
          {
            id: "r1",
            production_date: "2026-10-20",
            collection_shift: "MORNING",
            flock_id: "f1",
            flock_identifier: "Flock A",
            flock_breed: "Lohmann Brown",
            total_eggs: 500,
            good_eggs: 480,
            damaged_eggs: 8,
            cracked_eggs: 12,
            notes: null,
            created_at: "2026-10-20T08:00:00Z",
          },
        ],
      },
    });
  }),
}));

import { getCurrentUserProfile } from "../user-profile";
import { GET } from "../../app/api/reports/egg-production/export/route";

describe("Export Route Server-Side Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests with 401 Unauthorized", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=daily&format=xlsx");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("rejects inactive users with 401 Unauthorized", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "u1",
      role: "ADMIN",
      full_name: "Admin User",
      phone: null,
      avatar_url: null,
      is_active: false,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=daily&format=xlsx");
    const res = await GET(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("strictly forbids STAFF users with 403 Forbidden", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "u2",
      role: "STAFF",
      full_name: "Staff Member",
      phone: null,
      avatar_url: null,
      is_active: true,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=daily&format=xlsx");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
    expect(body.error).toContain("administrators");
  });

  it("strictly forbids CUSTOMER users with 403 Forbidden", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "u3",
      role: "CUSTOMER",
      full_name: "Customer John",
      phone: null,
      avatar_url: null,
      is_active: true,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=daily&format=xlsx");
    const res = await GET(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("allows active ADMIN users to export Excel (.xlsx) with proper headers", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      full_name: "Farm Administrator",
      phone: null,
      avatar_url: null,
      is_active: true,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=daily&date=2026-10-20&format=xlsx");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(res.headers.get("Content-Disposition")).toContain("poultry-hub-egg-report-daily-2026-10-20.xlsx");
  });

  it("allows active ADMIN users to export CSV (.csv) with proper headers", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      full_name: "Farm Administrator",
      phone: null,
      avatar_url: null,
      is_active: true,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=weekly&date=2026-10-19&format=csv");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("poultry-hub-egg-report-weekly-2026-10-19.csv");
  });

  it("allows active ADMIN users to export PDF (.pdf) with proper headers", async () => {
    vi.mocked(getCurrentUserProfile).mockResolvedValue({
      id: "admin-1",
      role: "ADMIN",
      full_name: "Farm Administrator",
      phone: null,
      avatar_url: null,
      is_active: true,
    });

    const req = new NextRequest("http://localhost:3000/api/reports/egg-production/export?period=monthly&date=2026-10&format=pdf");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("poultry-hub-egg-report-monthly-2026-10.pdf");
  });
});
