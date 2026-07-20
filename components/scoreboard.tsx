"use client";

import { Trophy, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PersonaTotals {
  name: string;
  logic: number;
  persuasion: number;
  style: number;
  total: number;
}

export interface ScoreboardData {
  rounds: number;
  lastJudgedCount: number;
  totals: Record<string, PersonaTotals>;
  winner?: { personaId: string; name: string; statement: string };
}

interface ScoreboardProps {
  scoreboard: ScoreboardData;
  judging: boolean;
}

const BAR_COLORS = ["bg-amber-500", "bg-sky-500", "bg-violet-500", "bg-emerald-500", "bg-rose-500"];

export function Scoreboard({ scoreboard, judging }: ScoreboardProps) {
  const entries = Object.entries(scoreboard.totals).sort((a, b) => b[1].total - a[1].total);
  const maxTotal = entries.length > 0 ? Math.max(entries[0][1].total, 1) : 1;

  return (
    <Card className="border-amber-500/40">
      <CardContent className="p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-amber-500 font-semibold text-sm whitespace-nowrap">
            <Scale className="h-4 w-4" />
            Scoreboard
            <Badge variant="outline" className="text-xs ml-1">
              R{scoreboard.rounds}
            </Badge>
            {judging && (
              <span className="text-xs text-muted-foreground animate-pulse ml-1">
                deliberating…
              </span>
            )}
          </div>

          {entries.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              No verdicts yet — the judge scores after each full round.
            </span>
          ) : (
            <div className="flex-1 grid gap-1.5 min-w-[240px]">
              {entries.map(([personaId, t], idx) => (
                <div key={personaId} className="flex items-center gap-2">
                  <span className="text-xs font-medium w-32 truncate flex items-center gap-1">
                    {idx === 0 && scoreboard.winner?.personaId === personaId && (
                      <Trophy className="h-3 w-3 text-amber-500" />
                    )}
                    {t.name}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[idx % BAR_COLORS.length]}`}
                      style={{ width: `${(t.total / maxTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums font-semibold w-8 text-right">{t.total}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap hidden sm:inline">
                    L{t.logic} · P{t.persuasion} · S{t.style}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {scoreboard.winner && (
          <div className="mt-3 rounded-lg border border-amber-500/60 bg-amber-500/10 p-3 text-center">
            <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5" />
              WINNER: {scoreboard.winner.name}
            </div>
            {scoreboard.winner.statement && (
              <p className="text-sm text-muted-foreground mt-1 italic">
                &ldquo;{scoreboard.winner.statement}&rdquo;
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
