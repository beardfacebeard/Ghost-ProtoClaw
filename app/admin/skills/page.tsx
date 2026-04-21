"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Shield,
  Sparkles,
  Wrench,
  Zap
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Skill = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  instructions: string | null;
  isRequired: boolean;
  status: string;
  createdAt: string;
  _count: { agentSkills: number };
  agentSkills?: Array<{
    agent: { id: string; displayName: string; emoji: string | null };
  }>;
};

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: typeof Wrench; color: string }
> = {
  general: { label: "General", icon: Wrench, color: "text-ink-secondary" },
  communication: {
    label: "Communication",
    icon: Zap,
    color: "text-steel-bright"
  },
  analysis: {
    label: "Analysis",
    icon: Search,
    color: "text-state-warning"
  },
  operations: {
    label: "Operations",
    icon: Sparkles,
    color: "text-steel-bright"
  },
  compliance: {
    label: "Compliance",
    icon: Shield,
    color: "text-state-success"
  },
  knowledge: {
    label: "Knowledge",
    icon: BookOpen,
    color: "text-purple-400"
  }
};

const CATEGORIES = [
  "general",
  "communication",
  "analysis",
  "operations",
  "compliance",
  "knowledge"
];

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES)
  );

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formInstructions, setFormInstructions] = useState("");
  const [formIsRequired, setFormIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSkills = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/skills", {
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        setSkills(data.skills);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function handleCreate() {
    if (!formName.trim()) return;
    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/skills", {
        method: "POST",
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          category: formCategory,
          instructions: formInstructions.trim() || null,
          isRequired: formIsRequired
        })
      });

      if (!response.ok) throw new Error("Failed to create skill.");

      toast.success("Skill created.");
      setCreateOpen(false);
      resetForm();
      fetchSkills();
    } catch {
      toast.error("Failed to create skill.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(skillId: string) {
    try {
      const response = await fetchWithCsrf(`/api/admin/skills/${skillId}`, {
        method: "DELETE"
      });

      if (!response.ok) throw new Error();

      toast.success("Skill archived.");
      setDetailSkill(null);
      fetchSkills();
    } catch {
      toast.error("Failed to archive skill.");
    }
  }

  async function fetchSkillDetail(skillId: string) {
    try {
      const response = await fetch(`/api/admin/skills/${skillId}`, {
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        setDetailSkill(data);
      }
    } catch {
      // silent
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormCategory("general");
    setFormInstructions("");
    setFormIsRequired(false);
  }

  // Filter skills
  const filtered = skills.filter((s) => {
    if (
      searchQuery &&
      !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !s.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
    return true;
  });

  // Group by category
  const grouped = new Map<string, Skill[]>();
  for (const skill of filtered) {
    const cat = skill.category || "general";
    const list = grouped.get(cat) ?? [];
    list.push(skill);
    grouped.set(cat, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Skills Library
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Define reusable skills and assign them to agents.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-steel text-white hover:bg-steel/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Skill
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Skills", count: skills.length, cls: "text-white" },
          {
            label: "Required",
            count: skills.filter((s) => s.isRequired).length,
            cls: "text-state-warning"
          },
          {
            label: "Categories",
            count: new Set(skills.map((s) => s.category)).size,
            cls: "text-steel-bright"
          },
          {
            label: "Agent Assignments",
            count: skills.reduce((sum, s) => sum + s._count.agentSkills, 0),
            cls: "text-steel-bright"
          }
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-line-subtle bg-bg-surface-2 px-3 py-2"
          >
            <div className="text-xs text-ink-muted">{s.label}</div>
            <div className={cn("text-lg font-bold", s.cls)}>{s.count}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-line-subtle bg-bg-surface-2 pl-9 text-white placeholder:text-ink-muted"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] border-line-subtle bg-bg-surface-2 text-white">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_CONFIG[cat]?.label ?? cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Skills by Category */}
      {loading ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-line-subtle bg-bg-surface">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Sparkles className="h-10 w-10 text-ink-muted" />
            <div className="text-center">
              <p className="text-sm font-medium text-ink-secondary">
                No skills found
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Create your first skill to build your agent capability library.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Skill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, categorySkills]) => {
            const cfg = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.general;
            const CategoryIcon = cfg.icon;
            const isExpanded = expandedCategories.has(category);

            return (
              <div key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  className="mb-2 flex w-full items-center gap-2 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-ink-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-muted" />
                  )}
                  <CategoryIcon className={cn("h-4 w-4", cfg.color)} />
                  <span className="text-sm font-medium text-white">
                    {cfg.label}
                  </span>
                  <span className="rounded-full bg-bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-muted">
                    {categorySkills.length}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="ml-6 space-y-2">
                    {categorySkills.map((skill) => (
                      <div
                        key={skill.id}
                        onClick={() => fetchSkillDetail(skill.id)}
                        className="group flex cursor-pointer items-start gap-3 rounded-xl border border-line-subtle bg-bg-surface p-4 transition-colors hover:border-line"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white">
                                {skill.name}
                              </p>
                              {skill.isRequired ? (
                                <Badge className="text-[10px] text-state-warning bg-state-warning/10">
                                  Required
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                              <Bot className="h-3 w-3" />
                              {skill._count.agentSkills} agent
                              {skill._count.agentSkills !== 1 ? "s" : ""}
                            </div>
                          </div>
                          {skill.description ? (
                            <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                              {skill.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Skill Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="border-line-subtle bg-bg-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">New Skill</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                Name *
              </label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Customer Support"
                className="border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                Category
              </label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="border-line-subtle bg-bg-surface-2 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_CONFIG[cat]?.label ?? cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                Description
              </label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="What does this skill enable an agent to do?"
                rows={2}
                className="border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-secondary">
                Instructions
              </label>
              <Textarea
                value={formInstructions}
                onChange={(e) => setFormInstructions(e.target.value)}
                placeholder="Detailed instructions for agents using this skill..."
                rows={4}
                className="border-line-subtle bg-bg-surface-2 text-white placeholder:text-ink-muted"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isRequired"
                checked={formIsRequired}
                onChange={(e) => setFormIsRequired(e.target.checked)}
                className="h-4 w-4 rounded border-line-subtle bg-bg-surface-2"
              />
              <label
                htmlFor="isRequired"
                className="text-xs text-ink-secondary"
              >
                Required for all agents
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!formName.trim() || saving}
                className="bg-steel text-white hover:bg-steel/90"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Skill
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skill Detail Dialog */}
      <Dialog
        open={!!detailSkill}
        onOpenChange={(v) => {
          if (!v) setDetailSkill(null);
        }}
      >
        {detailSkill ? (
          <DialogContent className="border-line-subtle bg-bg-surface sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                {detailSkill.name}
                {detailSkill.isRequired ? (
                  <Badge className="text-[10px] text-state-warning bg-state-warning/10">
                    Required
                  </Badge>
                ) : null}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] text-ink-secondary bg-bg-surface-2">
                  {CATEGORY_CONFIG[detailSkill.category]?.label ??
                    detailSkill.category}
                </Badge>
                <span className="text-[10px] text-ink-muted">
                  {detailSkill._count.agentSkills} agent
                  {detailSkill._count.agentSkills !== 1 ? "s" : ""} assigned
                </span>
              </div>

              {detailSkill.description ? (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-ink-secondary">
                    Description
                  </h4>
                  <p className="text-sm text-ink-primary">
                    {detailSkill.description}
                  </p>
                </div>
              ) : null}

              {detailSkill.instructions ? (
                <div>
                  <h4 className="mb-1 text-xs font-medium text-ink-secondary">
                    Instructions
                  </h4>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-bg-surface-2 p-3 text-xs text-ink-primary">
                    {detailSkill.instructions}
                  </pre>
                </div>
              ) : null}

              {detailSkill.agentSkills &&
              detailSkill.agentSkills.length > 0 ? (
                <div>
                  <h4 className="mb-1.5 text-xs font-medium text-ink-secondary">
                    Assigned Agents
                  </h4>
                  <div className="space-y-1.5">
                    {detailSkill.agentSkills.map((as) => (
                      <div
                        key={as.agent.id}
                        className="flex items-center gap-2 rounded-lg bg-bg-surface-2 px-3 py-2"
                      >
                        <span>{as.agent.emoji ?? "🤖"}</span>
                        <span className="text-sm text-white">
                          {as.agent.displayName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleArchive(detailSkill.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Archive
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailSkill(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
