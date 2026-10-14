"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Who can use POULTRY HUB?",
    a: "POULTRY HUB supports two roles: Admin and Staff. Admins have full system access including user management, settings, and inventory corrections. Staff can record daily operations — egg production, feed consumption, mortality, and permitted sales. All role restrictions are enforced at the database level.",
  },
  {
    q: "How does inventory stay accurate?",
    a: "Inventory is never calculated by the browser. All stock updates — from egg production, sales, feed receipts, and consumption — are performed inside atomic database transactions. If a sale would reduce stock below zero, the entire transaction is rejected. Every balance change has a corresponding ledger entry.",
  },
  {
    q: "Can I correct a mistake in the records?",
    a: "Yes. POULTRY HUB uses formal correction records rather than overwrites. Mortality and culling errors are corrected through reversal entries that reference the original record. Both the original and the correction remain permanently visible in the ledger for full accountability.",
  },
  {
    q: "What egg sizes does the system support?",
    a: "The system supports six standardized egg sizes: Small, Medium, Large, Extra Large, Jumbo, and Ungraded. These sizes are tracked separately in inventory and can be sold in four packaging types: Piece, Tray (30), Carton (12), and Box (360).",
  },
  {
    q: "How is financial data calculated?",
    a: "All financial totals — line item amounts, subtotals, discounts, and final invoice amounts — are calculated by the database, not the browser. Client-submitted totals are ignored. This prevents calculation errors and ensures every invoice is mathematically consistent.",
  },
  {
    q: "Is activity tracked for accountability?",
    a: "Yes. Every significant action — egg production, sales, inventory adjustments, feed events, user role changes, and account deactivations — generates an immutable audit log entry. These logs cannot be deleted or modified.",
  },
  {
    q: "Does POULTRY HUB support multiple users?",
    a: "Yes. You can create multiple Admin and Staff user accounts. Admins manage user accounts, roles, and system settings. Access to each module is controlled by the user's assigned role.",
  },
] as const;

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <div className="border-b border-border/60 last:border-0">
      <button
        id={`faq-btn-${id}`}
        aria-expanded={open}
        aria-controls={`faq-panel-${id}`}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        id={`faq-panel-${id}`}
        role="region"
        aria-labelledby={`faq-btn-${id}`}
        className={cn(
          "overflow-hidden transition-all duration-300",
          open ? "max-h-96 pb-5" : "max-h-0"
        )}
      >
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

export function FAQSection() {
  return (
    <section id="faq" className="py-24 bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50 mb-4">
            FAQ
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-base text-muted-foreground">
            Answers based on what POULTRY HUB actually does.
          </p>
        </div>

        {/* FAQ Items */}
        <div className="rounded-2xl border border-border/60 bg-card px-6 divide-border/60">
          {FAQS.map(({ q, a }) => (
            <FAQItem key={q} q={q} a={a} />
          ))}
        </div>
      </div>
    </section>
  );
}
