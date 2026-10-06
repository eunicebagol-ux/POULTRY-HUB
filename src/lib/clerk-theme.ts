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
    colorPrimary: "#059669", // Emerald 600
    colorBackground: "#ffffff",
    colorDanger: "#dc2626", // Red 600
    borderRadius: "0.5rem", // 8px
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "w-full shadow-none border-none bg-transparent p-0 m-0",
    card: "w-full shadow-none border-none bg-transparent p-0 m-0",
    headerTitle: "text-2xl font-bold tracking-tight text-slate-900 font-sans",
    headerSubtitle: "text-sm text-slate-500 font-normal mt-1",
    socialButtonsBlockButton:
      "flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all",
    socialButtonsBlockButtonText: "font-medium text-slate-700 text-sm",
    socialButtonsBlockButtonLogo: "size-4 mr-2",
    dividerLine: "bg-slate-200",
    dividerText: "text-xs uppercase text-slate-400 font-medium bg-white px-2.5",
    formFieldLabel: "text-xs font-semibold text-slate-700 mb-1.5",
    formFieldInput:
      "flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 transition-all",
    formButtonPrimary:
      "flex h-10 w-full items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-sm transition-all shadow-xs active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2",
    footerActionLink:
      "text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors",
    footerActionText: "text-slate-500 text-xs font-normal",
    footer: "bg-transparent p-0 mt-6 text-xs text-slate-400 border-t border-slate-100 pt-4",
    identityPreviewText: "text-sm font-medium text-slate-700",
    identityPreviewEditButtonIcon: "text-emerald-600",
    formFieldSuccessText: "text-xs text-emerald-600 font-medium mt-1",
    formFieldErrorText: "text-xs text-rose-600 font-medium mt-1",
    alert: "rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-medium p-3 mb-4",
    alertText: "text-xs text-rose-700 font-medium",
    formHeaderTitle: "text-2xl font-bold tracking-tight text-slate-900 font-sans",
    formHeaderSubtitle: "text-sm text-slate-500 font-normal mt-1",
  },
};
