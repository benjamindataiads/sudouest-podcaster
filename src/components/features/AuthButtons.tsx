'use client'

import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { User, Film } from 'lucide-react'
import Link from 'next/link'

// Check at build time if Clerk is configured
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

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

