"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-[104px] h-[36px] rounded-full bg-muted border border-border/60 animate-pulse" />;
  }

  return (
    <div className="flex items-center gap-0.5 bg-muted/50 p-1 rounded-full border border-border/60 backdrop-blur-sm">
      <button
        onClick={() => setTheme("light")}
        aria-label="Light mode"
        title="Light mode"
        className={cn(
          "flex items-center justify-center p-1.5 rounded-full transition-all duration-200 text-muted-foreground hover:text-foreground",
          theme === "light" && "bg-background shadow-sm text-foreground ring-1 ring-border/50"
        )}
      >
        <Sun className="size-3.5" />
      </button>
      <button
        onClick={() => setTheme("system")}
        aria-label="System theme"
        title="System theme"
        className={cn(
          "flex items-center justify-center p-1.5 rounded-full transition-all duration-200 text-muted-foreground hover:text-foreground",
          theme === "system" && "bg-background shadow-sm text-foreground ring-1 ring-border/50"
        )}
      >
        <Monitor className="size-3.5" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        aria-label="Dark mode"
        title="Dark mode"
        className={cn(
          "flex items-center justify-center p-1.5 rounded-full transition-all duration-200 text-muted-foreground hover:text-foreground",
          theme === "dark" && "bg-background shadow-sm text-foreground ring-1 ring-border/50"
        )}
      >
        <Moon className="size-3.5" />
      </button>
    </div>
  );
}
