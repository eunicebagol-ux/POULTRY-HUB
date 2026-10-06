"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import type { UserRole } from "@/types";

interface AppShellProps {
  userRole: UserRole;
  userName?: string;
  children: React.ReactNode;
}

export function AppShell({ userRole, userName, children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-sans antialiased">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        <Sidebar userRole={userRole} userName={userName} />
      </div>

      {/* Mobile Drawer Navigation */}
      <MobileNav
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        userRole={userRole}
        userName={userName}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header
          userRole={userRole}
          userName={userName}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-y-auto bg-slate-50/60 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
