import type { ReactNode } from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "SeemaIQ – AI Interview Simulator",
  description: "Master your interview skills with AI-powered practice sessions. Practice coding interviews, system design, HR rounds, and behavioral questions with AI-powered feedback.",
  metadataBase: new URL("https://seemaiq.com"),
  icons: {
    icon: "/logo_icon.png",
    apple: "/logo_icon.png",
  },
  keywords: [
    "AI interview practice",
    "coding interview simulator",
    "interview preparation",
    "mock interviews",
    "interview coaching",
    "career development",
    "job interview prep",
  ],
  authors: [{ name: "Moksh Bhardwaj" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://seemaiq.com",
    siteName: "SeemaIQ",
    title: "SeemaIQ – AI Interview Simulator",
    description:
      "Master your interview skills with AI-powered practice sessions. Practice coding interviews, system design, HR rounds, and behavioral questions with AI-powered feedback.",
    images: [
      {
        url: "/logo_icon.png",
        width: 1200,
        height: 630,
        alt: "SeemaIQ AI Interview Simulator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SeemaIQ – AI Interview Simulator",
    description:
      "Master your interview skills with AI-powered practice sessions.",
    images: ["/logo_icon.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "VfUl1tBglIOLkUBtUbpThY0LOYK37wtaf9dtuaV2lWQ",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geist.variable} ${geistMono.variable}`}
    >
      <body className="font-sans antialiased min-h-screen liquid-bg text-foreground">
        <main className="min-h-screen">{children}</main>
        <Analytics />
      </body>
    </html>
  )
}
