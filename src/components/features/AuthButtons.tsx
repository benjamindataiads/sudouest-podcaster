'use client'

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, OrganizationSwitcher, useAuth } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { User, Film, Settings } from 'lucide-react'
import Link from 'next/link'

// Check at build time if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

function SettingsButton() {
  const { orgRole } = useAuth()
  
  // Only show settings button for org admins
  if (orgRole !== 'org:admin') return null
  
  return (
    <Link href="/settings">
      <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
        <Settings className="h-4 w-4 md:mr-2" />
        <span className="hidden md:inline">Paramètres</span>
      </Button>
    </Link>
  )
}

export default function AuthButtons() {
  // If Clerk is not configured, show navigation buttons without auth
  if (!isClerkConfigured) {
    return (
      <>
        <Link href="/avatars">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
            <User className="h-4 w-4 mr-2" />
            Avatars
          </Button>
        </Link>
        <Link href="/gallery">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
            <Film className="h-4 w-4 mr-2" />
            Galerie
          </Button>
        </Link>
      </>
    )
  }

  return (
    <>
      <SignedIn>
        {/* Organization Switcher */}
        <OrganizationSwitcher 
          hidePersonal={false}
          afterCreateOrganizationUrl="/"
          afterSelectOrganizationUrl="/"
          afterLeaveOrganizationUrl="/"
          appearance={{
            elements: {
              rootBox: "bg-white/10 rounded-lg",
              organizationSwitcherTrigger: "px-3 py-2 text-white hover:bg-white/20",
              organizationPreviewTextContainer: "text-white",
              organizationSwitcherTriggerIcon: "text-white",
            }
          }}
        />
        <SettingsButton />
        <Link href="/avatars">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
            <User className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Avatars</span>
          </Button>
        </Link>
        <Link href="/gallery">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
            <Film className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Galerie</span>
          </Button>
        </Link>
        <UserButton 
          appearance={{
            elements: {
              avatarBox: "w-10 h-10"
            }
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="outline" className="bg-white/10 text-white hover:bg-white/20 border-white/30">
            Connexion
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button variant="outline" className="bg-white text-[#D42E1B] hover:bg-gray-100 border-0">
            Inscription
          </Button>
        </SignUpButton>
      </SignedOut>
    </>
  )
}

