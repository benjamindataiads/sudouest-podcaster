import { NextResponse } from 'next/server'

/**
 * POST /api/video-jobs/process-all
 * Déclenche le traitement de tous les jobs en attente (en parallèle)
 */
export async function POST() {
  try {
    console.log('🚀 Starting batch processing of all queued jobs...')
    
    // Lancer plusieurs workers en parallèle
    const workers = Array.from({ length: 3 }, async (_, idx) => {
      console.log(`Worker ${idx + 1} started`)
      
      let processed = 0
      let hasMore = true
      
      while (hasMore) {
        try {
          const response = await fetch('http://localhost:3001/api/video-jobs/process', {
            method: 'POST',
          })
          
          const data = await response.json()
          
          if (data.success) {
            processed++
            console.log(`Worker ${idx + 1}: Processed ${processed} jobs`)
            hasMore = data.hasMore
            
            // Petite pause entre chaque job
            await new Promise(resolve => setTimeout(resolve, 1000))
          } else {
            hasMore = data.hasMore
            if (!hasMore) break
          }
        } catch (error) {
          console.error(`Worker ${idx + 1} error:`, error)
          break
        }
      }
      
      return processed
    })
    
    const results = await Promise.all(workers)
    const totalProcessed = results.reduce((sum, n) => sum + n, 0)
    
    console.log(`✅ Batch processing completed: ${totalProcessed} jobs processed`)
    
    return NextResponse.json({
      success: true,
      jobsProcessed: totalProcessed,
      workers: results,
    })
    
  } catch (error) {
    console.error('Error in batch processing:', error)
    return NextResponse.json(
      { 
        error: 'Erreur lors du traitement batch',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

