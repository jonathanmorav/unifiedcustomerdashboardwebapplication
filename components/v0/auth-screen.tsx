"use client"

import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import Image from "next/image"
import { Chrome } from "lucide-react"

export function AuthScreen() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  const handleAuthenticate = () => {
    signIn("google", { callbackUrl })
  }

  return (
    <div className="min-h-screen bg-cakewalk-alice-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image 
              src="/images/cakewalk-logo.png" 
              alt="Cakewalk Benefits" 
              width={320} 
              height={80}
              className="h-16 w-auto"
              priority
            />
          </div>
          <h2 className="text-cakewalk-h3 text-cakewalk-text-primary mb-2">Customer Support Dashboard</h2>
          <p className="text-cakewalk-body-xs text-cakewalk-text-secondary">
            Unified view of HubSpot and Dwolla customer data
          </p>
        </div>

        <Card className="shadow-cakewalk-medium border-cakewalk-border">
          <CardHeader className="text-center">
            <CardTitle className="text-cakewalk-h4 text-cakewalk-text-primary">Sign In</CardTitle>
            <CardDescription className="text-cakewalk-body-xs text-cakewalk-text-secondary">
              Use your Google account to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-3 bg-cakewalk-error/10 border border-cakewalk-error/20 rounded-xl">
                <p className="text-cakewalk-body-xxs text-cakewalk-error font-medium text-center">
                  {error === "AccessDenied"
                    ? "Your email is not authorized to access this application."
                    : "An error occurred during sign in. Please try again."}
                </p>
              </div>
            )}

            <Button
              onClick={handleAuthenticate}
              className="w-full bg-cakewalk-primary hover:bg-cakewalk-primary-royal text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 hover:shadow-cakewalk-hover"
            >
              <Chrome className="w-5 h-5 mr-2" />
              Continue with Google
            </Button>

            <div className="mt-6 p-4 bg-cakewalk-alice-200 rounded-xl">
              <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary text-center">
                <strong>Invite-only access.</strong> Contact your administrator if you need access to this dashboard.
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