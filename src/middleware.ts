import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define public routes (accessible without auth)
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  // API routes that must be public (webhooks from external services)
  '/api/webhooks(.*)',
  '/api/files(.*)',
  '/api/db/migrate(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Skip protection if Clerk is not configured
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return
  }

  // Protect ALL routes except public ones
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

