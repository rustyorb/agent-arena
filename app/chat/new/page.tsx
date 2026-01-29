"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  });

  useEffect(() => {
    fetchPersonas();
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

  const togglePersona = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedPersonas: prev.selectedPersonas.includes(id)
        ? prev.selectedPersonas.filter((p) => p !== id)
        : [...prev.selectedPersonas, id],
    }));
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Conversation</h1>
        <p className="text-muted-foreground">Set up a multi-agent discussion</p>
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
