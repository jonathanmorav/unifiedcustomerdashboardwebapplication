"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/v0/header"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { ReconciliationTab } from "@/components/billing/ReconciliationTab"

export default function ReconciliationPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Redirect if not authenticated
  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/auth/signin")
    }
  }, [session, status, router])

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        <ReconciliationTab />
      </main>
    </div>
  )
}