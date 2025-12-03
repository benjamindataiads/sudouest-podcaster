'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArticleWithScore, PodcastScript, ScriptChunk } from '@/types'
import { Loader2, X, Edit2, Trash2, Plus, Save, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react'

interface StepTwoProps {
  selectedArticles: ArticleWithScore[]
  existingScript?: PodcastScript | null
  onComplete: (script: PodcastScript) => void
  onBack: () => void
}

export default function StepTwo({ selectedArticles, existingScript, onComplete, onBack }: StepTwoProps) {
  const [script, setScript] = useState<PodcastScript | null>(existingScript || null)
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editedScript, setEditedScript] = useState<string>('')
  const [progressPercent, setProgressPercent] = useState<number>(0)
  const [editingChunks, setEditingChunks] = useState(false)
  const [editedChunks, setEditedChunks] = useState<ScriptChunk[]>([])
  const [editingChunkIndex, setEditingChunkIndex] = useState<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Charger le script existant si disponible
  useEffect(() => {
    if (existingScript) {
      console.log('✅ Loading existing script from database')
      setScript(existingScript)
      setEditedScript(formatScriptForEditing(existingScript))
    }
  }, [existingScript])

  // Générer automatiquement SEULEMENT si aucun script n'existe
  useEffect(() => {
    if (selectedArticles.length > 0 && !script && !existingScript) {
      console.log('🔄 No existing script, generating new one...')
      generateScript()
    }
  }, [selectedArticles, existingScript])

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setLoading(false)
    setProgressPercent(0)
  }

  const generateScript = async () => {
    try {
      setLoading(true)
      setProgressPercent(10)
      console.log('Generating script for', selectedArticles.length, 'articles')
      
      // Créer un AbortController pour pouvoir annuler
      abortControllerRef.current = new AbortController()
      
      setProgressPercent(20)
      
      const response = await fetch('/api/script/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articles: selectedArticles,
          targetDuration: 240,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.details || 'Erreur lors de la génération du script')
      }

      setProgressPercent(80)
      const data = await response.json()
      setProgressPercent(100)
      
      setScript(data.script)
      setEditedScript(formatScriptForEditing(data.script))
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Script generation cancelled by user')
        return
      }
      console.error('Error generating script:', err)
      alert(err instanceof Error ? err.message : 'Erreur lors de la génération du script')
    } finally {
      setLoading(false)
      setProgressPercent(0)
      abortControllerRef.current = null
    }
  }

  const formatScriptForEditing = (s: PodcastScript): string => {
    let text = `${s.introduction}\n\n`
    
    s.articles.forEach(article => {
      text += `[${article.title}]\n${article.content}\n\n`
    })
    
    text += s.conclusion
    
    return text
  }

  const handleSaveEdit = () => {
    if (!script) {
      return
    }

    // Parser le script édité
    const lines = editedScript.split('\n')
    const newScript: PodcastScript = {
      introduction: '',
      articles: [],
      conclusion: '',
      estimatedDuration: script.estimatedDuration,
    }

    let currentSection = 'introduction'
    let currentArticleIndex = -1
    let buffer = ''

    lines.forEach(line => {
      if (line.startsWith('[') && line.endsWith(']')) {
        // Nouvelle section d'article
        if (currentSection === 'introduction' && buffer) {
          newScript.introduction = buffer.trim()
        }
        
        currentSection = 'article'
        currentArticleIndex++
        newScript.articles.push({
          articleId: currentArticleIndex,
          title: line.slice(1, -1),
          content: '',
        })
        buffer = ''
      } else {
        buffer += line + '\n'
      }
    })

    // Sauvegarder le dernier buffer
    if (currentSection === 'introduction') {
      newScript.introduction = buffer.trim()
    } else if (currentSection === 'article' && currentArticleIndex >= 0) {
      // Le reste est la conclusion
      const parts = buffer.split('\n\n')
      if (parts.length > 1) {
        newScript.articles[currentArticleIndex].content = parts[0].trim()
        newScript.conclusion = parts.slice(1).join('\n\n').trim()
      } else {
        newScript.articles[currentArticleIndex].content = buffer.trim()
      }
    }

    // Régénérer les chunks à partir du script édité
    const chunks = generateChunksFromScript(newScript)
    
    setScript({
      ...newScript,
      chunks,
    })
    setEditing(false)
  }

  // Fonction pour découper un script en chunks de 300 caractères max
  const generateChunksFromScript = (s: PodcastScript): ScriptChunk[] => {
    const chunks: ScriptChunk[] = []
    let index = 0

    // Introduction
    const introChunks = splitTextIntoChunks(s.introduction)
    introChunks.forEach(text => {
      chunks.push({ text, index: index++, section: 'introduction' })
    })

    // Articles
    s.articles.forEach(article => {
      const articleChunks = splitTextIntoChunks(article.content)
      articleChunks.forEach(text => {
        chunks.push({
          text,
          index: index++,
          section: 'article',
          articleTitle: article.title,
        })
      })
    })

    // Conclusion
    const conclusionChunks = splitTextIntoChunks(s.conclusion)
    conclusionChunks.forEach(text => {
      chunks.push({ text, index: index++, section: 'conclusion' })
    })

    return chunks
  }

  // Découpe un texte en chunks de max 300 caractères
  const splitTextIntoChunks = (text: string): string[] => {
    if (!text || text.length <= 300) return [text]

    const chunks: string[] = []
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
    let currentChunk = ''

    sentences.forEach(sentence => {
      const trimmed = sentence.trim()
      const testChunk = currentChunk ? currentChunk + ' ' + trimmed : trimmed

      if (testChunk.length > 300) {
        if (currentChunk) {
          chunks.push(currentChunk.trim())
        }
        // Si une phrase seule > 300, la tronquer
        if (trimmed.length > 300) {
          chunks.push(trimmed.substring(0, 297) + '...')
          currentChunk = ''
        } else {
          currentChunk = trimmed
        }
      } else {
        currentChunk = testChunk
      }
    })

    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }

    return chunks.filter(c => c.length > 0)
  }

  const handleContinue = () => {
    if (script) {
      onComplete(script)
    }
  }

  const startEditingChunks = () => {
    if (script?.chunks) {
      setEditedChunks([...script.chunks])
      setEditingChunks(true)
    }
  }

  const saveChunkEdits = () => {
    if (script) {
      // Re-indexer les chunks et vérifier qu'ils respectent la limite de 300 caractères
      const reindexedChunks = editedChunks.map((chunk, idx) => {
        let text = chunk.text
        if (text.length > 300) {
          console.warn(`⚠️ Chunk ${idx} exceeds 300 chars (${text.length}), truncating...`)
          text = text.substring(0, 297) + '...'
        }
        return {
          ...chunk,
          text,
          index: idx,
        }
      })

      setScript({
        ...script,
        chunks: reindexedChunks,
      })
      setEditingChunks(false)
      setEditingChunkIndex(null)
    }
  }

  const cancelChunkEdits = () => {
    setEditingChunks(false)
    setEditingChunkIndex(null)
    setEditedChunks([])
  }

  const updateChunkText = (index: number, newText: string) => {
    const updated = [...editedChunks]
    updated[index] = {
      ...updated[index],
      text: newText,
    }
    setEditedChunks(updated)
  }

  const deleteChunk = (index: number) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce segment ?')) {
      setEditedChunks(editedChunks.filter((_, idx) => idx !== index))
    }
  }

  const addNewChunk = () => {
    const newChunk: ScriptChunk = {
      text: '',
      index: editedChunks.length,
      section: 'article',
    }
    setEditedChunks([...editedChunks, newChunk])
    setEditingChunkIndex(editedChunks.length)
  }

  const moveChunkUp = (index: number) => {
    if (index === 0) return
    const updated = [...editedChunks]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setEditedChunks(updated)
  }

  const moveChunkDown = (index: number) => {
    if (index === editedChunks.length - 1) return
    const updated = [...editedChunks]
    ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
    setEditedChunks(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Génération du script</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={cancelGeneration}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Annuler
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">Génération du script en cours...</p>
              <p className="text-sm text-gray-500 mb-4">Cela peut prendre quelques secondes</p>
            </div>
            
            {/* Barre de progression */}
            <div className="space-y-2">
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-center text-gray-500">
                {progressPercent}% complété
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!script) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Erreur</CardTitle>
          <CardDescription>Impossible de générer le script</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateScript}>Réessayer</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Script du podcast</CardTitle>
              <CardDescription>
                {script.chunks && script.chunks.length > 0 && (
                  <span>{script.chunks.length} segments • </span>
                )}
                Durée estimée : {Math.floor(script.estimatedDuration / 60)} min {script.estimatedDuration % 60} sec
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {script.chunks && script.chunks.length > 0 && !editingChunks && (
                <Button 
                  variant="outline"
                  onClick={startEditingChunks}
                  className="flex items-center gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Éditer les segments
                </Button>
              )}
              {editingChunks && (
                <>
                  <Button 
                    variant="outline"
                    onClick={cancelChunkEdits}
                  >
                    Annuler
                  </Button>
                  <Button 
                    onClick={saveChunkEdits}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Enregistrer
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editingChunks ? (
            <div className="space-y-4">
              {/* Header with add button */}
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">
                  Mode édition • {editedChunks.length} segments
                </p>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={addNewChunk}
                  className="flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter un segment
                </Button>
              </div>

              {/* Editable chunks */}
              {editedChunks.map((chunk, idx) => {
                const isEditing = editingChunkIndex === idx
                const charCount = chunk.text.length
                const isOverLimit = charCount > 300
                
                return (
                  <div 
                    key={idx} 
                    className={`p-4 rounded-lg border-2 transition-all ${
                      chunk.section === 'introduction' ? 'bg-blue-50 border-blue-300' :
                      chunk.section === 'conclusion' ? 'bg-green-50 border-green-300' :
                      'bg-white border-gray-300'
                    } ${isEditing ? 'ring-2 ring-blue-500' : ''}`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">
                          Segment {idx + 1}/{editedChunks.length}
                          {chunk.section === 'introduction' && ' - Introduction'}
                          {chunk.section === 'conclusion' && ' - Conclusion'}
                          {chunk.section === 'article' && chunk.articleTitle && ` - ${chunk.articleTitle}`}
                        </span>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveChunkUp(idx)}
                          disabled={idx === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Monter"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => moveChunkDown(idx)}
                          disabled={idx === editedChunks.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Descendre"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteChunk(idx)}
                          className="p-1 hover:bg-red-100 rounded text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Text editor */}
                    <textarea
                      value={chunk.text}
                      onChange={(e) => updateChunkText(idx, e.target.value)}
                      onFocus={() => setEditingChunkIndex(idx)}
                      onBlur={() => setEditingChunkIndex(null)}
                      className="w-full p-3 border rounded-lg font-sans text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={4}
                      placeholder="Entrez le texte du segment..."
                    />

                    {/* Character count */}
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-xs font-medium ${
                        isOverLimit ? 'text-red-600' : 
                        charCount > 250 ? 'text-orange-600' : 
                        'text-gray-500'
                      }`}>
                        {charCount}/300 caractères
                        {isOverLimit && (
                          <span className="ml-2 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Dépasse la limite !
                          </span>
                        )}
                      </span>
                      {charCount > 250 && !isOverLimit && (
                        <span className="text-xs text-orange-600">
                          Proche de la limite
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="prose max-w-none">
              {/* Afficher les chunks si disponibles */}
              {script.chunks && script.chunks.length > 0 ? (
                <div className="space-y-3">
                  <div className="mb-4 p-3 bg-gray-100 rounded">
                    <p className="text-sm text-gray-600">
                      📝 Script découpé en <strong>{script.chunks.length} segments</strong> pour la génération audio
                    </p>
                  </div>
                  
                  {script.chunks.map((chunk, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border-l-4 ${
                        chunk.section === 'introduction' ? 'bg-blue-50 border-blue-500' :
                        chunk.section === 'conclusion' ? 'bg-green-50 border-green-500' :
                        'bg-white border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          Segment {chunk.index + 1}/{script.chunks!.length}
                          {chunk.section === 'introduction' && ' - Introduction'}
                          {chunk.section === 'conclusion' && ' - Conclusion'}
                          {chunk.section === 'article' && chunk.articleTitle && ` - ${chunk.articleTitle}`}
                        </span>
                        <span className="text-xs text-gray-400">{chunk.text.length} chars</span>
                      </div>
                      <p className="text-sm text-gray-800">{chunk.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                // Affichage classique si pas de chunks
                <>
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2 text-blue-900">Introduction</h3>
                    <p className="text-gray-800 whitespace-pre-wrap">{script.introduction}</p>
                  </div>

                  {script.articles.map((article, idx) => (
                    <div key={idx} className="mb-6 p-4 bg-white border rounded-lg">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">
                        Article {idx + 1} : {article.title}
                      </h3>
                      <p className="text-gray-800 whitespace-pre-wrap">{article.content}</p>
                    </div>
                  ))}

                  <div className="p-4 bg-green-50 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2 text-green-900">Conclusion</h3>
                    <p className="text-gray-800 whitespace-pre-wrap">{script.conclusion}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Retour
        </Button>
        <div className="space-x-3">
          <Button variant="outline" onClick={generateScript}>
            Régénérer
          </Button>
          <Button onClick={handleContinue} size="lg">
            Continuer vers la production
          </Button>
        </div>
      </div>
    </div>
  )
}

