// middleware.ts
// Protects /dashboard/* with Clerk auth.
// Public: /, /r/*, /sign-in, /sign-up, /api/events, /api/stripe/webhook

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/r/(.*)",             // review funnels
  "/api/events(.*)",    // anonymous event tracking
  "/api/stripe/webhook(.*)", // Stripe webhooks
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
