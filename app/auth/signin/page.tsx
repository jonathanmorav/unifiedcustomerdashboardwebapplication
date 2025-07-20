"use client"

import { Suspense } from "react"
import { AuthScreen } from "@/components/v0/auth-screen"

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cakewalk-alice-100 flex items-center justify-center p-4">
        <div className="animate-pulse">
          <div className="w-96 h-96 bg-white rounded-xl shadow-lg"></div>
        </div>
      </div>
    }>
      <AuthScreen />
    </Suspense>
  )
}