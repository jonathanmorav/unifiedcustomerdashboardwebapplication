import type { Metadata } from "next"
import { DM_Sans, Space_Grotesk } from "next/font/google"
import { SessionProvider } from "@/components/providers/session-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ErrorProvider } from "@/components/providers/error-provider"
import { ThemeScript } from "@/lib/theme/theme-script"
import "./globals.css"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
})

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["600", "700"],
})

export const metadata: Metadata = {
  title: "Cakewalk Benefits - Customer Dashboard",
  description: "Enterprise-grade customer data management platform by Cakewalk Benefits",
  keywords: "cakewalk benefits, customer dashboard, HubSpot, Dwolla, support tools",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <ThemeScript />
      </head>
      <body
        className={`${dmSans.variable} ${spaceGrotesk.variable} bg-cakewalk-bg-alice-100 font-dm-sans text-cakewalk-text-primary antialiased`}
      >
        <ErrorProvider>
          <ThemeProvider>
            <SessionProvider>{children}</SessionProvider>
          </ThemeProvider>
        </ErrorProvider>
      </body>
    </html>
  )
}
