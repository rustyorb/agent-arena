"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Scale } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { MATCHUPS, Matchup, MatchupPersona } from "@/lib/matchups";

interface Persona {
  id: string;
  name: string;
  avatar: string | null;
  provider: string;
  model: string;
}

const MODES = [
  { id: "free", name: "Free Discussion", description: "Natural turn-taking conversation" },
  { id: "debate", name: "Structured Debate", description: "Alternating positions with timed turns" },
  { id: "interview", name: "Interview", description: "One persona asks, others answer" },
  { id: "round-robin", name: "Round Robin", description: "Strict rotation through all personas" },
];

const PROVIDERS = ["openrouter", "anthropic", "openai", "xai", "openclaw", "lmstudio", "ollama"];

export default function NewConversationPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    title: "",
    topic: "",
    mode: "free",
    selectedPersonas: [] as string[],
    judgeId: "none",
  });

  // Instant Matchups state
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; models: any[] }>>([]);
  const [matchupModel, setMatchupModel] = useState("");
  const [launchingMatchup, setLaunchingMatchup] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonas();
    loadModels();
  }, []);

  const fetchPersonas = async () => {
    try {
      const res = await fetch("/api/personas");
      const data = await res.json();
      setPersonas(data);
    } catch (err) {
      console.error("Failed to fetch personas:", err);
    } finally {
      setLoading(false);
    }
  };

  // Model lists cached by the settings page per provider
  const loadModels = () => {
    const all: Array<{ provider: string; models: any[] }> = [];
    const providerIds = [...PROVIDERS];

    // Include user-defined custom providers from /settings
    try {
      const customDefs = JSON.parse(localStorage.getItem("agent-arena-custom-providers") || "[]");
      providerIds.push(...customDefs.map((c: { id: string }) => c.id));
    } catch {}

    for (const provider of providerIds) {
      const stored = localStorage.getItem(`models-${provider}`);
      if (stored) {
        try {
          const models = JSON.parse(stored);
          if (Array.isArray(models) && models.length > 0) {
            all.push({ provider, models });
          }
        } catch {}
      }
    }
    setAvailableModels(all);
  };

  const togglePersona = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedPersonas: prev.selectedPersonas.includes(id)
        ? prev.selectedPersonas.filter((p) => p !== id)
        : [...prev.selectedPersonas, id],
      // A combatant can't also be the judge
      judgeId: prev.judgeId === id ? "none" : prev.judgeId,
    }));
  };

  // Launch a one-click matchup: create its personas + conversation, go
  const launchMatchup = async (matchup: Matchup) => {
    if (!matchupModel) {
      toast({
        title: "Pick a model",
        description: "Select which model powers the combatants first.",
        variant: "destructive",
      });
      return;
    }
    const [provider, ...modelParts] = matchupModel.split("::");
    const model = modelParts.join("::");

    setLaunchingMatchup(matchup.id);
    try {
      const createPersona = async (p: MatchupPersona) => {
        const res = await fetch("/api/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            avatar: p.avatar,
            systemPrompt: p.systemPrompt,
            position: p.position || null,
            temperature: p.temperature,
            maxTokens: 1024,
            provider,
            model,
          }),
        });
        if (!res.ok) throw new Error(`Failed to create persona ${p.name}`);
        return (await res.json()).id as string;
      };

      const combatantIds: string[] = [];
      for (const p of matchup.personas) {
        combatantIds.push(await createPersona(p));
      }
      const judgeId = matchup.judge ? await createPersona(matchup.judge) : null;

      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${matchup.emoji} ${matchup.title}`,
          topic: matchup.topic,
          mode: matchup.mode,
          personas: combatantIds,
          judgeId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      const data = await res.json();
      router.push(`/chat/${data.id}`);
    } catch (err) {
      console.error("Matchup launch failed:", err);
      toast({ title: "Error", description: (err as Error).message, variant: "destructive" });
      setLaunchingMatchup(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.selectedPersonas.length < 2) {
      toast({ title: "Error", description: "Select at least 2 personas", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title || `Discussion: ${form.topic.slice(0, 30)}...`,
          topic: form.topic,
          mode: form.mode,
          personas: form.selectedPersonas,
          judgeId: form.judgeId === "none" ? null : form.judgeId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/chat/${data.id}`);
      } else {
        throw new Error("Failed to create");
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const judgeCandidates = personas.filter((p) => !form.selectedPersonas.includes(p.id));

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Conversation</h1>
        <p className="text-muted-foreground">Set up a multi-agent discussion</p>
      </div>

      {/* Instant Matchups */}
      <Card className="border-amber-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Instant Matchups
          </CardTitle>
          <CardDescription>
            One click creates the personas and the arena. Zero to showdown in seconds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Power all combatants with</Label>
            {availableModels.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                No models cached yet — visit{" "}
                <a href="/settings" className="text-primary underline">
                  Settings
                </a>{" "}
                and test a provider first.
              </p>
            ) : (
              <Select value={matchupModel} onValueChange={setMatchupModel}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a model..." />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(({ provider, models }) =>
                    models.map((m: any) => (
                      <SelectItem key={`${provider}::${m.id}`} value={`${provider}::${m.id}`}>
                        {provider} / {m.name || m.id}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {MATCHUPS.map((matchup) => (
              <button
                key={matchup.id}
                type="button"
                onClick={() => launchMatchup(matchup)}
                disabled={launchingMatchup !== null}
                className="p-3 rounded-lg border border-border hover:border-amber-500/60 text-left transition-colors disabled:opacity-50"
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl">{matchup.emoji}</span>
                  <div>
                    <div className="font-medium text-sm">
                      {launchingMatchup === matchup.id ? "Launching..." : matchup.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{matchup.description}</div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">
                        {matchup.mode}
                      </Badge>
                      {matchup.judge && (
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/40">
                          <Scale className="h-2.5 w-2.5 mr-0.5" />
                          judged
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or build your own</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Topic</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Title (optional)</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., AI Ethics Debate"
              />
            </div>
            <div>
              <Label>Discussion Topic / Starting Prompt</Label>
              <Textarea
                value={form.topic}
                onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                placeholder="What should the personas discuss? Be specific..."
                rows={4}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={form.mode}
              onValueChange={(v) => setForm((p) => ({ ...p, mode: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    <div>
                      <div className="font-medium">{mode.name}</div>
                      <div className="text-xs text-muted-foreground">{mode.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Participants ({form.selectedPersonas.length} selected)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading personas...</p>
            ) : personas.length === 0 ? (
              <p className="text-muted-foreground">
                No personas available.{" "}
                <a href="/personas/new" className="text-primary underline">
                  Create one first
                </a>
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => togglePersona(persona.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      form.selectedPersonas.includes(persona.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{persona.avatar || "🤖"}</span>
                      <div>
                        <div className="font-medium">{persona.name}</div>
                        <Badge variant="secondary" className="text-xs">
                          {persona.model}
                        </Badge>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Judge */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-amber-500" />
              AI Judge (optional)
            </CardTitle>
            <CardDescription>
              A judge persona scores every round on logic, persuasion, and style — live scoreboard,
              final verdict, winner declared. Combatants can&apos;t judge their own fight.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={form.judgeId}
              onValueChange={(v) => setForm((p) => ({ ...p, judgeId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="No judge" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No judge</SelectItem>
                {judgeCandidates.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.avatar || "⚖️"} {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={creating || form.selectedPersonas.length < 2}
            className="flex-1"
          >
            {creating ? "Creating..." : "Start Conversation"}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/chat")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
