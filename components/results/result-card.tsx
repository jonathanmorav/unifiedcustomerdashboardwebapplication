"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDownIcon, ChevronUpIcon, CopyIcon, CheckIcon } from "lucide-react"
import { toast } from "sonner"

interface ResultCardProps {
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  actions?: React.ReactNode
  className?: string
}

export function ResultCard({
  title,
  children,
  defaultExpanded = true,
  actions,
  className,
}: ResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <Card className={className}>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {title}
            {isExpanded ? (
              <ChevronUpIcon className="text-cakewalk-text-secondary h-5 w-5" />
            ) : (
              <ChevronDownIcon className="text-cakewalk-text-secondary h-5 w-5" />
            )}
          </CardTitle>
          {actions && (
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {actions}
            </div>
          )}
        </div>
      </CardHeader>
      {isExpanded && <CardContent>{children}</CardContent>}
    </Card>
  )
}

interface CopyButtonProps {
  value: string
  label?: string
  size?: "default" | "sm" | "lg" | "icon"
}

export function CopyButton({ value, label = "Copy", size = "sm" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Failed to copy")
    }
  }

  return (
    <Button variant="outline" size={size} onClick={handleCopy}>
      {copied ? (
        <>
          <CheckIcon className="mr-1 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <CopyIcon className="mr-1 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  )
}
