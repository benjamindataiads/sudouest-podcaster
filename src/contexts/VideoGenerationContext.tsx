'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

export interface VideoJob {
  id: string
  podcastId?: number | null
  audioChunkIndex: number
  audioUrl: string
  status: 'queued' | 'generating' | 'completed' | 'failed'
  videoUrl?: string | null
  error?: string | null
  createdAt: Date
  updatedAt: Date
  completedAt?: Date | null
  text?: string | null
  section?: string | null
}

interface VideoGenerationContextType {
  jobs: VideoJob[]
  addJob: (audioUrl: string, audioChunkIndex: number, text?: string, section?: string, podcastId?: number, avatarImageUrl?: string) => Promise<string>
  updateJobStatus: (jobId: string, status: VideoJob['status'], videoUrl?: string, error?: string) => Promise<void>
  clearJobs: (podcastId?: number) => Promise<void>
  refreshJobs: (podcastId?: number) => Promise<void>
  getJobById: (jobId: string) => VideoJob | undefined
  getActiveJobs: () => VideoJob[]
  isGenerating: boolean
}

const VideoGenerationContext = createContext<VideoGenerationContextType | undefined>(undefined)

export function VideoGenerationProvider({ children }: { children: React.ReactNode }) {
  const [jobs, setJobs] = useState<VideoJob[]>([])

  // Charger tous les jobs au démarrage
  const refreshJobs = useCallback(async (podcastId?: number) => {
    try {
      const url = podcastId 
        ? `/api/video-jobs?podcastId=${podcastId}`
        : '/api/video-jobs'
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        const loadedJobs = data.jobs.map((job: VideoJob) => ({
          ...job,
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
          completedAt: job.completedAt ? new Date(job.completedAt) : null,
        }))
        
        setJobs(loadedJobs)
        console.log(`✅ Loaded ${loadedJobs.length} jobs from database`)
        
        // Afficher un résumé
        const pending = loadedJobs.filter((j: VideoJob) => j.status === 'queued' || j.status === 'generating').length
        const completed = loadedJobs.filter((j: VideoJob) => j.status === 'completed').length
        const failed = loadedJobs.filter((j: VideoJob) => j.status === 'failed').length
        console.log(`📊 Jobs status: ${pending} pending, ${completed} completed, ${failed} failed`)
      }
    } catch (error) {
      console.error('Error loading jobs:', error)
    }
  }, [])

  // Charger les jobs au montage
  useEffect(() => {
    refreshJobs()
  }, [])

  const addJob = useCallback(async (audioUrl: string, audioChunkIndex: number, text?: string, section?: string, podcastId?: number, avatarImageUrl?: string): Promise<string> => {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substring(7)}`
    
    try {
      // Créer le job dans la DB
      const response = await fetch('/api/video-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
      id: jobId,
          podcastId: podcastId || null,
      audioChunkIndex,
      audioUrl,
          text: text || null,
          section: section || null,
          avatarImageUrl: avatarImageUrl || null, // Image variant for this segment
      status: 'queued',
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newJob = {
          ...data.job,
          createdAt: new Date(data.job.createdAt),
          updatedAt: new Date(data.job.updatedAt),
          completedAt: data.job.completedAt ? new Date(data.job.completedAt) : null,
    }
        
        // Mettre à jour le state local
    setJobs(prev => [...prev, newJob])
        console.log(`✅ Added job ${jobId} to database`)
      }
    } catch (error) {
      console.error('Error adding job:', error)
    }

    return jobId
  }, [])

  const updateJobStatus = useCallback(async (
    jobId: string, 
    status: VideoJob['status'], 
    videoUrl?: string, 
    error?: string
  ) => {
    try {
      // Mettre à jour dans la DB
      const response = await fetch(`/api/video-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, videoUrl, error }),
      })

      if (response.ok) {
        const data = await response.json()
        const updatedJob = {
          ...data.job,
          createdAt: new Date(data.job.createdAt),
          updatedAt: new Date(data.job.updatedAt),
          completedAt: data.job.completedAt ? new Date(data.job.completedAt) : null,
        }
        
        // Mettre à jour le state local
    setJobs(prev => prev.map(job => 
          job.id === jobId ? updatedJob : job
        ))
        console.log(`✅ Updated job ${jobId} status to ${status}`)
      }
    } catch (error) {
      console.error('Error updating job status:', error)
    }
  }, [])

  const clearJobs = useCallback(async (podcastId?: number) => {
    try {
      const url = podcastId 
        ? `/api/video-jobs?podcastId=${podcastId}`
        : '/api/video-jobs'
      
      await fetch(url, { method: 'DELETE' })
    setJobs([])
      console.log('🗑️ Cleared all jobs from database')
    } catch (error) {
      console.error('Error clearing jobs:', error)
    }
  }, [])

  const getJobById = useCallback((jobId: string) => {
    return jobs.find(job => job.id === jobId)
  }, [jobs])

  const getActiveJobs = useCallback(() => {
    return jobs.filter(job => job.status === 'queued' || job.status === 'generating')
  }, [jobs])

  const isGenerating = jobs.some(job => job.status === 'queued' || job.status === 'generating')

  return (
    <VideoGenerationContext.Provider value={{
      jobs,
      addJob,
      updateJobStatus,
      clearJobs,
      refreshJobs,
      getJobById,
      getActiveJobs,
      isGenerating,
    }}>
      {children}
    </VideoGenerationContext.Provider>
  )
}

export function useVideoGeneration() {
  const context = useContext(VideoGenerationContext)
  if (!context) {
    throw new Error('useVideoGeneration must be used within VideoGenerationProvider')
  }
  return context
}

