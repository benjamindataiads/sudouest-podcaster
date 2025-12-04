import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { ClerkProvider } from '@clerk/nextjs'
import { frFR } from '@clerk/localizations'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Sud-Ouest Podcaster',
  description: 'Générateur automatique de podcasts audio et vidéo basé sur les articles du journal Sud-Ouest',
}

// Force dynamic rendering to avoid build-time Clerk key requirement
export const dynamic = 'force-dynamic'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Check if Clerk is configured
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  
  const content = (
    <html lang="fr">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )

  // If Clerk is not configured, render without ClerkProvider
  if (!clerkKey) {
    return content
  }

  return (
    <ClerkProvider localization={frFR}>
      {content}
    </ClerkProvider>
  )
}

