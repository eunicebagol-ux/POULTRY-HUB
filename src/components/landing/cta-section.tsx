import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-24 bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Card */}
        <div className="relative overflow-hidden rounded-3xl bg-emerald-700 dark:bg-emerald-800 p-12 sm:p-16 shadow-2xl shadow-emerald-900/30">
          {/* Subtle background texture */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_theme(colors.emerald.500/20)_0%,_transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_theme(colors.amber.500/10)_0%,_transparent_60%)]" />

          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-5 leading-tight">
              Ready to manage your poultry
              <br className="hidden sm:block" /> operation better?
            </h2>
            <p className="text-base text-emerald-100/90 mb-10 max-w-xl mx-auto leading-relaxed">
              Sign in to start tracking egg production, flock records, inventory,
              feed management, and sales — all in one organized system.
            </p>
            <Link
              href="/sign-in"
              id="cta-get-started"
              className="inline-flex items-center gap-2 px-9 py-4 rounded-xl bg-white text-emerald-800 font-bold text-base hover:bg-emerald-50 active:bg-emerald-100 transition-colors duration-200 shadow-lg shadow-emerald-900/20"
            >
              Get Started
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
