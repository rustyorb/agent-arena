import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Agent Arena - Multi-Agent AI Conversations",
  description: "Orchestrate autonomous multi-agent AI conversations and debates",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b">
            <div className="container mx-auto px-4 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-2">
                <span className="text-2xl">🎭</span>
                <h1 className="text-xl font-bold">Agent Arena</h1>
              </Link>
              <nav className="flex items-center space-x-4">
                <Link href="/personas">
                  <Button variant="ghost">Personas</Button>
                </Link>
                <Link href="/chat">
                  <Button variant="ghost">Conversations</Button>
                </Link>
                <Link href="/settings">
                  <Button variant="ghost">Settings</Button>
                </Link>
                <Link href="/chat/new">
                  <Button>New Chat</Button>
                </Link>
              </nav>
            </div>
          </header>

          {/* Main content */}
          <main className="flex-1">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t py-4">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              Agent Arena - Multi-Agent AI Conversation Orchestrator
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
