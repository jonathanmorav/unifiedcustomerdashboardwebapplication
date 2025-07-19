import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ReactNode } from "react"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { SkipLink } from "@/components/ui/skip-link"
import { CakewalkLogo } from "@/components/ui/cakewalk-logo"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <div className="bg-cakewalk-bg-alice-100 min-h-screen">
      <SkipLink href="#main-content">Skip to main content</SkipLink>
      <header
        className="border-cakewalk-border shadow-cakewalk-light border-b bg-white"
        role="banner"
      >
        <div className="container mx-auto px-cakewalk-16 py-cakewalk-12 md:px-cakewalk-24 md:py-cakewalk-16">
          <div className="flex items-center justify-between">
            <CakewalkLogo className="h-8 md:h-10 w-auto" />
            <div className="flex items-center gap-cakewalk-12 md:gap-cakewalk-16">
              <ThemeToggle />
              <span className="hidden md:inline text-cakewalk-body-sm text-cakewalk-text-secondary">
                {session.user.email}
              </span>
              <Link
                href="/api/auth/signout"
                className="text-cakewalk-body-sm text-cakewalk-primary hover:text-cakewalk-primary-royal font-cakewalk-medium transition-colors"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main
        id="main-content"
        role="main"
      >
        {children}
      </main>
    </div>
  )
}
