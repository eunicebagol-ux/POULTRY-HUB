import Image from "next/image";
import { SignIn } from "@clerk/nextjs";
import { EggIcon, CheckCircle2 } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-theme";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full bg-background font-sans antialiased">
      {/* ── Left Side: Branded Image Panel (Desktop / Large Tablet) ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white lg:flex xl:w-7/12">
        {/* Background Image */}
        <Image
          src="/log-in background.jpg"
          alt=""
          fill
          priority
          sizes="(max-width: 1024px) 0vw, 60vw"
          className="object-cover object-center"
        />

        {/* Dark Green / Black Overlay for High Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-emerald-950/75 to-slate-950/60" />

        {/* Top Header Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-400/30">
            <EggIcon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white drop-shadow-sm">
              POULTRY HUB
            </h1>
            <p className="text-xs font-medium text-emerald-200/90">
              Enterprise Poultry Operations
            </p>
          </div>
        </div>

        {/* Main Content Hero */}
        <div className="relative z-10 my-auto max-w-lg space-y-6 py-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3.5 py-1 text-xs font-medium text-emerald-300 ring-1 ring-emerald-500/30 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Poultry Egg Production Management System
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            Smarter Poultry Management, <br />
            <span className="text-emerald-400">Better Production.</span>
          </h2>
          <p className="text-base text-slate-200/95 leading-relaxed">
            Streamline daily egg collection, monitor flock health, track feed inventory, and analyze sales performance with authoritative, real-time farm insights.
          </p>

          {/* Feature Badges */}
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            {[
              "Egg Production",
              "Inventory Management",
              "Sales Tracking",
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-2 rounded-lg bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur-md ring-1 ring-white/15 shadow-sm"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300/80 border-t border-white/10 pt-4">
          <span>&copy; {new Date().getFullYear()} POULTRY HUB System</span>
          <span>Agricultural Enterprise Grade</span>
        </div>
      </div>

      {/* ── Right Side: Polished SaaS Authentication Area ── */}
      <div className="flex w-full flex-col items-center justify-center bg-muted/30 px-4 py-12 sm:px-6 lg:w-1/2 lg:px-12 xl:w-5/12">
        {/* Mobile Header Banner (Visible on mobile/small screens) */}
        <div className="mb-6 flex flex-col items-center text-center lg:hidden">
          <div className="mb-3 flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/30">
            <EggIcon className="size-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            POULTRY HUB
          </h1>
          <p className="text-xs font-medium text-muted-foreground mt-1">
            Smarter Poultry Management, Better Production.
          </p>
        </div>

        {/* Desktop Brand Header Above Card */}
        <div className="mb-6 hidden lg:flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400/20">
            <EggIcon className="size-5" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            POULTRY HUB
          </span>
        </div>

        {/* Card Container Wrapping Clerk SignIn */}
        <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-6 sm:p-8 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/5 transition-all">
          <SignIn appearance={clerkAppearance} />
        </div>

        {/* Subtle Security Footnote */}
        <div className="mt-8 text-center text-xs text-muted-foreground/80">
          <p>Protected by Enterprise Auth &amp; PostgreSQL Security</p>
        </div>
      </div>
    </div>
  );
}
