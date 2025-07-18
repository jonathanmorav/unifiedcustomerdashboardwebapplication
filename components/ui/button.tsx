import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "rounded-cakewalk-small text-cakewalk-body-xs font-cakewalk-semibold focus-visible:ring-cakewalk-primary dark:ring-offset-cakewalk-primary-dark dark:focus-visible:ring-cakewalk-primary-light inline-flex items-center justify-center gap-2 whitespace-nowrap ring-offset-white transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-cakewalk-primary hover:bg-cakewalk-primary-royal shadow-cakewalk-medium text-white hover:scale-[1.02]",
        destructive:
          "bg-cakewalk-error hover:bg-cakewalk-error/90 shadow-cakewalk-medium text-white",
        outline:
          "border-cakewalk-bg-lavender hover:bg-cakewalk-bg-alice-200 hover:text-cakewalk-primary dark:border-cakewalk-bg-lavender dark:bg-cakewalk-bg-white dark:hover:bg-cakewalk-bg-alice-300 border bg-white",
        secondary:
          "bg-cakewalk-bg-alice-200 text-cakewalk-primary hover:bg-cakewalk-bg-alice-300 dark:bg-cakewalk-bg-alice-300 dark:text-cakewalk-primary-light dark:hover:bg-cakewalk-bg-lavender",
        ghost:
          "hover:bg-cakewalk-bg-alice-200 hover:text-cakewalk-primary dark:hover:bg-cakewalk-bg-alice-300 dark:hover:text-cakewalk-primary-light",
        link: "text-cakewalk-primary dark:text-cakewalk-primary-light underline-offset-4 hover:underline",
      },
      size: {
        default: "px-cakewalk-16 py-cakewalk-8 h-11",
        sm: "rounded-cakewalk-small px-cakewalk-12 h-9",
        lg: "rounded-cakewalk-medium px-cakewalk-24 h-12",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
