"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

type ProviderStatus = "unconfigured" | "testing" | "valid" | "invalid";

interface ProviderConfig {
  id: string;
  name: string;
  requiresKey: boolean;
  status: ProviderStatus;
  key: string;
  modelCount: number;
}

const INITIAL_PROVIDERS: ProviderConfig[] = [
  { id: "openrouter", name: "OpenRouter", requiresKey: true, status: "unconfigured", key: "", modelCount: 0 },
  { id: "anthropic", name: "Anthropic", requiresKey: true, status: "unconfigured", key: "", modelCount: 0 },
  { id: "openai", name: "OpenAI", requiresKey: true, status: "unconfigured", key: "", modelCount: 0 },
  { id: "xai", name: "X.AI (Grok)", requiresKey: true, status: "unconfigured", key: "", modelCount: 0 },
  { id: "lmstudio", name: "LM Studio", requiresKey: false, status: "unconfigured", key: "", modelCount: 0 },
  { id: "ollama", name: "Ollama", requiresKey: false, status: "unconfigured", key: "", modelCount: 0 },
];

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>(INITIAL_PROVIDERS);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    // Load saved keys from localStorage
    const saved = localStorage.getItem("agent-arena-keys");
    if (saved) {
      const keys = JSON.parse(saved);
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          key: keys[p.id] || "",
          status: keys[p.id] ? "valid" : "unconfigured",
        }))
      );
    }
    
    // Check local providers
    checkLocalProviders();
  }, []);

  const checkLocalProviders = async () => {
    for (const id of ["lmstudio", "ollama"]) {
      try {
        const res = await fetch(`/api/validate/${id}`, { method: "POST" });
        const data = await res.json();
        setProviders((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, status: data.valid ? "valid" : "invalid", modelCount: data.modelCount || 0 }
              : p
          )
        );
      } catch {
        setProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: "invalid" } : p))
        );
      }
    }
  };

  const testProvider = async (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return;

    setProviders((prev) =>
      prev.map((p) => (p.id === providerId ? { ...p, status: "testing" } : p))
    );

    try {
      const res = await fetch(`/api/validate/${providerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: provider.key }),
      });
      const data = await res.json();

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, status: data.valid ? "valid" : "invalid", modelCount: data.modelCount || 0 }
            : p
        )
      );

      if (data.valid) {
        // Save to localStorage
        const saved = JSON.parse(localStorage.getItem("agent-arena-keys") || "{}");
        saved[providerId] = provider.key;
        localStorage.setItem("agent-arena-keys", JSON.stringify(saved));
        
        toast({ title: "Success", description: `${provider.name} connected! Found ${data.modelCount} models.` });
      } else {
        toast({ title: "Error", description: `Failed to connect to ${provider.name}`, variant: "destructive" });
      }
    } catch (err) {
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, status: "invalid" } : p))
      );
      toast({ title: "Error", description: `Connection failed`, variant: "destructive" });
    }
  };

  const updateKey = (providerId: string, key: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, key, status: key ? "unconfigured" : "unconfigured" } : p
      )
    );
  };

  const getStatusBadge = (status: ProviderStatus, modelCount: number) => {
    switch (status) {
      case "valid":
        return <Badge className="bg-green-500">{modelCount} models</Badge>;
      case "invalid":
        return <Badge variant="destructive">Invalid</Badge>;
      case "testing":
        return <Badge variant="secondary">Testing...</Badge>;
      default:
        return <Badge variant="outline">Not configured</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your AI providers</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                {getStatusBadge(provider.status, provider.modelCount)}
              </div>
              <CardDescription>
                {provider.requiresKey ? "Requires API key" : "Local provider"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {provider.requiresKey && (
                <div className="flex gap-2">
                  <Input
                    type={showKeys[provider.id] ? "text" : "password"}
                    placeholder="API Key"
                    value={provider.key}
                    onChange={(e) => updateKey(provider.id, e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShowKeys((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                    }
                  >
                    {showKeys[provider.id] ? "Hide" : "Show"}
                  </Button>
                </div>
              )}
              <Button
                onClick={() => testProvider(provider.id)}
                disabled={provider.status === "testing" || (provider.requiresKey && !provider.key)}
                className="w-full"
              >
                {provider.status === "testing" ? "Testing..." : "Test & Fetch Models"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
