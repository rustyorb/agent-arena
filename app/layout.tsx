import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agent Arena",
  description: "Multi-agent AI conversation orchestrator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          <nav className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="text-xl font-bold flex items-center gap-2">
                🎭 Agent Arena
              </a>
              <div className="flex items-center gap-4">
                <a href="/personas" className="text-sm hover:text-primary">Personas</a>
                <a href="/chat" className="text-sm hover:text-primary">Chats</a>
                <a href="/settings" className="text-sm hover:text-primary">Settings</a>
              </div>
            </div>
          </nav>
          <main className="container mx-auto px-4 py-6">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
