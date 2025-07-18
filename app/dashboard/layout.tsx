import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ReactNode } from "react"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/auth/signin")
  }

  return (
    <div className="bg-cakewalk-bg-alice-100 min-h-screen">
      <header className="border-cakewalk-bg-lavender shadow-cakewalk-light border-b bg-white">
        <div className="px-cakewalk-24 py-cakewalk-16 container mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-cakewalk-h3 text-cakewalk-primary-dark">
              Unified Customer Dashboard
            </h1>
            <div className="gap-cakewalk-16 flex items-center">
              <span className="text-cakewalk-body-sm text-cakewalk-text-secondary">
                {session.user.email}
              </span>
              <Link
                href="/api/auth/signout"
                className="text-cakewalk-body-sm text-cakewalk-primary hover:text-cakewalk-primary-royal transition-colors"
              >
                Sign Out
              </Link>
            </div>
          </div>
        </div>
      </header>
      <main className="px-cakewalk-24 py-cakewalk-32 container mx-auto">{children}</main>
    </div>
  )
}
