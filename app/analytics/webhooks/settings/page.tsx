"use client"

import { useState } from "react"
import { Header } from "@/components/v0/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { WebhookSettings } from "@/components/analytics/WebhookSettings"

export default function WebhookSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  if (!session) {
    return null
  }

  return (
    <div className="min-h-screen bg-cakewalk-alice-100">
      <Header />

      <main className="container mx-auto max-w-7xl px-4 py-6">
        {/* Page Title and Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/analytics/webhooks")}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Analytics
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-cakewalk-text-primary">
              Webhook Settings
            </h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">
              Configure webhook subscriptions and sync historical events
            </p>
          </div>
        </div>

        {/* Settings Component */}
        <WebhookSettings />
      </main>
    </div>
  )
}