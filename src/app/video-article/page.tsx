'use client'

import { useAuth } from '@clerk/nextjs'
import Sidebar from '@/components/layout/Sidebar'
import { Card, CardContent } from '@/components/ui/card'
import { Newspaper, Construction } from 'lucide-react'

export default function VideoArticlePage() {
  const { isLoaded, isSignedIn } = useAuth()

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--brand-secondary)' }}>
      <Sidebar />
      
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--brand-text)' }}>
              Video Article
            </h1>
            <p style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
              Transformez vos articles en vidéos engageantes
            </p>
          </div>

          {/* Coming Soon Card */}
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-12 text-center">
              <div 
                className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ backgroundColor: 'var(--brand-accent)', opacity: 0.15 }}
              >
                <Newspaper className="h-10 w-10" style={{ color: 'var(--brand-accent)' }} />
              </div>
              
              <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--brand-text)' }}>
                Bientôt disponible
              </h2>
              
              <p className="mb-6" style={{ color: 'var(--brand-text)', opacity: 0.6 }}>
                Cette fonctionnalité est en cours de développement.
                <br />
                Revenez bientôt pour découvrir la création de vidéos à partir d'articles.
              </p>

              <div className="flex items-center justify-center gap-2" style={{ color: 'var(--brand-text)', opacity: 0.4 }}>
                <Construction className="h-5 w-5" />
                <span className="text-sm">En construction</span>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <footer className="mt-12 pt-6" style={{ borderTop: '1px solid var(--brand-secondary)' }}>
            <div className="flex items-center justify-between text-sm" style={{ color: 'var(--brand-text)', opacity: 0.4 }}>
              <span>Video Creator © 2025</span>
              <span>POC Propulsé par l'IA et Carole Fourcade</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}

