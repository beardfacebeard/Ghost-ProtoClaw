import { formatMemoryTier, MEMORY_TIERS } from "@/lib/brain/workspace";

const memoryTypeLabels = {
  conversation_summary: "Conversation",
  learned_preference: "Preference",
  contact_note: "Contact",
  task_outcome: "Outcome",
  system_observation: "Observation"
} as const;

export const MEMORY_TYPE_LABELS = memoryTypeLabels;

export type MemoryTypeKey = keyof typeof MEMORY_TYPE_LABELS;

export const MEMORY_TYPE_OPTIONS: Array<{
  value: MemoryTypeKey;
  label: string;
  description: string;
}> = [
  {
    value: "conversation_summary",
    label: MEMORY_TYPE_LABELS.conversation_summary,
    description: "Summaries of recent conversations and active threads."
  },
  {
    value: "learned_preference",
    label: MEMORY_TYPE_LABELS.learned_preference,
    description: "Customer or operator preferences learned over time."
  },
  {
    value: "contact_note",
    label: MEMORY_TYPE_LABELS.contact_note,
    description: "Important facts about people, partners, or clients."
  },
  {
    value: "task_outcome",
    label: MEMORY_TYPE_LABELS.task_outcome,
    description: "Results from completed tasks, launches, and experiments."
  },
  {
    value: "system_observation",
    label: MEMORY_TYPE_LABELS.system_observation,
    description: "Operational observations, warnings, and runtime notes."
  }
];

export { MEMORY_TIERS, formatMemoryTier };

export function formatMemoryType(type: string) {
  return (
    MEMORY_TYPE_LABELS[type as MemoryTypeKey] ??
    type
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}
