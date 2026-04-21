"use client";

import { useState } from "react";
import { Loader2, Sparkles, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { fetchWithCsrf } from "@/lib/api/csrf-client";

type BusinessOption = { id: string; name: string };

type Props = {
  businesses: BusinessOption[];
  defaultBusinessId: string | null;
  onCreated: () => void;
};

export function TodoComposer({ businesses, defaultBusinessId, onCreated }: Props) {
  const [text, setText] = useState("");
  const [type, setType] = useState<"todo" | "idea">("todo");
  const [businessId, setBusinessId] = useState(defaultBusinessId ?? "");
  const [autoAssign, setAutoAssign] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastRationale, setLastRationale] = useState<string | null>(null);

  async function handleSave() {
    const raw = text.trim();
    if (raw.length < 3) {
      toast.error("Say a bit more.");
      return;
    }
    if (!businessId) {
      toast.error("Pick a business.");
      return;
    }
    setSaving(true);
    setLastRationale(null);
    try {
      // Split the raw text into a first-line title + the rest as
      // description. The LLM pass will clean this up if autoAssign=true.
      const lines = raw.split("\n");
      const title = lines[0].trim().slice(0, 240);
      const description = lines.slice(1).join("\n").trim() || undefined;

      const response = await fetchWithCsrf("/api/admin/todos", {
        method: "POST",
        body: JSON.stringify({
          businessId,
          type,
          title,
          description,
          autoAssign
        })
      });
      const result = (await response.json()) as {
        todo?: { id: string };
        rationale?: string | null;
        error?: string;
      };
      if (!response.ok || !result.todo) {
        throw new Error(result.error ?? "Unable to capture.");
      }
      setText("");
      setLastRationale(result.rationale ?? null);
      toast.success(type === "idea" ? "Idea captured." : "Todo captured.");
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to capture.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={
            type === "idea"
              ? "Brain-dump a fuzzy idea — you'll shape it later. 'Maybe a content series on pricing?'"
              : "What do you want done? 'Rewrite the homepage hero for clarity. Tag CMO.'"
          }
          className="min-h-[88px] resize-y"
          onKeyDown={(event) => {
            if (
              (event.metaKey || event.ctrlKey) &&
              event.key === "Enter" &&
              !saving
            ) {
              event.preventDefault();
              void handleSave();
            }
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select value={type} onValueChange={(v) => setType(v as "todo" | "idea")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todo">✅ Todo</SelectItem>
              <SelectItem value="idea">💡 Idea</SelectItem>
            </SelectContent>
          </Select>
          <Select value={businessId} onValueChange={setBusinessId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Choose business" />
            </SelectTrigger>
            <SelectContent>
              {businesses.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <Switch
              id="auto-assign"
              checked={autoAssign}
              onCheckedChange={setAutoAssign}
            />
            <Label htmlFor="auto-assign" className="cursor-pointer">
              <Sparkles className="inline h-3 w-3 mr-1" />
              AI auto-assign (agent, tags, due date)
            </Label>
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={saving || text.trim().length < 3 || !businessId}
            className="ml-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Capturing…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Capture
              </>
            )}
          </Button>
        </div>
        {lastRationale ? (
          <div className="rounded-lg border border-steel/25 bg-steel/5 px-3 py-2 text-xs text-ink-primary">
            <Badge variant="admin" className="mr-2">
              AI
            </Badge>
            {lastRationale}
          </div>
        ) : null}
        <p className="text-[11px] text-ink-muted">
          ⌘/Ctrl + Enter to capture. First line becomes the title; rest is
          description.
        </p>
      </CardContent>
    </Card>
  );
}
