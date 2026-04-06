import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { DM_Serif_Display } from "next/font/google"
import "./globals.css"

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif",
})

export const metadata: Metadata = {
  title: "Open Fields",
  description: "Cannabis wholesale sales enablement",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${dmSerif.variable}`}>
      <body>{children}</body>
    </html>
  )
}
