'use client'

import { useEffect } from 'react'
import { useClerk } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

export default function SignOutPage() {
  const { signOut } = useClerk()

  useEffect(() => {
    signOut({ redirectUrl: '/sign-in' })
  }, [signOut])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Déconnexion en cours...</p>
      </div>
    </div>
  )
}

