import { SignIn } from '@clerk/nextjs'
import SudOuestLogo from '@/components/ui/SudOuestLogo'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#D42E1B]">
      {/* Header avec logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <SudOuestLogo width={180} height={60} fill="white" />
          <div className="h-12 w-px bg-white/30" />
          <h1 className="text-3xl font-bold text-white">Podcaster</h1>
        </div>
        <p className="text-white/80 text-lg">
          Connectez-vous pour accéder à votre espace
        </p>
      </div>

      {/* Formulaire Clerk */}
      <SignIn 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-2xl rounded-xl",
            headerTitle: "text-[#D42E1B] font-bold",
            headerSubtitle: "text-gray-600",
            socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50",
            formButtonPrimary: "bg-[#D42E1B] hover:bg-[#B01030] text-white",
            footerActionLink: "text-[#D42E1B] hover:text-[#B01030]",
            identifierPreviewEditButton: "text-[#D42E1B]",
          }
        }}
      />

      {/* Footer */}
      <div className="mt-8 text-white/60 text-sm">
        © 2024 Sud-Ouest Podcaster
      </div>
    </div>
  )
}

