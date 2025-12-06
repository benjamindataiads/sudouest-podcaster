import { SignUp } from '@clerk/nextjs'
import DefaultLogo from '@/components/ui/DefaultLogo'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      {/* Header avec logo */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <DefaultLogo width={56} height={56} />
          <div className="h-12 w-px bg-gray-200" />
          <h1 className="text-3xl font-bold text-gray-900">Podcaster</h1>
        </div>
        <p className="text-gray-500 text-lg">
          Créez votre compte pour commencer
        </p>
      </div>

      {/* Formulaire Clerk */}
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg rounded-xl border border-gray-200 bg-white",
            headerTitle: "text-gray-900 font-bold",
            headerSubtitle: "text-gray-500",
            socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50 text-gray-700",
            socialButtonsBlockButtonText: "text-gray-700",
            formButtonPrimary: "bg-gray-900 hover:bg-gray-800 text-white",
            footerActionLink: "text-purple-600 hover:text-purple-700",
            identifierPreviewEditButton: "text-purple-600",
            formFieldInput: "border-gray-200 focus:border-purple-500 focus:ring-purple-500",
            dividerLine: "bg-gray-200",
            dividerText: "text-gray-400",
            formFieldLabel: "text-gray-700",
            otpCodeFieldInput: "border-gray-200",
          }
        }}
      />

      {/* Footer */}
      <div className="mt-8 text-gray-400 text-sm">
        © 2025 Podcaster · POC Propulsé par l&apos;IA
      </div>
    </div>
  )
}
