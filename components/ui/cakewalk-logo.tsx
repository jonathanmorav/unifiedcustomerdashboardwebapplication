import React from 'react'

interface CakewalkLogoProps {
  className?: string
}

export function CakewalkLogo({ className = "h-8 w-auto" }: CakewalkLogoProps) {
  return (
    <div className={className} style={{ height: 'inherit' }}>
      <svg 
        viewBox="0 0 1600 400" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ height: '100%', width: 'auto' }}
        aria-label="Cakewalk Benefits Logo"
      >
        {/* Blue gradient background for icon */}
        <defs>
          <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4A90E2" />
            <stop offset="100%" stopColor="#005DFE" />
          </linearGradient>
          <linearGradient id="cakeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#E8F0FE" />
          </linearGradient>
        </defs>
        
        {/* Icon background - rounded square */}
        <rect x="50" y="50" width="300" height="300" rx="60" fill="url(#iconGradient)" />
        
        {/* Cake layers */}
        <g transform="translate(200, 200)">
          {/* Bottom layer */}
          <ellipse cx="0" cy="40" rx="90" ry="25" fill="url(#cakeGradient)" opacity="0.9" />
          <rect x="-90" y="15" width="180" height="25" fill="url(#cakeGradient)" opacity="0.9" />
          
          {/* Middle layer */}
          <ellipse cx="0" cy="15" rx="75" ry="22" fill="url(#cakeGradient)" opacity="0.95" />
          <rect x="-75" y="-7" width="150" height="22" fill="url(#cakeGradient)" opacity="0.95" />
          
          {/* Top layer */}
          <ellipse cx="0" cy="-7" rx="60" ry="20" fill="url(#cakeGradient)" />
          <rect x="-60" y="-27" width="120" height="20" fill="url(#cakeGradient)" />
          
          {/* Cherry on top */}
          <circle cx="0" cy="-40" r="12" fill="#4AE290" opacity="0.9" />
          <path d="M 0,-40 Q 10,-50 5,-60" stroke="#4AE290" strokeWidth="3" fill="none" />
        </g>
        
        {/* CAKEWALK text */}
        <text 
          x="420" 
          y="240" 
          fontFamily="Arial, sans-serif" 
          fontSize="140" 
          fontWeight="900" 
          fill="#0A214A"
          letterSpacing="-2"
        >
          CAKEWALK
        </text>
        
        {/* Benefits text */}
        <text 
          x="1050" 
          y="320" 
          fontFamily="Arial, sans-serif" 
          fontSize="80" 
          fontWeight="400" 
          fill="#0A214A"
          letterSpacing="-1"
        >
          Benefits
        </text>
      </svg>
    </div>
  )
}