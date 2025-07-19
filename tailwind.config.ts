import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cakewalk: {
          // Primary colors
          primary: '#005dfe',         // Medium Slate Blue
          'primary-light': '#5791f3', // Cornflower Blue
          'primary-dark': '#0a214a',  // Dark Slate Blue
          'primary-royal': '#0051dc', // Royal Blue
          
          // Secondary colors
          'success': '#15cb94',       // Medium Sea Green
          'success-light': '#53edbe', // Aquamarine
          'success-dark': '#045d42',  // Sea Green
          'warning': '#f59e0b',
          'error': '#ef4444',
          
          // Background colors
          bg: {
            'alice-100': '#f4f8ff',   // Main page background
            'alice-200': '#eaf2ff',   // Card backgrounds
            'alice-300': '#eef1f8',   // Subtle backgrounds
          },
          
          // Border colors
          border: '#cbdeff',          // Lavender
          
          // Text colors
          text: {
            primary: '#424b5b',       // Dark Slate Gray
            secondary: '#5d6b85',     // Slate Gray
            tertiary: '#5d6885',      // Slate Gray 200
          }
        }
      },
      fontFamily: {
        'dm-sans': ['DM Sans', 'sans-serif'],
        'space-grotesk': ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        // Cakewalk typography scale
        'cakewalk-h1': ['36px', { lineHeight: '1.2' }],
        'cakewalk-h2': ['24px', { lineHeight: '1.3' }],
        'cakewalk-h3': ['20px', { lineHeight: '1.3' }],
        'cakewalk-h4': ['18px', { lineHeight: '1.4' }],
        'cakewalk-h5': ['16px', { lineHeight: '1.4' }],
        'cakewalk-body-lg': ['20px', { lineHeight: '1.5' }],
        'cakewalk-body': ['18px', { lineHeight: '1.5' }],
        'cakewalk-body-sm': ['16px', { lineHeight: '1.5' }],
        'cakewalk-body-xs': ['14px', { lineHeight: '1.4' }],
        'cakewalk-body-xxs': ['13px', { lineHeight: '1.4' }],
      },
      fontWeight: {
        'cakewalk-normal': '400',
        'cakewalk-medium': '500',
        'cakewalk-semibold': '600',
        'cakewalk-bold': '700',
      },
      spacing: {
        // Cakewalk spacing system
        'cakewalk-2': '2px',
        'cakewalk-4': '4px',
        'cakewalk-8': '8px',
        'cakewalk-12': '12px',
        'cakewalk-16': '16px',
        'cakewalk-20': '20px',
        'cakewalk-24': '24px',
        'cakewalk-32': '32px',
        'cakewalk-40': '40px',
      },
      borderRadius: {
        'cakewalk-small': '8px',
        'cakewalk-medium': '12px',
        'cakewalk-large': '16px',
        'cakewalk-xlarge': '20px',
      },
      boxShadow: {
        'cakewalk-light': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'cakewalk-medium': '0px 6px 8px rgba(0,0,0,0.05)',
        'cakewalk-special': '0px 3px 3px rgba(0,0,0,0.05)',
        'cakewalk-hover': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}

export default config