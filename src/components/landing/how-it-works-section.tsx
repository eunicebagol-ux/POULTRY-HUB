import { ClipboardListIcon, ActivityIcon, TrendingUpIcon } from "lucide-react";

const STEPS = [
  {
    step: "01",
    icon: ClipboardListIcon,
    title: "Record Farm Operations",
    description:
      "Staff log daily egg collections, flock events (mortality, culling), feed consumption, and operational expenses. Each entry is validated and stored with a full audit trail.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-600",
  },
  {
    step: "02",
    icon: ActivityIcon,
    title: "Monitor Production & Inventory",
    description:
      "Inventory snapshots are updated automatically after each recorded event. View current egg stock by size, feed remaining in kilograms, and flock bird counts — all in real time.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
  },
  {
    step: "03",
    icon: TrendingUpIcon,
    title: "Analyze Sales & Reports",
    description:
      "Create sales invoices that deduct inventory atomically. Generate production summaries, financial P&L, feed efficiency, and inventory analytics based on verified operational data.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-600",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-muted/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50 mb-4">
            The Workflow
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-4">
            How It Works
          </h2>
          <p className="mx-auto max-w-xl text-base text-muted-foreground">
            POULTRY HUB follows the natural flow of a working egg production farm —
            from daily operations to business analytics.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connector line (desktop) */}
          <div className="hidden lg:block absolute top-16 left-0 right-0 h-0.5 bg-border mx-32" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-8">
            {STEPS.map(({ step, icon: Icon, title, description, bg }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                {/* Step circle */}
                <div
                  className={`relative z-10 flex size-16 items-center justify-center rounded-full ${bg} text-white shadow-lg mb-6 ring-4 ring-background`}
                >
                  <Icon className="size-7" />
                </div>

                {/* Step number tag */}
                <span className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase mb-2">
                  Step {step}
                </span>

                <h3 className="text-lg font-bold text-foreground mb-3">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
