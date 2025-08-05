"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SliderProps {
  value?: number[]
  onValueChange?: (value: number[]) => void
  max?: number
  min?: number
  step?: number
  className?: string
  disabled?: boolean
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value = [0], onValueChange, max = 100, min = 0, step = 1, disabled, ...props }, ref) => {
    // Support both single value and range (two values)
    const isRange = value.length === 2
    const val1 = value[0] || min
    const val2 = isRange ? (value[1] || max) : val1
    
    const percentage = ((val1 - min) / (max - min)) * 100
    const percentage2 = isRange ? ((val2 - min) / (max - min)) * 100 : percentage

    const handleChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = Number(e.target.value)
      if (isRange) {
        const newValues = [...value]
        newValues[index] = newValue
        onValueChange?.(newValues)
      } else {
        onValueChange?.([newValue])
      }
    }

    return (
      <div
        ref={ref}
        className={cn("relative flex w-full touch-none select-none items-center", className)}
        {...props}
      >
        {isRange ? (
          // Range slider with two inputs
          <div className="relative w-full">
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={val1}
              onChange={handleChange(0)}
              disabled={disabled}
              className="absolute w-full h-2 bg-transparent rounded-full appearance-none cursor-pointer z-20
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-primary
                [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-primary
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-primary
                [&::-moz-range-thumb]:border-2
                [&::-moz-range-thumb]:border-primary
                [&::-moz-range-thumb]:cursor-pointer
                disabled:opacity-50
                disabled:cursor-not-allowed"
            />
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={val2}
              onChange={handleChange(1)}
              disabled={disabled}
              className="absolute w-full h-2 bg-transparent rounded-full appearance-none cursor-pointer z-10
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-primary
                [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-primary
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5
                [&::-moz-range-thumb]:h-5
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-primary
                [&::-moz-range-thumb]:border-2
                [&::-moz-range-thumb]:border-primary
                [&::-moz-range-thumb]:cursor-pointer
                disabled:opacity-50
                disabled:cursor-not-allowed"
            />
            <div className="relative w-full h-2 bg-gray-200 rounded-full">
              <div 
                className="absolute h-full bg-primary rounded-full"
                style={{
                  left: `${percentage}%`,
                  right: `${100 - percentage2}%`
                }}
              />
            </div>
          </div>
        ) : (
          // Single value slider
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={val1}
            onChange={handleChange(0)}
            disabled={disabled}
            role="slider"
            className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-5
              [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-primary
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-5
              [&::-moz-range-thumb]:h-5
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-primary
              [&::-moz-range-thumb]:border-2
              [&::-moz-range-thumb]:border-primary
              [&::-moz-range-thumb]:cursor-pointer
              disabled:opacity-50
              disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${percentage}%, rgb(229 231 235) ${percentage}%, rgb(229 231 235) 100%)`
            }}
          />
        )}
      </div>
    )
  }
)
Slider.displayName = "Slider"

export { Slider }