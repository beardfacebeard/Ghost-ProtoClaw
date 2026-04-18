export type PulseAgent = {
  id: string;
  displayName: string;
  emoji: string | null;
  role: string;
  type: string;
};

export type PulseBusiness = {
  id: string;
  name: string;
  agents: PulseAgent[];
};

export type PulseMaster = {
  id: string;
  displayName: string;
  emoji: string | null;
  status: string;
} | null;

export type PulseTopology = {
  master: PulseMaster;
  businesses: PulseBusiness[];
};

export type ActivityEventKind =
  | "workflow"
  | "approval"
  | "backup"
  | "integration"
  | "agent"
  | "system"
  | "action_run"
  | "tool_call"
  | "message";

export type ActivityEvent = {
  id: string;
  kind: ActivityEventKind;
  title: string;
  detail: string | null;
  status: string | null;
  businessId: string | null;
  businessName: string | null;
  agentId: string | null;
  agentName: string | null;
  agentEmoji: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};
