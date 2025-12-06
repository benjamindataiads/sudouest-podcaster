import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/debug/env
 * Check if Clerk env vars are set (at build time vs runtime)
 */
export async function GET() {
  const buildTimeClerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  const runtimeClerkSecret = process.env.CLERK_SECRET_KEY

  return NextResponse.json({
    buildTime: {
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: buildTimeClerkKey 
        ? `${buildTimeClerkKey.substring(0, 20)}...` 
        : '❌ NOT SET (this is the problem!)',
      isSet: !!buildTimeClerkKey,
    },
    runtime: {
      CLERK_SECRET_KEY: runtimeClerkSecret 
        ? `${runtimeClerkSecret.substring(0, 15)}...` 
        : '❌ NOT SET',
      isSet: !!runtimeClerkSecret,
    },
    diagnosis: !buildTimeClerkKey 
      ? '🔴 NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY was NOT available at build time. Add it to Railway variables and REDEPLOY.'
      : '✅ Clerk keys are configured correctly',
    hint: 'NEXT_PUBLIC_* vars must be set BEFORE the build runs. After adding them in Railway, trigger a new deployment.',
  })
}

