import { MessageSquare, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Landing state for /admin/chat when no conversation is selected.
 * Once a conversation is picked in the sidebar, the nested route
 * takes over. This is just the "pick one" hero.
 */
export default function ChatPage() {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="flex max-w-lg flex-col items-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-steel/20 bg-bg-surface shadow-[0_0_40px_rgba(91,127,176,0.15)]">
          <MessageSquare
            className="h-7 w-7 text-steel-bright"
            strokeWidth={1.5}
          />
        </div>
        <div className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-muted">
          Work · Chat
        </div>
        <h2 className="mb-3 font-display text-[26px] font-semibold leading-tight tracking-tight text-ink-primary">
          Talk to your agents.
        </h2>
        <p className="mb-6 max-w-md text-[13px] leading-relaxed text-ink-secondary">
          Start a new conversation from the sidebar, or pick up an existing
          one. Agents remember the full thread, run tools inline, and hand
          off work to specialists when it makes sense.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-line-subtle bg-bg-surface-2 px-3 py-2 text-[11px] text-ink-muted">
          <Sparkles className="h-3 w-3 text-steel" strokeWidth={1.5} />
          Tip: press{" "}
          <kbd className="mx-0.5 rounded border border-line bg-bg-app px-1 py-px font-mono text-[10px] text-ink-secondary">
            ⌘K
          </kbd>
          {" "}to jump to any conversation instantly
        </div>
      </div>
    </div>
  );
}
