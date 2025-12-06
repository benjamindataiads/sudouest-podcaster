'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from '@clerk/nextjs'

export interface OrganizationBranding {
  logoUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  textColor: string
  fontFamily: string
}

const DEFAULT_BRANDING: OrganizationBranding = {
  primaryColor: '#ffffff',    // White background
  secondaryColor: '#e5e7eb',  // Grey borders
  accentColor: '#8B5CF6',     // Purple accent
  textColor: '#111827',       // Black text
  fontFamily: 'Inter, system-ui, sans-serif',
}

interface BrandingContextType {
  branding: OrganizationBranding
  loading: boolean
  orgId: string | null
  isOrgAdmin: boolean
  refetch: () => Promise<void>
}

const BrandingContext = createContext<BrandingContextType>({
  branding: DEFAULT_BRANDING,
  loading: true,
  orgId: null,
  isOrgAdmin: false,
  refetch: async () => {},
})

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { isLoaded, orgId, orgRole } = useAuth()
  const [branding, setBranding] = useState<OrganizationBranding>(DEFAULT_BRANDING)
  const [loading, setLoading] = useState(true)

  const fetchBranding = async () => {
    if (!orgId) {
      setBranding(DEFAULT_BRANDING)
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/organizations/settings')
      const data = await res.json()
      if (data.branding) {
        setBranding(data.branding)
      } else {
        setBranding(DEFAULT_BRANDING)
      }
    } catch (error) {
      console.error('Error fetching branding:', error)
      setBranding(DEFAULT_BRANDING)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isLoaded) {
      fetchBranding()
    }
  }, [isLoaded, orgId])

  // Apply CSS variables when branding changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement
      root.style.setProperty('--brand-primary', branding.primaryColor)
      root.style.setProperty('--brand-secondary', branding.secondaryColor)
      root.style.setProperty('--brand-accent', branding.accentColor)
      root.style.setProperty('--brand-text', branding.textColor)
      root.style.setProperty('--brand-font', branding.fontFamily)
    }
  }, [branding])

  return (
    <BrandingContext.Provider 
      value={{ 
        branding, 
        loading, 
        orgId: orgId || null,
        isOrgAdmin: orgRole === 'org:admin',
        refetch: fetchBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding() {
  return useContext(BrandingContext)
}

