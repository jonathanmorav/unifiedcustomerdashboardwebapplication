"use client"

import { Suspense } from "react"
import { AuthScreen } from "@/components/v0/auth-screen"

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-cakewalk-alice-100 dark:bg-gray-900 p-4">
          <div className="animate-pulse">
            <div className="h-96 w-96 rounded-xl bg-white dark:bg-gray-800 shadow-lg"></div>
          </div>
        </div>
      }
    >
      <AuthScreen />
    </Suspense>
  )
}
