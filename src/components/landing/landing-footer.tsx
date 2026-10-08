import Link from "next/link";
import { EggIcon } from "lucide-react";

const FOOTER_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
  { href: "/sign-in", label: "Sign In" },
] as const;

export function LandingFooter() {
  return (
    <footer className="bg-slate-950 dark:bg-slate-950 text-slate-400 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <Link href="#home" className="flex items-center gap-2.5 shrink-0">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <EggIcon className="size-4" />
            </div>
            <span className="text-base font-bold text-white tracking-tight">
              POULTRY <span className="text-emerald-400">HUB</span>
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            {FOOTER_LINKS.map(({ href, label }) => (
              <a
                key={label}
                href={href}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Copyright */}
          <p className="text-xs text-slate-600 shrink-0">
            &copy; {new Date().getFullYear()} POULTRY HUB System
          </p>
        </div>
      </div>
    </footer>
  );
}
