"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Wrench,
  X,
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
import { SectionHeader } from "@/components/admin/SectionHeader";

// ── Types ──────────────────────────────────────────────────────────────

type AssignedAgent = {
  agent: { id: string; displayName: string; emoji: string | null };
};

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
  agentSkills?: AssignedAgent[];
};

type AgentOption = {
  id: string;
  displayName: string;
  emoji: string | null;
  businessName: string | null;
};

// ── Category config ────────────────────────────────────────────────────

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
    color: "text-state-ai"
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

// ── Page ───────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailSkill, setDetailSkill] = useState<Skill | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES)
  );

  // Form state (shared by Create + Edit)
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("general");
  const [formInstructions, setFormInstructions] = useState("");
  const [formIsRequired, setFormIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add-agent picker state (inside the detail dialog)
  const [agentPickerValue, setAgentPickerValue] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

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
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/agents?limit=500", {
        credentials: "same-origin"
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        agents?: Array<{
          id: string;
          displayName: string;
          emoji: string | null;
          business?: { name: string } | null;
        }>;
      };
      setAgents(
        (data.agents ?? []).map((a) => ({
          id: a.id,
          displayName: a.displayName,
          emoji: a.emoji,
          businessName: a.business?.name ?? null
        }))
      );
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchSkills();
    fetchAgents();
  }, [fetchSkills, fetchAgents]);

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  async function fetchSkillDetail(skillId: string) {
    try {
      const response = await fetch(`/api/admin/skills/${skillId}`, {
        credentials: "same-origin"
      });
      if (response.ok) {
        const data = await response.json();
        setDetailSkill(data);
        setEditMode(false);
        setAgentPickerValue("");
      }
    } catch {
      /* silent */
    }
  }

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormCategory("general");
    setFormInstructions("");
    setFormIsRequired(false);
  }

  function startEditing(skill: Skill) {
    setFormName(skill.name);
    setFormDescription(skill.description ?? "");
    setFormCategory(skill.category || "general");
    setFormInstructions(skill.instructions ?? "");
    setFormIsRequired(skill.isRequired);
    setEditMode(true);
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

  async function handleSaveEdit() {
    if (!detailSkill || !formName.trim()) return;
    setSaving(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/skills/${detailSkill.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim() || null,
            category: formCategory,
            instructions: formInstructions.trim() || null,
            isRequired: formIsRequired
          })
        }
      );
      if (!response.ok) throw new Error("Failed to save skill.");
      toast.success("Skill updated.");
      setEditMode(false);
      await fetchSkillDetail(detailSkill.id);
      fetchSkills();
    } catch {
      toast.error("Failed to save skill.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(skillId: string) {
    if (
      !window.confirm(
        "Archive this skill? Agents keep their current assignments but it won't be assignable to new agents."
      )
    ) {
      return;
    }
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

  async function handleAssignAgent() {
    if (!detailSkill || !agentPickerValue) return;
    setAssigning(true);
    try {
      const response = await fetchWithCsrf(
        `/api/admin/skills/${detailSkill.id}`,
        {
          method: "POST",
          body: JSON.stringify({
            action: "assign",
            agentId: agentPickerValue,
            enabled: true
          })
        }
      );
      if (!response.ok) throw new Error();
      toast.success("Skill assigned.");
      setAgentPickerValue("");
      await fetchSkillDetail(detailSkill.id);
      fetchSkills();
    } catch {
      toast.error("Failed to assign.");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassignAgent(agentId: string) {
    if (!detailSkill) return;
    try {
      const response = await fetchWithCsrf(
        `/api/admin/skills/${detailSkill.id}`,
        {
          method: "POST",
          body: JSON.stringify({ action: "unassign", agentId })
        }
      );
      if (!response.ok) throw new Error();
      toast.success("Skill unassigned.");
      await fetchSkillDetail(detailSkill.id);
      fetchSkills();
    } catch {
      toast.error("Failed to unassign.");
    }
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

  // Agents NOT yet assigned to the current detail skill (for the picker)
  const assignedIds = new Set(
    detailSkill?.agentSkills?.map((a) => a.agent.id) ?? []
  );
  const assignableAgents = agents.filter((a) => !assignedIds.has(a.id));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Team · Skills"
        title="Reusable agent capabilities."
        description="Define once, assign to any agent. Each skill is a named capability (with instructions) that agents can learn."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
            New Skill
          </Button>
        }
      />

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Skills", count: skills.length },
          {
            label: "Required",
            count: skills.filter((s) => s.isRequired).length
          },
          {
            label: "Categories",
            count: new Set(skills.map((s) => s.category)).size
          },
          {
            label: "Agent Assignments",
            count: skills.reduce((sum, s) => sum + s._count.agentSkills, 0)
          }
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-md border border-line-subtle bg-bg-surface px-3 py-2.5"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-[22px] font-semibold leading-none tracking-tight text-ink-primary">
              {s.count}
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
          <Input
            placeholder="Search skills…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
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

      {/* ── Skills by Category ─────────────────────────────────────── */}
      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-steel border-t-transparent" />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Sparkles
              className="h-8 w-8 text-ink-muted"
              strokeWidth={1.5}
            />
            <div className="text-center">
              <p className="text-[14px] font-medium text-ink-primary">
                No skills yet.
              </p>
              <p className="mt-1 text-[12px] text-ink-muted">
                Create your first skill to build a reusable capability library.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
              New Skill
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(
            ([category, categorySkills]) => {
              const cfg =
                CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.general;
              const CategoryIcon = cfg.icon;
              const isExpanded = expandedCategories.has(category);

              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="mb-2 flex w-full items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown
                        className="h-3.5 w-3.5 text-ink-muted"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <ChevronRight
                        className="h-3.5 w-3.5 text-ink-muted"
                        strokeWidth={1.5}
                      />
                    )}
                    <CategoryIcon
                      className={cn("h-3.5 w-3.5", cfg.color)}
                      strokeWidth={1.5}
                    />
                    <span className="font-mono text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">
                      {cfg.label}
                    </span>
                    <span className="rounded bg-bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">
                      {categorySkills.length}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="ml-6 space-y-2">
                      {categorySkills.map((skill) => (
                        <button
                          type="button"
                          key={skill.id}
                          onClick={() => fetchSkillDetail(skill.id)}
                          className="group flex w-full cursor-pointer items-start gap-3 rounded-md border border-line-subtle bg-bg-surface p-4 text-left transition-colors hover:border-line hover:bg-bg-surface-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-medium text-ink-primary">
                                  {skill.name}
                                </p>
                                {skill.isRequired ? (
                                  <Badge variant="amber">Required</Badge>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-muted">
                                <Bot
                                  className="h-3 w-3"
                                  strokeWidth={1.5}
                                />
                                {skill._count.agentSkills} agent
                                {skill._count.agentSkills !== 1 ? "s" : ""}
                              </div>
                            </div>
                            {skill.description ? (
                              <p className="mt-1 line-clamp-2 text-[11.5px] text-ink-muted">
                                {skill.description}
                              </p>
                            ) : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }
          )}
        </div>
      )}

      {/* ── Create Skill Dialog ───────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Skill</DialogTitle>
          </DialogHeader>
          <SkillForm
            name={formName}
            description={formDescription}
            category={formCategory}
            instructions={formInstructions}
            isRequired={formIsRequired}
            onNameChange={setFormName}
            onDescriptionChange={setFormDescription}
            onCategoryChange={setFormCategory}
            onInstructionsChange={setFormInstructions}
            onIsRequiredChange={setFormIsRequired}
          />
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
            >
              {saving ? (
                <Loader2
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                  strokeWidth={1.5}
                />
              ) : null}
              Create Skill
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Skill Detail / Edit Dialog ────────────────────────────── */}
      <Dialog
        open={!!detailSkill}
        onOpenChange={(v) => {
          if (!v) {
            setDetailSkill(null);
            setEditMode(false);
          }
        }}
      >
        {detailSkill ? (
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editMode ? "Edit Skill" : detailSkill.name}
                {!editMode && detailSkill.isRequired ? (
                  <Badge variant="amber">Required</Badge>
                ) : null}
              </DialogTitle>
            </DialogHeader>

            {editMode ? (
              <SkillForm
                name={formName}
                description={formDescription}
                category={formCategory}
                instructions={formInstructions}
                isRequired={formIsRequired}
                onNameChange={setFormName}
                onDescriptionChange={setFormDescription}
                onCategoryChange={setFormCategory}
                onInstructionsChange={setFormInstructions}
                onIsRequiredChange={setFormIsRequired}
              />
            ) : (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2">
                  <Badge variant="info">
                    {CATEGORY_CONFIG[detailSkill.category]?.label ??
                      detailSkill.category}
                  </Badge>
                  <span className="font-mono text-[10.5px] text-ink-muted">
                    {detailSkill._count.agentSkills} agent
                    {detailSkill._count.agentSkills !== 1 ? "s" : ""} assigned
                  </span>
                </div>

                {detailSkill.description ? (
                  <div>
                    <h4 className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      Description
                    </h4>
                    <p className="text-[13px] text-ink-primary">
                      {detailSkill.description}
                    </p>
                  </div>
                ) : null}

                {detailSkill.instructions ? (
                  <div>
                    <h4 className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      Instructions
                    </h4>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg-surface-2 p-3 font-mono text-[11.5px] text-ink-primary">
                      {detailSkill.instructions}
                    </pre>
                  </div>
                ) : null}

                {/* ── Assigned Agents + picker ───────────────────── */}
                <div>
                  <h4 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    Assigned Agents
                  </h4>
                  {detailSkill.agentSkills &&
                  detailSkill.agentSkills.length > 0 ? (
                    <div className="mb-3 space-y-1.5">
                      {detailSkill.agentSkills.map((as) => (
                        <div
                          key={as.agent.id}
                          className="group flex items-center gap-2 rounded-md border border-line-subtle bg-bg-surface-2 px-3 py-2"
                        >
                          <span>{as.agent.emoji ?? "🤖"}</span>
                          <span className="flex-1 text-[13px] text-ink-primary">
                            {as.agent.displayName}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              void handleUnassignAgent(as.agent.id)
                            }
                            className="rounded p-1 text-ink-muted opacity-0 transition hover:bg-state-danger/15 hover:text-state-danger group-hover:opacity-100"
                            aria-label={`Remove ${as.agent.displayName}`}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3 rounded-md border border-dashed border-line-subtle bg-bg-surface/60 px-3 py-4 text-center text-[12px] text-ink-muted">
                      Not assigned to any agent yet.
                    </div>
                  )}

                  {assignableAgents.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={agentPickerValue}
                        onValueChange={setAgentPickerValue}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Add an agent…" />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableAgents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.emoji ? `${agent.emoji} ` : ""}
                              {agent.displayName}
                              {agent.businessName
                                ? ` · ${agent.businessName}`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => void handleAssignAgent()}
                        disabled={!agentPickerValue || assigning}
                      >
                        {assigning ? (
                          <Loader2
                            className="h-3.5 w-3.5 animate-spin"
                            strokeWidth={1.5}
                          />
                        ) : (
                          <Plus
                            className="h-3.5 w-3.5"
                            strokeWidth={1.5}
                          />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-ink-muted">
                      Every agent in this org already has this skill.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2 border-t border-line-subtle pt-4">
              {editMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSaveEdit()}
                    disabled={!formName.trim() || saving}
                  >
                    {saving ? (
                      <Loader2
                        className="mr-1.5 h-3.5 w-3.5 animate-spin"
                        strokeWidth={1.5}
                      />
                    ) : null}
                    Save changes
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleArchive(detailSkill.id)}
                    className="text-state-danger hover:bg-state-danger/10 hover:text-state-danger"
                  >
                    <Trash2
                      className="mr-1.5 h-3.5 w-3.5"
                      strokeWidth={1.5}
                    />
                    Archive
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailSkill(null)}
                    >
                      Close
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => startEditing(detailSkill)}
                    >
                      <Pencil
                        className="mr-1.5 h-3.5 w-3.5"
                        strokeWidth={1.5}
                      />
                      Edit
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

// ── Shared form block used by both Create and Edit dialogs ────────────

function SkillForm({
  name,
  description,
  category,
  instructions,
  isRequired,
  onNameChange,
  onDescriptionChange,
  onCategoryChange,
  onInstructionsChange,
  onIsRequiredChange
}: {
  name: string;
  description: string;
  category: string;
  instructions: string;
  isRequired: boolean;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onInstructionsChange: (v: string) => void;
  onIsRequiredChange: (v: boolean) => void;
}) {
  return (
    <div className="space-y-4 pt-2">
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Name *
        </label>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g., Customer Support"
        />
      </div>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Category
        </label>
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger>
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
        <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Description
        </label>
        <Textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="What does this skill enable an agent to do?"
          rows={2}
        />
      </div>
      <div>
        <label className="mb-1.5 block font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-ink-muted">
          Instructions
        </label>
        <Textarea
          value={instructions}
          onChange={(e) => onInstructionsChange(e.target.value)}
          placeholder="Detailed instructions for agents using this skill…"
          rows={4}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isRequired"
          checked={isRequired}
          onChange={(e) => onIsRequiredChange(e.target.checked)}
          className="h-4 w-4 rounded border-line bg-bg-surface-2 accent-steel"
        />
        <label
          htmlFor="isRequired"
          className="text-[12px] text-ink-secondary"
        >
          Required for all agents
        </label>
      </div>
    </div>
  );
}
