import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/create(.*)',
  '/gallery(.*)',
  '/avatars(.*)',
  // Protected API routes (write operations)
  '/api/podcasts/save(.*)',
  '/api/podcasts/delete(.*)',
  '/api/audio-jobs/process(.*)',
  '/api/video-jobs/process(.*)',
  '/api/avatars(.*)',
  '/api/articles/analyze(.*)',
  '/api/video/assemble(.*)',
])

// Define public routes (always accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  // Public API routes (read operations)
  '/api/webhooks(.*)',
  '/api/files(.*)',
  '/api/db/migrate(.*)',
  '/api/debug(.*)',
  '/api/podcasts/latest(.*)',
  '/api/video-jobs/check-stale(.*)',
  '/api/articles(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Skip protection if Clerk is not configured
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return
  }

  // Protect routes that require authentication
  if (isProtectedRoute(req) && !isPublicRoute(req)) {
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

