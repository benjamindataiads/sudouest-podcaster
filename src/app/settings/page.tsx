'use client'

import { useState, useEffect } from 'react'
import { useAuth, useOrganization } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Sidebar from '@/components/layout/Sidebar'
import DefaultLogo from '@/components/ui/DefaultLogo'
import Link from 'next/link'
import { 
  Palette, 
  Rss, 
  Users, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  ExternalLink,
  AlertCircle
} from 'lucide-react'

interface OrganizationBranding {
  logoUrl?: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  textColor: string
  fontFamily: string
}

interface RssFeed {
  id: number
  orgId: string
  name: string
  url: string
  isActive: boolean
  lastFetchedAt?: string
}

const DEFAULT_BRANDING: OrganizationBranding = {
  primaryColor: '#ffffff',
  secondaryColor: '#e5e7eb',
  accentColor: '#8B5CF6',
  textColor: '#111827',
  fontFamily: 'Inter, system-ui, sans-serif',
}

export default function SettingsPage() {
  const { isLoaded, orgId, orgRole } = useAuth()
  const { organization } = useOrganization()
  
  const [branding, setBranding] = useState<OrganizationBranding>(DEFAULT_BRANDING)
  const [feeds, setFeeds] = useState<RssFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newFeed, setNewFeed] = useState({ name: '', url: '' })
  const [addingFeed, setAddingFeed] = useState(false)

  const isAdmin = orgRole === 'org:admin'

  useEffect(() => {
    if (isLoaded && orgId) {
      fetchSettings()
      fetchFeeds()
    } else {
      setLoading(false)
    }
  }, [isLoaded, orgId])

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/organizations/settings')
      const data = await res.json()
      if (data.branding) {
        setBranding(data.branding)
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
    }
  }

  const fetchFeeds = async () => {
    try {
      const res = await fetch('/api/organizations/rss-feeds')
      const data = await res.json()
      if (data.feeds) {
        setFeeds(data.feeds)
      }
    } catch (error) {
      console.error('Error fetching feeds:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveBranding = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/organizations/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: organization?.name,
          branding 
        }),
      })
      if (res.ok) {
        alert('Paramètres sauvegardés !')
      } else {
        alert('Erreur lors de la sauvegarde')
      }
    } catch (error) {
      console.error('Error saving branding:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  const addFeed = async () => {
    if (!newFeed.name || !newFeed.url) return
    
    setAddingFeed(true)
    try {
      const res = await fetch('/api/organizations/rss-feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFeed),
      })
      if (res.ok) {
        const data = await res.json()
        setFeeds([...feeds, data.feed])
        setNewFeed({ name: '', url: '' })
      } else {
        const error = await res.json()
        alert(error.error || 'Erreur lors de l\'ajout')
      }
    } catch (error) {
      console.error('Error adding feed:', error)
    } finally {
      setAddingFeed(false)
    }
  }

  const deleteFeed = async (id: number) => {
    if (!confirm('Supprimer ce flux RSS ?')) return
    
    try {
      const res = await fetch(`/api/organizations/rss-feeds/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setFeeds(feeds.filter(f => f.id !== id))
      }
    } catch (error) {
      console.error('Error deleting feed:', error)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="lg:ml-72 min-h-screen p-6 lg:p-8">
          <Card className="max-w-md mx-auto mt-20">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Aucune organisation sélectionnée</h2>
              <p className="text-gray-500 mb-6">
                Pour accéder aux paramètres, veuillez d'abord créer ou rejoindre une organisation.
              </p>
              <Link href="/">
                <Button className="bg-gray-900 hover:bg-gray-800 text-white">
                  Retour à l'accueil
                </Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  // Non-admins can view but not edit
  const canEdit = isAdmin

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <main className="lg:ml-72 min-h-screen">
        <div className="p-6 lg:p-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Paramètres</h1>
                <p className="text-gray-500">{organization?.name}</p>
              </div>
              {!canEdit && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
                  <p className="text-sm text-yellow-800">
                    👁️ Mode lecture seule - Contactez un admin pour modifier
                  </p>
                </div>
              )}
            </div>
          </div>

          <Tabs defaultValue="branding" className="space-y-6">
            <TabsList className="bg-white shadow-sm border border-gray-200">
              <TabsTrigger value="branding" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Apparence
              </TabsTrigger>
              <TabsTrigger value="feeds" className="flex items-center gap-2">
                <Rss className="h-4 w-4" />
                Sources
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Équipe
              </TabsTrigger>
            </TabsList>

            {/* Branding Tab */}
            <TabsContent value="branding">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Palette className="h-5 w-5 text-purple-500" />
                    Personnalisation de l'apparence
                  </h2>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Logo */}
                    <div className="md:col-span-2">
                      <Label>URL du logo</Label>
                      <Input
                        value={branding.logoUrl || ''}
                        onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
                        placeholder="https://exemple.com/logo.png"
                        className="mt-1 border-gray-200"
                      />
                      <p className="text-xs text-gray-400 mt-1">Laissez vide pour utiliser le logo par défaut</p>
                    </div>

                    {/* Colors */}
                    <div>
                      <Label>Couleur principale (fond)</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.primaryColor}
                          onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                          className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                        />
                        <Input
                          value={branding.primaryColor}
                          onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                          className="flex-1 border-gray-200"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Couleur secondaire (bordures)</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.secondaryColor}
                          onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                          className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                        />
                        <Input
                          value={branding.secondaryColor}
                          onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })}
                          className="flex-1 border-gray-200"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Couleur d'accent</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.accentColor}
                          onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                          className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                        />
                        <Input
                          value={branding.accentColor}
                          onChange={(e) => setBranding({ ...branding, accentColor: e.target.value })}
                          className="flex-1 border-gray-200"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Couleur du texte</Label>
                      <div className="flex gap-2 mt-1">
                        <input
                          type="color"
                          value={branding.textColor}
                          onChange={(e) => setBranding({ ...branding, textColor: e.target.value })}
                          className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                        />
                        <Input
                          value={branding.textColor}
                          onChange={(e) => setBranding({ ...branding, textColor: e.target.value })}
                          className="flex-1 border-gray-200"
                        />
                      </div>
                    </div>

                    {/* Font */}
                    <div className="md:col-span-2">
                      <Label>Police de caractères</Label>
                      <Input
                        value={branding.fontFamily}
                        onChange={(e) => setBranding({ ...branding, fontFamily: e.target.value })}
                        placeholder="Inter, system-ui, sans-serif"
                        className="mt-1 border-gray-200"
                      />
                    </div>

                    {/* Preview */}
                    <div className="md:col-span-2 mt-4">
                      <Label className="mb-3 block">Aperçu</Label>
                      <div 
                        className="rounded-xl overflow-hidden border"
                        style={{ 
                          backgroundColor: branding.primaryColor,
                          borderColor: branding.secondaryColor,
                        }}
                      >
                        <div className="p-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${branding.secondaryColor}` }}>
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-10 w-auto" />
                          ) : (
                            <DefaultLogo width={40} height={40} />
                          )}
                          <span 
                            className="font-bold text-lg"
                            style={{ color: branding.textColor, fontFamily: branding.fontFamily }}
                          >
                            {organization?.name || 'Votre Organisation'}
                          </span>
                        </div>
                        <div className="p-4">
                          <button
                            className="px-4 py-2 rounded-lg font-medium"
                            style={{ 
                              backgroundColor: branding.accentColor,
                              color: '#ffffff',
                              fontFamily: branding.fontFamily,
                            }}
                          >
                            Bouton d'exemple
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="mt-6 flex justify-end">
                      <Button 
                        onClick={saveBranding} 
                        disabled={saving}
                        className="bg-gray-900 hover:bg-gray-800 text-white"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Sauvegarder
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* RSS Feeds Tab */}
            <TabsContent value="feeds">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Rss className="h-5 w-5 text-purple-500" />
                    Sources de données RSS
                  </h2>

                  {/* Add new feed */}
                  {canEdit && (
                    <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
                      <h3 className="font-medium mb-3 text-gray-700">Ajouter un flux RSS</h3>
                      <div className="grid md:grid-cols-3 gap-3">
                        <Input
                          placeholder="Nom du flux"
                          value={newFeed.name}
                          onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                          className="border-gray-200"
                        />
                        <Input
                          placeholder="URL du flux RSS"
                          value={newFeed.url}
                          onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                          className="border-gray-200"
                        />
                        <Button 
                          onClick={addFeed} 
                          disabled={addingFeed || !newFeed.name || !newFeed.url}
                          className="bg-gray-900 hover:bg-gray-800 text-white"
                        >
                          {addingFeed ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4 mr-2" />
                          )}
                          Ajouter
                        </Button>
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        Exemple: https://flipboard.com/topic/fr-afp.rss
                      </p>
                    </div>
                  )}

                  {/* Existing feeds */}
                  <div className="space-y-3">
                    {feeds.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Rss className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun flux RSS configuré</p>
                        <p className="text-sm">Ajoutez votre premier flux ci-dessus</p>
                      </div>
                    ) : (
                      feeds.map((feed) => (
                        <div 
                          key={feed.id}
                          className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{feed.name}</h4>
                            <p className="text-sm text-gray-400 truncate max-w-md">{feed.url}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <a 
                              href={feed.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-gray-600"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                            {canEdit && (
                              <button
                                onClick={() => deleteFeed(feed.id)}
                                className="p-2 text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <Card className="border border-gray-200">
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-500" />
                    Gestion de l'équipe
                  </h2>

                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 text-center">
                    <Users className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                    <h3 className="font-medium text-lg mb-2">Gérer les membres</h3>
                    <p className="text-gray-600 mb-4">
                      La gestion des utilisateurs se fait via le sélecteur d'organisation.
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Cliquez sur votre organisation dans le menu, puis sur "Gérer l'organisation" pour:
                    </p>
                    <ul className="text-sm text-gray-600 text-left max-w-xs mx-auto space-y-1">
                      <li>• Inviter de nouveaux membres</li>
                      <li>• Gérer les rôles (Admin / Membre)</li>
                      <li>• Supprimer des membres</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Podcaster © 2025</span>
              <span>POC Propulsé par l'IA</span>
            </div>
          </footer>
        </div>
      </main>
    </div>
  )
}
