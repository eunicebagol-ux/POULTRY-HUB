import {
  EggIcon,
  BirdIcon,
  PackageIcon,
  WheatIcon,
  ReceiptIcon,
  BarChart3Icon,
} from "lucide-react";

const FEATURES = [
  {
    icon: EggIcon,
    title: "Egg Production",
    description:
      "Record daily egg collections by flock and shift. Log good, damaged, and cracked eggs with exact size breakdown — Small, Medium, Large, Extra Large, Jumbo, and Ungraded.",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200/60 dark:border-amber-800/40",
  },
  {
    icon: BirdIcon,
    title: "Flock Management",
    description:
      "Track your laying hen batches with accurate bird counts. Record mortality and culling events with a permanent, auditable ledger. Correction reversals keep your records honest.",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200/60 dark:border-emerald-800/40",
  },
  {
    icon: PackageIcon,
    title: "Egg Inventory",
    description:
      "Live stock snapshot by egg size — updated automatically every time production is recorded or a sale is completed. Every balance change is logged in an immutable transaction ledger.",
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200/60 dark:border-sky-800/40",
  },
  {
    icon: WheatIcon,
    title: "Feed Management",
    description:
      "Track feed stock in kilograms by feed type. Record daily feed consumption per flock and receive stock from suppliers. All movements are atomically logged and inventory is never allowed to go negative.",
    color: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    border: "border-orange-200/60 dark:border-orange-800/40",
  },
  {
    icon: ReceiptIcon,
    title: "Sales Management",
    description:
      "Create egg sales invoices with customer info, packaging types (piece, tray, carton, box), and discounts. Inventory is deducted atomically — no double-selling, no phantom stock.",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200/60 dark:border-violet-800/40",
  },
  {
    icon: BarChart3Icon,
    title: "Reports & Analytics",
    description:
      "Production summaries, feed efficiency (FCR), financial P&L, and inventory analytics — all drawn from verified operational data rather than manually entered totals.",
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    border: "border-rose-200/60 dark:border-rose-800/40",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-4 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-800/50 mb-4">
            What POULTRY HUB Covers
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl mb-4">
            Everything Your Farm Operation Needs
          </h2>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground leading-relaxed">
            Built specifically for egg-laying poultry farms. Each module reflects
            real farm workflows — not generic inventory software repurposed for agriculture.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description, color, bg, border }) => (
            <div
              key={title}
              className={`group relative rounded-2xl border p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 bg-card ${border}`}
            >
              <div
                className={`inline-flex size-12 items-center justify-center rounded-xl ${bg} ${color} mb-4 ring-1 ${border}`}
              >
                <Icon className="size-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
