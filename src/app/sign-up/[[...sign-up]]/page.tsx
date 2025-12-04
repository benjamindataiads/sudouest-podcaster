import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
            headerTitle: "text-[#D42E1B]",
            primaryButton: "bg-[#D42E1B] hover:bg-[#B01030]",
          }
        }}
      />
    </div>
  )
}

