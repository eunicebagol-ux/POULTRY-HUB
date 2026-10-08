import { ShieldCheckIcon, DatabaseIcon, UsersIcon } from "lucide-react";

const PILLARS = [
  {
    icon: ShieldCheckIcon,
    title: "Built for Accountability",
    description:
      "Every data change is logged in an immutable audit trail. Ledger tables — mortality events, feed transactions, egg inventory movements — can never be deleted or modified retroactively. Corrections are made through formal reversal records.",
  },
  {
    icon: DatabaseIcon,
    title: "Data Integrity by Design",
    description:
      "All inventory calculations and financial totals are computed by the database — not the browser. Stock can never go negative. Sales are rejected if inventory is insufficient. Role-level security is enforced at the database layer, not just the UI.",
  },
  {
    icon: UsersIcon,
    title: "Role-Aware Operations",
    description:
      "Admins manage users, settings, and corrections. Staff record daily operations. Every action is scoped to what each role is authorized to perform — enforced at every layer from the database to the interface.",
  },
] as const;

export function AboutSection() {
  return (
    <section id="about" className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left: text block */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50 mb-6">
              About POULTRY HUB
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-6 leading-snug">
              Organized Poultry Farm Management,{" "}
              <span className="text-emerald-600 dark:text-emerald-400">Done Properly.</span>
            </h2>
            <div className="space-y-4 text-muted-foreground text-base leading-relaxed">
              <p>
                POULTRY HUB is a web-based management system designed specifically for
                egg-laying poultry operations. It replaces scattered spreadsheets and
                informal records with a structured, auditable system that reflects how
                a real farm actually operates.
              </p>
              <p>
                The system covers the full operational cycle — from flock setup and daily
                egg collection, through feed management and sales invoicing, to financial
                reporting and activity audits. Every transaction is stored with a complete
                history, ensuring farm records remain trustworthy over time.
              </p>
              <p>
                Designed for clarity and accountability, not just data entry. Records can
                be corrected through formal reversal entries — not silently overwritten.
                Inventory is always reconcilable back to its source transactions.
              </p>
            </div>
          </div>

          {/* Right: pillars */}
          <div className="space-y-5">
            {PILLARS.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-5 p-5 rounded-2xl border border-border/60 bg-card hover:shadow-sm transition-shadow duration-200"
              >
                <div className="shrink-0 flex size-11 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-200/60 dark:ring-emerald-800/40">
                  <Icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1.5">{title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
