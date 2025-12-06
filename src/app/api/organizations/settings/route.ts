import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db, organizationSettings, type OrganizationBranding } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Default branding (Clean modern theme)
const DEFAULT_BRANDING: OrganizationBranding = {
  logoUrl: undefined,
  primaryColor: '#ffffff',    // White background
  secondaryColor: '#e5e7eb',  // Grey borders (gray-200)
  accentColor: '#8B5CF6',     // Purple accent
  textColor: '#111827',       // Black text (gray-900)
  fontFamily: 'Inter, system-ui, sans-serif',
}

/**
 * GET /api/organizations/settings
 * Get organization settings for the current org
 */
export async function GET() {
  try {
    const { userId, orgId, orgRole } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // If no org selected, return default branding
    if (!orgId) {
      return NextResponse.json({
        settings: null,
        branding: DEFAULT_BRANDING,
        isOrgAdmin: false,
        message: 'No organization selected',
      })
    }

    // Get org settings from DB
    const [settings] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)

    // Return settings or defaults
    return NextResponse.json({
      settings: settings || null,
      branding: settings?.branding || DEFAULT_BRANDING,
      isOrgAdmin: orgRole === 'org:admin',
      orgId,
    })
  } catch (error) {
    console.error('Error fetching org settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization settings' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organizations/settings
 * Update organization settings (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId, orgId, orgRole } = await auth()
    
    if (!userId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!orgId) {
      return NextResponse.json({ error: 'No organization selected' }, { status: 400 })
    }

    // Only admins can update settings
    if (orgRole !== 'org:admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { name, branding } = body

    // Check if settings exist
    const [existing] = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.orgId, orgId))
      .limit(1)

    let settings
    if (existing) {
      // Update existing
      const updateData: Partial<typeof organizationSettings.$inferInsert> = {
        updatedAt: new Date(),
      }
      if (name !== undefined) updateData.name = name
      if (branding !== undefined) updateData.branding = { ...DEFAULT_BRANDING, ...branding }

      const [updated] = await db
        .update(organizationSettings)
        .set(updateData)
        .where(eq(organizationSettings.orgId, orgId))
        .returning()
      
      settings = updated
    } else {
      // Create new
      const [created] = await db
        .insert(organizationSettings)
        .values({
          orgId,
          name: name || 'My Organization',
          branding: branding ? { ...DEFAULT_BRANDING, ...branding } : DEFAULT_BRANDING,
        })
        .returning()
      
      settings = created
    }

    console.log(`✅ Updated org settings for ${orgId}`)
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error updating org settings:', error)
    return NextResponse.json(
      { error: 'Failed to update organization settings' },
      { status: 500 }
    )
  }
}

