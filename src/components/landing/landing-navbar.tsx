"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EggIcon, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/#home", label: "Home" },
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#about", label: "About" },
  { href: "/#faq", label: "FAQ" },
] as const;

export function LandingNavbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);

  const isSignIn = pathname?.startsWith("/sign-in");
  const isSignUp = pathname?.startsWith("/sign-up");
  const isLandingPage = pathname === "/";

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = () => setMobileOpen(false);

  // Background style: solid glass header on sub-pages (e.g. /sign-in), dynamic on home page
  const headerBgClass =
    !isLandingPage || scrolled
      ? "bg-background/95 backdrop-blur-md border-b border-border/60 shadow-sm"
      : "bg-transparent";

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50 transition-all duration-300", headerBgClass)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* ── Brand ── */}
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0"
            onClick={handleNavClick}
          >
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-500/30">
              <EggIcon className="size-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              POULTRY <span className="text-emerald-600">HUB</span>
            </span>
          </Link>

          {/* ── Desktop nav links ── */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* ── Desktop right actions ── */}
          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150",
                isSignIn
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-150 shadow-sm",
                isSignUp
                  ? "bg-emerald-700 text-white ring-2 ring-emerald-400"
                  : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white"
              )}
            >
              Get Started
            </Link>
          </div>

          {/* ── Mobile: theme + hamburger ── */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="flex items-center justify-center size-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-border/60 transition-colors"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 border-border/60",
          mobileOpen ? "max-h-96 border-b" : "max-h-0"
        )}
      >
        <div className="bg-background/98 backdrop-blur-md px-4 pt-2 pb-4 space-y-1">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={handleNavClick}
              className="block px-3.5 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {label}
            </a>
          ))}
          <div className="pt-2 border-t border-border/60 flex flex-col gap-2">
            <Link
              href="/sign-in"
              onClick={handleNavClick}
              className={cn(
                "block text-center px-4 py-2.5 rounded-lg border border-border/80 text-sm font-semibold transition-colors",
                isSignIn
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border-emerald-500/30"
                  : "text-foreground hover:bg-muted/60"
              )}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              onClick={handleNavClick}
              className={cn(
                "block text-center px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm",
                isSignUp
                  ? "bg-emerald-700 ring-2 ring-emerald-400"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
