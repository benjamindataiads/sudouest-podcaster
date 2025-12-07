'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  SignedIn, 
  SignedOut, 
  SignInButton, 
  UserButton, 
  OrganizationSwitcher,
  useAuth,
  useOrganization
} from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import DefaultLogo from '@/components/ui/DefaultLogo'
import { useBranding } from '@/contexts/BrandingContext'
import { 
  Mic, 
  Film, 
  User, 
  Settings, 
  Menu,
  X,
  ChevronRight,
  LogIn
} from 'lucide-react'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const podcastItems: NavItem[] = [
  { label: 'Mes podcasts', href: '/', icon: <Mic className="h-5 w-5" /> },
  { label: 'Galerie', href: '/gallery', icon: <Film className="h-5 w-5" /> },
]

const avatarItems: NavItem[] = [
  { label: 'Avatars', href: '/avatars', icon: <User className="h-5 w-5" /> },
]

function NavSection({ 
  title, 
  items 
}: { 
  title: string
  items: NavItem[] 
}) {
  const pathname = usePathname()
  
  return (
    <div className="mb-6">
      <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {title}
      </h3>
      <nav className="space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-gray-100 text-gray-900 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {isActive && <ChevronRight className="h-4 w-4 ml-auto" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function OrgLogo() {
  const { branding } = useBranding()
  const { organization } = useOrganization()
  
  if (branding.logoUrl) {
    return (
      <img 
        src={branding.logoUrl} 
        alt={organization?.name || 'Logo'} 
        className="h-10 w-auto max-w-[160px] object-contain"
      />
    )
  }
  
  return <DefaultLogo width={40} height={40} />
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { orgRole } = useAuth()
  const isAdmin = orgRole === 'org:admin'

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header with Logo + Org Switcher */}
      <div className="border-b border-gray-200">
        <SignedIn>
          {/* Organization Switcher - allows creating orgs */}
          <OrganizationSwitcher 
            hidePersonal={false}
            afterCreateOrganizationUrl="/"
            afterSelectOrganizationUrl="/"
            afterLeaveOrganizationUrl="/"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors cursor-pointer border-0 rounded-none",
                organizationPreviewMainIdentifier: "font-bold text-gray-900",
                organizationPreviewSecondaryIdentifier: "text-xs text-gray-500",
                organizationSwitcherTriggerIcon: "text-gray-400 ml-auto",
              }
            }}
          />
        </SignedIn>
        <SignedOut>
          <div className="flex items-center gap-3 p-4">
            <OrgLogo />
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-gray-900 truncate">Podcaster</h1>
              <p className="text-xs text-gray-500">Créateur de podcasts IA</p>
            </div>
          </div>
        </SignedOut>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <NavSection title="Podcasts" items={podcastItems} />
        <NavSection title="Personnages" items={avatarItems} />
      </div>

      {/* Bottom section: Settings & User */}
      <div className="p-3 border-t border-gray-200 space-y-2">
        {/* Settings - visible to all, page handles access control */}
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-all"
        >
          <Settings className="h-5 w-5" />
          <span>Paramètres</span>
          {isAdmin && (
            <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded">Admin</span>
          )}
        </Link>

        {/* User profile */}
        <SignedIn>
          <div className="flex items-center gap-3 px-3 py-2">
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "w-9 h-9"
                }
              }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">Mon compte</p>
              <p className="text-xs text-gray-500">Gérer le profil</p>
            </div>
          </div>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button className="w-full" variant="outline">
              <LogIn className="h-4 w-4 mr-2" />
              Connexion
            </Button>
          </SignInButton>
        </SignedOut>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
      >
        <Menu className="h-6 w-6 text-gray-600" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        >
          <div 
            className="w-72 h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 p-2 text-gray-500 hover:text-gray-700"
            >
              <X className="h-6 w-6" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-72 h-screen fixed left-0 top-0">
        {sidebarContent}
      </aside>
    </>
  )
}
