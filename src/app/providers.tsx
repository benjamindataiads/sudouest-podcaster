'use client'

import { VideoGenerationProvider } from '@/contexts/VideoGenerationContext'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <VideoGenerationProvider>
      {children}
    </VideoGenerationProvider>
  )
}

