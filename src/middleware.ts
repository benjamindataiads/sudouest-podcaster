import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define which routes require authentication
const isProtectedRoute = createRouteMatcher([
  '/create(.*)',
  '/gallery(.*)',
  '/avatars(.*)',
  '/api/podcasts(.*)',
  '/api/audio-jobs(.*)',
  '/api/video-jobs(.*)',
  '/api/avatars(.*)',
  '/api/articles/analyze(.*)',
])

// Define public routes (always accessible)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
  '/api/files(.*)',
  '/api/db/migrate(.*)',
  '/api/debug(.*)',
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

