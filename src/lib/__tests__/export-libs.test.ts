import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

describe("Export libraries validation", () => {
  it("generates an Excel buffer", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Total Eggs", "Good Eggs"],
      ["2026-10-20", 500, 480],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("generates a PDF buffer", () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.text("POULTRY HUB Report", 14, 20);
    autoTable(doc, {
      head: [["Date", "Total Eggs", "Good Eggs"]],
      body: [["2026-10-20", "500", "480"]],
      startY: 30,
    });
    const arrayBuffer = doc.output("arraybuffer");
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });
});
