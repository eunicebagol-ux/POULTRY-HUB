import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * POULTRY HUB — Next.js 16 Root Proxy
 *
 * Configures Clerk middleware to protect application routes while leaving
 * public auth routes and Clerk webhooks unauthenticated.
 */

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
  ],
};
