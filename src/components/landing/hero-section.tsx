import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";

export function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-16"
    >
      {/* Background image */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/landing-hero.jpg"
          alt="Modern poultry farm at golden hour"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Overlay: dark gradient from bottom, lighter at top */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80" />
        {/* Subtle green tint overlay */}
        <div className="absolute inset-0 bg-emerald-950/20" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center py-20">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-4 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30 backdrop-blur-sm mb-8">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Poultry Egg Production Management System
        </div>

        {/* Headline */}
        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl leading-tight mb-6">
          Smarter Poultry Management,{" "}
          <span className="text-emerald-400">From Egg to Sale.</span>
        </h1>

        {/* Supporting text */}
        <p className="mx-auto max-w-2xl text-base sm:text-lg text-slate-200/90 leading-relaxed mb-10">
          Manage egg production, flock records, inventory, feed, sales, and farm
          operations in one organized system — built for real farm operations.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/sign-in"
            id="hero-get-started"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-base transition-colors duration-200 shadow-lg shadow-emerald-900/40"
          >
            Get Started
            <ArrowRight className="size-4" />
          </Link>
          <a
            href="#features"
            id="hero-explore-features"
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-base transition-colors duration-200 ring-1 ring-white/25 backdrop-blur-sm"
          >
            Explore Features
          </a>
        </div>

        {/* Stats row */}
        <div className="mt-16 grid grid-cols-3 gap-6 max-w-xl mx-auto">
          {[
            { value: "18", label: "Data Tables" },
            { value: "6+", label: "Core Modules" },
            { value: "2", label: "Role Levels" },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-extrabold text-emerald-400">{value}</div>
              <div className="text-xs text-slate-300/80 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <a
        href="#features"
        aria-label="Scroll to features"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-slate-300/60 hover:text-slate-200 transition-colors"
      >
        <span className="text-[10px] font-medium tracking-widest uppercase">Scroll</span>
        <ChevronDown className="size-5 animate-bounce" />
      </a>
    </section>
  );
}
