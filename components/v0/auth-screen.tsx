"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import Image from "next/image"
import { Chrome, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function AuthScreen() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const { theme, setTheme } = useTheme()
  const isDarkMode = theme === "dark"

  const handleAuthenticate = () => {
    signIn("google", { callbackUrl })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cakewalk-alice-100 dark:bg-gray-900 p-4 transition-colors duration-300">
      {/* Theme Toggle in top right */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDarkMode ? "light" : "dark")}
          className="text-cakewalk-text-secondary hover:text-cakewalk-text-primary"
        >
          {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>
      <div className="animate-scale-in w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center">
            <Image
              src="/images/cakewalk-logo.png"
              alt="Cakewalk Benefits"
              width={320}
              height={80}
              className="h-16 w-auto"
              priority
            />
          </div>
          <h2 className="mb-2 text-cakewalk-h3 text-cakewalk-text-primary">
            Customer Support Dashboard
          </h2>
          <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            Unified view of HubSpot and Dwolla customer data
          </p>
        </div>

        <Card className="border-cakewalk-border shadow-cakewalk-medium">
          <CardHeader className="text-center">
            <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">Sign In</CardTitle>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Use your Google account to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-xl border border-cakewalk-error/20 bg-cakewalk-error/10 p-3">
                <p className="text-center text-cakewalk-body-xxs font-medium text-cakewalk-error">
                  {error === "AccessDenied"
                    ? "Your email is not authorized to access this application."
                    : "An error occurred during sign in. Please try again."}
                </p>
              </div>
            )}

            <Button
              onClick={handleAuthenticate}
              className="w-full rounded-xl bg-cakewalk-primary px-4 py-3 font-semibold text-white transition-all duration-200 hover:bg-cakewalk-primary-royal hover:shadow-cakewalk-hover"
            >
              <Chrome className="mr-2 h-5 w-5" />
              Continue with Google
            </Button>

            <div className="mt-6 rounded-xl bg-cakewalk-alice-200 dark:bg-gray-700 p-4">
              <p className="text-center text-cakewalk-body-xxs text-cakewalk-text-secondary">
                <strong>Invite-only access.</strong> Contact your administrator if you need access
                to this dashboard.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <p className="text-cakewalk-body-xxs text-cakewalk-text-tertiary">
            Enterprise-grade security • No data stored locally
          </p>
        </div>
      </div>
    </div>
  )
}
