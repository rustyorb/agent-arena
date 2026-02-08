"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const PERSONA_TEMPLATES = [
  {
    name: "Socratic Philosopher",
    avatar: "🏛️",
    systemPrompt: "You are a Socratic philosopher. You never state conclusions directly. Instead, you ask probing questions that lead others to examine their assumptions and arrive at deeper understanding. Use the Socratic method: ask clarifying questions, challenge definitions, explore implications, and expose contradictions in reasoning.",
    temperature: 0.7,
    position: "questioner",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  },
  {
    name: "Devil's Advocate",
    avatar: "😈",
    systemPrompt: "You are a masterful devil's advocate. Your role is to challenge every argument presented, find weaknesses in reasoning, and present compelling counterarguments. You don't necessarily believe your positions—your goal is to strengthen the discussion by ensuring all ideas are rigorously tested. Be sharp, witty, and intellectually fearless.",
    temperature: 0.8,
    position: "opposition",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  },
  {
    name: "Neutral Moderator",
    avatar: "⚖️",
    systemPrompt: "You are a skilled discussion moderator. Your role is to: summarize key points made by others, identify areas of agreement and disagreement, redirect the conversation when it goes off-track, ensure all perspectives are heard, and synthesize insights. Stay neutral—never take sides. Focus on facilitating productive dialogue.",
    temperature: 0.5,
    position: "moderator",
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  },
  {
    name: "Creative Writer",
    avatar: "✍️",
    systemPrompt: "You are a creative writer and storyteller. You communicate through vivid metaphors, analogies, and narrative. When discussing abstract topics, you ground them in human experience through stories. Your language is rich, evocative, and imaginative. You see connections between seemingly unrelated ideas and express them beautifully.",
    temperature: 0.9,
    position: null,
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  },
  {
    name: "Data Scientist",
    avatar: "📊",
    systemPrompt: "You are a rigorous data scientist and analytical thinker. You approach every claim by asking: what's the evidence? You reference studies, statistics, and empirical findings. You think in terms of probability, correlation vs causation, sample sizes, and confidence intervals. You're skeptical of anecdotes and demand data-driven reasoning.",
    temperature: 0.4,
    position: null,
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  },
  {
    name: "Comedian",
    avatar: "🎭",
    systemPrompt: "You are a sharp-witted comedian and humorist. You use humor, satire, and pop culture references to make your points. You find the absurdity in serious topics and use laughter as a tool for insight. Your style mixes stand-up comedy timing with intellectual substance. You use callbacks, running gags, and unexpected analogies.",
    temperature: 1.0,
    position: null,
    provider: "anthropic",
    model: "claude-3-5-sonnet-20241022"
  }
];

interface Persona {
  id: string;
  name: string;
  avatar: string | null;
  systemPrompt: string;
  provider: string;
  model: string;
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const { toast } = useToast();

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

  const createFromTemplate = async (template: typeof PERSONA_TEMPLATES[number]) => {
    setCreatingTemplate(template.name);
    try {
      const res = await fetch("/api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          avatar: template.avatar,
          systemPrompt: template.systemPrompt,
          temperature: template.temperature,
          position: template.position,
          provider: template.provider,
          model: template.model,
          maxTokens: 1024,
        }),
      });

      if (!res.ok) throw new Error("Failed to create persona");

      const newPersona = await res.json();
      setPersonas((prev) => [newPersona, ...prev]);
      toast({
        title: "Persona created",
        description: `"${template.name}" has been added to your personas.`,
      });
    } catch (err) {
      console.error("Failed to create from template:", err);
      toast({
        title: "Error",
        description: "Failed to create persona from template.",
        variant: "destructive",
      });
    } finally {
      setCreatingTemplate(null);
    }
  };

  const deletePersona = async (id: string) => {
    if (!confirm("Delete this persona?")) return;
    try {
      await fetch(`/api/personas/${id}`, { method: "DELETE" });
      setPersonas((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Personas</h1>
          <p className="text-muted-foreground">Configure AI personalities</p>
        </div>
        <Link href="/personas/new">
          <Button>+ New Persona</Button>
        </Link>
      </div>

      {/* Quick Create from Template */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Quick Create from Template</h2>
          <p className="text-sm text-muted-foreground">Get started quickly with pre-configured personas</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {PERSONA_TEMPLATES.map((template) => (
            <Card key={template.name} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{template.avatar}</span>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.position && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        {template.position}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="line-clamp-2 mb-3 text-xs">
                  {template.systemPrompt}
                </CardDescription>
                <Button
                  size="sm"
                  className="w-full"
                  disabled={creatingTemplate === template.name}
                  onClick={() => createFromTemplate(template)}
                >
                  {creatingTemplate === template.name ? "Creating..." : "Create"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Existing Personas */}
      {loading ? (
        <p>Loading...</p>
      ) : personas.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No personas yet. Create your first one!</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold">Your Personas</h2>
            <p className="text-sm text-muted-foreground">{personas.length} persona{personas.length !== 1 ? "s" : ""} configured</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {personas.map((persona) => (
              <Card key={persona.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{persona.avatar || "🤖"}</span>
                    <div>
                      <CardTitle className="text-lg">{persona.name}</CardTitle>
                      <Badge variant="secondary" className="text-xs">
                        {persona.provider}/{persona.model}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {persona.systemPrompt}
                  </p>
                  <div className="flex gap-2">
                    <Link href={`/personas/${persona.id}`} className="flex-1">
                      <Button variant="outline" className="w-full">Edit</Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => deletePersona(persona.id)}
                    >
                      🗑
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
