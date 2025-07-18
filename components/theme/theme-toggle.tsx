"use client"

import * as React from "react"
import { Moon, Sun, Laptop } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTheme, useLocalStorageAvailable } from "@/hooks/use-theme"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const

interface ThemeToggleProps {
  className?: string
  showLabel?: boolean
  variant?: "dropdown" | "buttons"
}

export function ThemeToggle({
  className,
  showLabel = false,
  variant = "dropdown",
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme, isLoading } = useTheme()
  const isStorageAvailable = useLocalStorageAvailable()
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    if (!isStorageAvailable && !isLoading) {
      toast.info("Theme preferences unavailable in private browsing mode", {
        description: "Using system preference",
        duration: 5000,
      })
    }
  }, [isStorageAvailable, isLoading])

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as "light" | "dark" | "system")

    // Announce change to screen readers
    const announcement = `Theme changed to ${newTheme === "system" ? "system preference" : newTheme}`
    const ariaLive = document.createElement("div")
    ariaLive.setAttribute("role", "status")
    ariaLive.setAttribute("aria-live", "polite")
    ariaLive.className = "sr-only"
    ariaLive.textContent = announcement
    document.body.appendChild(ariaLive)
    setTimeout(() => document.body.removeChild(ariaLive), 1000)
  }

  // Keyboard shortcut handler
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "t") {
        e.preventDefault()
        setIsOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [])

  const currentIcon = React.useMemo(() => {
    const currentTheme = themes.find((t) => t.value === theme) || themes[2]
    return currentTheme.icon
  }, [theme])

  if (variant === "buttons") {
    return (
      <div
        className={cn("flex items-center gap-1", className)}
        role="radiogroup"
        aria-label="Choose theme"
      >
        {themes.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={theme === value ? "default" : "ghost"}
            size="icon"
            onClick={() => handleThemeChange(value)}
            aria-label={`Set ${label} theme`}
            aria-pressed={theme === value}
            className={cn(
              "h-9 w-9",
              theme === value && "ring-cakewalk-primary ring-2 ring-offset-2"
            )}
          >
            <Icon className="h-4 w-4" />
          </Button>
        ))}
      </div>
    )
  }

  const CurrentIcon = currentIcon

  return (
    <Select value={theme} onValueChange={handleThemeChange} open={isOpen} onOpenChange={setIsOpen}>
      <SelectTrigger
        className={cn(
          "h-9 w-auto gap-2",
          "focus:ring-cakewalk-primary focus:ring-2 focus:ring-offset-2",
          className
        )}
        aria-label="Select theme"
        aria-describedby="theme-description"
      >
        <CurrentIcon className="h-4 w-4" />
        {showLabel && <SelectValue placeholder="Select theme" />}
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel id="theme-description">Choose your preferred theme</SelectLabel>
          {themes.map(({ value, label, icon: Icon }) => (
            <SelectItem
              key={value}
              value={value}
              className={cn("cursor-pointer", theme === value && "font-semibold")}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                {value === "system" && (
                  <span className="text-muted-foreground ml-2 text-xs">({resolvedTheme})</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectGroup>
        <div className="text-muted-foreground border-t px-2 py-1.5 text-xs">
          <kbd className="bg-muted rounded px-1 py-0.5 text-xs">Alt+T</kbd> to toggle
        </div>
      </SelectContent>
    </Select>
  )
}

/**
 * Simple theme toggle button (icon only)
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()

  const toggleTheme = () => {
    const themeOrder = ["light", "dark", "system"] as const
    const currentIndex = themeOrder.indexOf(theme as any) || 0
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }

  const Icon = React.useMemo(() => {
    if (theme === "system") return Laptop
    if (resolvedTheme === "dark") return Moon
    return Sun
  }, [theme, resolvedTheme])

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "h-9 w-9",
        "focus:ring-cakewalk-primary focus:ring-2 focus:ring-offset-2",
        className
      )}
      aria-label={`Current theme: ${theme}. Click to change theme`}
    >
      <Icon className="h-4 w-4 transition-all" />
    </Button>
  )
}
