"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ConductorSettings, DEFAULT_CONDUCTOR, resolveConductor } from "@/lib/conductor";

type ProviderStatus = "unconfigured" | "testing" | "valid" | "invalid";

interface ProviderConfig {
  id: string;
  name: string;
  requiresKey: boolean;
  status: ProviderStatus;
  key: string;
  url: string;
  defaultUrl: string;
  modelCount: number;
  isCustom?: boolean;
}

// User-defined OpenAI-compatible providers (vLLM, LocalAI, text-gen-webui, ...)
interface CustomProviderDef {
  id: string;
  name: string;
  url: string;
}

// Standard vendor defaults, editable per-browser (stored in localStorage `agent-arena-urls`)
const DEFAULT_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
  openclaw: "http://localhost:18789",
  lmstudio: "http://localhost:1234/v1",
  ollama: "http://localhost:11434",
};

const INITIAL_PROVIDERS: ProviderConfig[] = [
  { id: "openrouter", name: "OpenRouter", requiresKey: true },
  { id: "anthropic", name: "Anthropic", requiresKey: true },
  { id: "openai", name: "OpenAI", requiresKey: true },
  { id: "xai", name: "X.AI (Grok)", requiresKey: true },
  { id: "openclaw", name: "OpenClaw", requiresKey: true },
  { id: "lmstudio", name: "LM Studio", requiresKey: false },
  { id: "ollama", name: "Ollama", requiresKey: false },
].map((p) => ({
  ...p,
  status: "unconfigured" as ProviderStatus,
  key: "",
  url: DEFAULT_URLS[p.id],
  defaultUrl: DEFAULT_URLS[p.id],
  modelCount: 0,
}));

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>(INITIAL_PROVIDERS);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [conductor, setConductor] = useState<ConductorSettings>(DEFAULT_CONDUCTOR);
  const { toast } = useToast();

  useEffect(() => {
    // Load saved keys + URL overrides + custom providers from localStorage
    const saved = localStorage.getItem("agent-arena-keys");
    const savedUrls = localStorage.getItem("agent-arena-urls");
    const savedCustom = localStorage.getItem("agent-arena-custom-providers");
    const keys = saved ? JSON.parse(saved) : {};
    const urls = savedUrls ? JSON.parse(savedUrls) : {};
    const customDefs: CustomProviderDef[] = savedCustom ? JSON.parse(savedCustom) : [];

    const customConfigs: ProviderConfig[] = customDefs.map((c) => ({
      id: c.id,
      name: c.name,
      requiresKey: false,
      status: (keys[c.id] ? "valid" : "unconfigured") as ProviderStatus,
      key: keys[c.id] || "",
      url: urls[c.id] || c.url,
      defaultUrl: c.url,
      modelCount: 0,
      isCustom: true,
    }));

    setProviders([
      ...INITIAL_PROVIDERS.map((p) => ({
        ...p,
        key: keys[p.id] || "",
        url: urls[p.id] || p.defaultUrl,
        status: (keys[p.id] ? "valid" : "unconfigured") as ProviderStatus,
      })),
      ...customConfigs,
    ]);

    // Load Prompt Lab (conductor) settings
    try {
      setConductor(resolveConductor(JSON.parse(localStorage.getItem("agent-arena-conductor") || "{}")));
    } catch {}

    // Check local providers with their saved URLs
    checkLocalProviders(urls);
  }, []);

  const saveConductor = () => {
    const resolved = resolveConductor(conductor);
    setConductor(resolved);
    localStorage.setItem("agent-arena-conductor", JSON.stringify(resolved));
    toast({ title: "Saved", description: "Prompt Lab settings apply to every new turn." });
  };

  const resetConductor = () => {
    setConductor(DEFAULT_CONDUCTOR);
    localStorage.removeItem("agent-arena-conductor");
    toast({ title: "Reset", description: "Prompt Lab restored to defaults." });
  };

  const checkLocalProviders = async (urls: Record<string, string>) => {
    for (const id of ["lmstudio", "ollama"]) {
      try {
        const res = await fetch(`/api/validate/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiUrl: urls[id] || DEFAULT_URLS[id] }),
        });
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
        body: JSON.stringify({ key: provider.key, apiUrl: provider.url }),
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
        // Save key + URL to localStorage so chat/judge/forge hit the same host we just validated
        const saved = JSON.parse(localStorage.getItem("agent-arena-keys") || "{}");
        saved[providerId] = provider.key;
        localStorage.setItem("agent-arena-keys", JSON.stringify(saved));

        const savedUrls = JSON.parse(localStorage.getItem("agent-arena-urls") || "{}");
        savedUrls[providerId] = provider.url;
        localStorage.setItem("agent-arena-urls", JSON.stringify(savedUrls));

        // Cache the model list — persona editor and Instant Matchups dropdowns read this
        if (Array.isArray(data.models)) {
          localStorage.setItem(`models-${providerId}`, JSON.stringify(data.models));
        }

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
        p.id === providerId ? { ...p, key, status: "unconfigured" as ProviderStatus } : p
      )
    );
  };

  const updateUrl = (providerId: string, url: string) => {
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, url, status: "unconfigured" as ProviderStatus } : p
      )
    );
  };

  const addCustomProvider = () => {
    const name = newName.trim();
    const url = newUrl.trim().replace(/\/+$/, "");
    if (!name || !url) return;

    const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
    if (!id.slice(7) || providers.some((p) => p.id === id)) {
      toast({ title: "Error", description: "A provider with that name already exists.", variant: "destructive" });
      return;
    }

    const defs: CustomProviderDef[] = JSON.parse(localStorage.getItem("agent-arena-custom-providers") || "[]");
    defs.push({ id, name, url });
    localStorage.setItem("agent-arena-custom-providers", JSON.stringify(defs));

    setProviders((prev) => [
      ...prev,
      {
        id,
        name,
        requiresKey: false,
        status: "unconfigured",
        key: "",
        url,
        defaultUrl: url,
        modelCount: 0,
        isCustom: true,
      },
    ]);
    setNewName("");
    setNewUrl("");
    toast({ title: "Added", description: `${name} added — hit Test & Fetch Models to connect.` });
  };

  const removeCustomProvider = (providerId: string) => {
    const defs: CustomProviderDef[] = JSON.parse(localStorage.getItem("agent-arena-custom-providers") || "[]");
    localStorage.setItem(
      "agent-arena-custom-providers",
      JSON.stringify(defs.filter((d) => d.id !== providerId))
    );

    // Clean up its key, URL override, and cached models
    const keys = JSON.parse(localStorage.getItem("agent-arena-keys") || "{}");
    delete keys[providerId];
    localStorage.setItem("agent-arena-keys", JSON.stringify(keys));
    const urls = JSON.parse(localStorage.getItem("agent-arena-urls") || "{}");
    delete urls[providerId];
    localStorage.setItem("agent-arena-urls", JSON.stringify(urls));
    localStorage.removeItem(`models-${providerId}`);

    setProviders((prev) => prev.filter((p) => p.id !== providerId));
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
                <div className="flex items-center gap-2">
                  {getStatusBadge(provider.status, provider.modelCount)}
                  {provider.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      title="Remove provider"
                      onClick={() => removeCustomProvider(provider.id)}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                {provider.isCustom
                  ? "Custom OpenAI-compatible"
                  : provider.requiresKey
                    ? "Requires API key"
                    : "Local provider"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(provider.requiresKey || provider.isCustom) && (
                <div className="flex gap-2">
                  <Input
                    type={showKeys[provider.id] ? "text" : "password"}
                    placeholder={provider.isCustom ? "API Key (optional)" : "API Key"}
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
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">API URL</span>
                  {provider.url !== provider.defaultUrl && (
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => updateUrl(provider.id, provider.defaultUrl)}
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <Input
                  className="font-mono text-xs"
                  placeholder={provider.defaultUrl}
                  value={provider.url}
                  onChange={(e) => updateUrl(provider.id, e.target.value)}
                />
              </div>
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

        {/* Add custom OpenAI-compatible provider */}
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">＋ Add Custom Provider</CardTitle>
            <CardDescription>
              Any OpenAI-compatible API — vLLM, LocalAI, text-gen-webui, llama.cpp, LiteLLM…
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Name (e.g., My vLLM Box)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              className="font-mono text-xs"
              placeholder="Base URL (e.g., http://192.168.0.50:8000/v1)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomProvider();
                }
              }}
            />
            <Button
              onClick={addCustomProvider}
              disabled={!newName.trim() || !newUrl.trim()}
              variant="outline"
              className="w-full"
            >
              Add Provider
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Prompt Lab: the orchestration prompts + context knobs */}
      <Card className="border-emerald-500/40">
        <CardHeader>
          <CardTitle>🎛️ Prompt Lab</CardTitle>
          <CardDescription>
            The hidden prompts that conduct every conversation — tune them to fight repetition,
            change pacing, or reshape the vibe entirely. Applies to all new turns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>History depth (messages each persona sees)</Label>
              <Input
                type="number"
                min={1}
                max={500}
                value={conductor.historyDepth}
                onChange={(e) =>
                  setConductor((c) => ({ ...c, historyDepth: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Low values cause amnesia and repetition. Keep it ≥ your message cap for full recall.
              </p>
            </div>
            <div>
              <Label>Message cap (debate turns before auto-stop)</Label>
              <Input
                type="number"
                min={2}
                max={500}
                value={conductor.messageCap}
                onChange={(e) =>
                  setConductor((c) => ({ ...c, messageCap: parseInt(e.target.value) || 0 }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Judge verdicts and human messages don&apos;t count against the cap.
              </p>
            </div>
          </div>

          <div>
            <Label>Opening prompt — first turn ({"{topic}"} is replaced)</Label>
            <Textarea
              rows={2}
              value={conductor.openingPrompt}
              onChange={(e) => setConductor((c) => ({ ...c, openingPrompt: e.target.value }))}
            />
          </div>

          <div>
            <Label>Turn prompt — every turn after the first</Label>
            <Textarea
              rows={3}
              value={conductor.turnPrompt}
              onChange={(e) => setConductor((c) => ({ ...c, turnPrompt: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              This is your main anti-repetition lever — demand novelty, reactions, escalation.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Frequency penalty (0–2)</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={conductor.frequencyPenalty}
                onChange={(e) =>
                  setConductor((c) => ({ ...c, frequencyPenalty: parseFloat(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Discourages repeating the same phrasing. Local AI-vs-AI chats loop without a little penalty pressure.
              </p>
            </div>
            <div>
              <Label>Presence penalty (0–2)</Label>
              <Input
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={conductor.presencePenalty}
                onChange={(e) =>
                  setConductor((c) => ({ ...c, presencePenalty: parseFloat(e.target.value) }))
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Encourages new topics. Ignored by providers without support (Anthropic, OpenClaw).
              </p>
            </div>
          </div>

          <div>
            <Label>Style rules — appended to every persona&apos;s system prompt</Label>
            <Textarea
              rows={2}
              value={conductor.styleSuffix}
              onChange={(e) => setConductor((c) => ({ ...c, styleSuffix: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave empty to let each persona&apos;s own system prompt stand alone.
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveConductor} className="flex-1">
              Save Prompt Lab
            </Button>
            <Button onClick={resetConductor} variant="outline">
              Reset to defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
