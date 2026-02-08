"use client";

import Link from "next/link";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/theme-context";

export function NavBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold flex items-center gap-2">
          🎭 Agent Arena
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/personas" className="text-sm hover:text-primary">Personas</Link>
          <Link href="/chat" className="text-sm hover:text-primary">Chats</Link>
          <Link href="/settings" className="text-sm hover:text-primary">Settings</Link>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}
