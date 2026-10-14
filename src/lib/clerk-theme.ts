import type { ComponentProps } from "react";
import type { SignIn } from "@clerk/nextjs";

type Appearance = NonNullable<ComponentProps<typeof SignIn>["appearance"]>;

/**
 * POULTRY HUB — Custom Clerk Appearance Configuration
 *
 * Customizes Clerk authentication components to seamlessly match POULTRY HUB's
 * shadcn/ui design tokens and emerald/agricultural SaaS visual identity.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: "hsl(160, 84%, 39%)", // Emerald 600 equivalent, or use css variable if Clerk supports it. Actually Clerk prefers hex/rgba/hsl.
    colorBackground: "hsl(var(--card))", // We will rely on ClerkProvider variables
    colorDanger: "hsl(var(--destructive))", 
    borderRadius: "0.5rem", // 8px
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "w-full shadow-none border-none bg-transparent p-0 m-0",
    card: "w-full shadow-none border-none bg-transparent p-0 m-0",
    headerTitle: "text-2xl font-bold tracking-tight text-foreground font-sans",
    headerSubtitle: "text-sm text-muted-foreground font-normal mt-1",
    socialButtonsBlockButton:
      "flex h-10 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground shadow-2xs hover:bg-muted/50 hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all",
    socialButtonsBlockButtonText: "font-medium text-foreground text-sm",
    socialButtonsBlockButtonLogo: "size-4 mr-2",
    dividerLine: "bg-border",
    dividerText: "text-xs uppercase text-muted-foreground font-medium bg-card px-2.5",
    formFieldLabel: "text-xs font-semibold text-foreground mb-1.5",
    formFieldInput:
      "flex h-10 w-full rounded-lg border border-border bg-card px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all",
    formButtonPrimary:
      "flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-primary-foreground font-semibold text-sm transition-all shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2",
    footerActionLink:
      "text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors",
    footerActionText: "text-muted-foreground text-xs font-normal",
    footer: "bg-transparent p-0 mt-6 text-xs text-muted-foreground/80 border-t border-border/40 pt-4",
    identityPreviewText: "text-sm font-medium text-foreground",
    identityPreviewEditButtonIcon: "text-emerald-600",
    formFieldSuccessText: "text-xs text-emerald-600 font-medium mt-1",
    formFieldErrorText: "text-xs text-destructive font-medium mt-1",
    alert: "rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs font-medium p-3 mb-4",
    alertText: "text-xs text-destructive font-medium",
    formHeaderTitle: "text-2xl font-bold tracking-tight text-foreground font-sans",
    formHeaderSubtitle: "text-sm text-muted-foreground font-normal mt-1",
  },
};
