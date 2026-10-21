import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getEggProductionPeriodReport } from "@/actions/egg-production-reports";
import {
  generateEggReportExcel,
  generateEggReportCSV,
  generateEggReportPDF,
} from "@/lib/egg-reports-export";
import { getExportFilename } from "@/lib/egg-reports-utils";
import type { ReportingPeriod, ExportFormat } from "@/types/egg-reports";
import { format } from "date-fns";

const ALLOWED_PERIODS: ReportingPeriod[] = ["daily", "weekly", "monthly", "yearly"];
const ALLOWED_FORMATS: ExportFormat[] = ["xlsx", "csv", "pdf"];

export async function GET(request: NextRequest) {
  try {
    // 1. Strict Server-Side Authorization Check
    const profile = await getCurrentUserProfile();

    if (!profile || !profile.is_active) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required." },
        { status: 401 }
      );
    }

    if (profile.role !== "ADMIN") {
      return NextResponse.json(
        {
          error: "Forbidden: Exporting egg production reports is restricted to administrators.",
        },
        { status: 403 }
      );
    }

    // 2. Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const periodParam = (searchParams.get("period") || "daily") as ReportingPeriod;
    const dateParam = searchParams.get("date") || undefined;
    const formatParam = (searchParams.get("format") || "xlsx") as ExportFormat;

    if (!ALLOWED_PERIODS.includes(periodParam)) {
      return NextResponse.json(
        { error: `Invalid reporting period. Allowed: ${ALLOWED_PERIODS.join(", ")}` },
        { status: 400 }
      );
    }

    if (!ALLOWED_FORMATS.includes(formatParam)) {
      return NextResponse.json(
        { error: `Invalid format. Allowed: ${ALLOWED_FORMATS.join(", ")}` },
        { status: 400 }
      );
    }

    // 3. Fetch report data using authoritative server action
    const reportResult = await getEggProductionPeriodReport(periodParam, dateParam);

    if (!reportResult.success) {
      return NextResponse.json(
        { error: reportResult.error || "Failed to retrieve production data." },
        { status: 500 }
      );
    }

    const report = reportResult.data;
    const now = new Date();
    // Philippine time format (e.g. "Oct 20, 2026, 08:45 PM")
    const generatedAt = format(now, "MMM d, yyyy, h:mm a");

    const metadata = {
      generatedAt,
      generatedBy: profile.full_name || "Administrator",
    };

    const filename = getExportFilename(report.period, report.dateKey, formatParam);

    // 4. Generate appropriate file format
    let fileBuffer: Buffer;
    let contentType: string;

    switch (formatParam) {
      case "xlsx":
        fileBuffer = generateEggReportExcel(report, metadata);
        contentType =
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;

      case "csv":
        fileBuffer = generateEggReportCSV(report, metadata);
        contentType = "text/csv; charset=utf-8";
        break;

      case "pdf":
        fileBuffer = generateEggReportPDF(report, metadata);
        contentType = "application/pdf";
        break;
    }

    // 5. Stream response with appropriate headers
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[api/reports/egg-production/export] Error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while generating the report export.",
      },
      { status: 500 }
    );
  }
}
