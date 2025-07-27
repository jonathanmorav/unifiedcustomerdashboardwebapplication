"use client"

import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar"
import Image from "next/image"
import { Moon, Sun, LogOut, Settings, User, LayoutDashboard, Receipt, Activity } from "lucide-react"
import { useTheme } from "next-themes"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function Header() {
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const pathname = usePathname()
  const isDarkMode = theme === "dark"

  const handleLogout = () => {
    signOut({ callbackUrl: "/auth/signin", redirect: true })
  }

  return (
    <header className="border-b border-cakewalk-border bg-background shadow-cakewalk-light transition-colors duration-300">
      <div className="container mx-auto max-w-7xl px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/images/cakewalk-logo.png"
              alt="Cakewalk Benefits"
              width={200}
              height={50}
              className="h-12 w-auto"
              priority
            />
            <div>
              <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                Customer Support Dashboard
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-2">
            <Link href="/dashboard">
              <Button
                variant={pathname === "/dashboard" ? "default" : "ghost"}
                size="sm"
                className="flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
            <Link href="/billing">
              <Button
                variant={pathname === "/billing" ? "default" : "ghost"}
                size="sm"
                className="flex items-center gap-2"
              >
                <Receipt className="h-4 w-4" />
                Billing
              </Button>
            </Link>

          </nav>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(isDarkMode ? "light" : "dark")}
              className="text-cakewalk-text-secondary hover:text-cakewalk-text-primary"
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session?.user?.image || undefined} alt="User" />
                    <AvatarFallback className="bg-cakewalk-primary text-white">
                      {session?.user?.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="text-cakewalk-body-xs font-medium">
                      {session?.user?.name || "User"}
                    </p>
                    <p className="text-cakewalk-body-xxs text-cakewalk-text-secondary">
                      {session?.user?.email || ""}
                    </p>
                  </div>
                </div>
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
