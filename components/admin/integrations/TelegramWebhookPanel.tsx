"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, Send, XCircle } from "lucide-react";

import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

type WebhookStatus = {
  connected: boolean;
  bot?: {
    username?: string;
    first_name?: string;
  } | null;
  webhook?: {
    url?: string;
    pending_update_count?: number;
    last_error_message?: string | null;
    last_error_date?: number | null;
  } | null;
  hint?: string;
};

/**
 * Telegram-specific setup panel. The Telegram bot only receives messages
 * after we call setWebhook on Telegram's API with our public URL and a
 * secret token — saving the bot token alone isn't enough. This panel
 * surfaces the current registration state and exposes Register / Remove
 * buttons so operators don't have to hit the API by hand.
 */
export function TelegramWebhookPanel() {
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"register" | "remove" | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithCsrf("/api/admin/integrations/telegram", {
        method: "GET"
      });
      const data = (await res.json()) as WebhookStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false, hint: "Could not load Telegram status." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRegister() {
    try {
      setWorking("register");
      const res = await fetchWithCsrf("/api/admin/integrations/telegram", {
        method: "POST"
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
        botUsername?: string;
      };
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to register the webhook.");
        return;
      }
      toast.success(data.message || "Webhook registered.");
      await refresh();
    } catch {
      toast.error("Failed to register the webhook.");
    } finally {
      setWorking(null);
    }
  }

  async function handleRemove() {
    try {
      setWorking("remove");
      const res = await fetchWithCsrf("/api/admin/integrations/telegram", {
        method: "DELETE"
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to remove the webhook.");
        return;
      }
      toast.success("Webhook removed.");
      await refresh();
    } catch {
      toast.error("Failed to remove the webhook.");
    } finally {
      setWorking(null);
    }
  }

  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking Telegram webhook status...
        </div>
      </div>
    );
  }

  const webhookRegistered = Boolean(status?.webhook?.url);
  const lastError = status?.webhook?.last_error_message;
  const botUsername = status?.bot?.username
    ? `@${status.bot.username}`
    : null;

  return (
    <div className="space-y-3 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-white">
          <Send className="h-4 w-4 text-brand-cyan" />
          Telegram Webhook
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void refresh()}
          disabled={loading || working !== null}
          className="h-7 gap-1.5"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </Button>
      </div>

      {!status?.connected ? (
        <div className="rounded-xl border border-ghost-border bg-ghost-raised/40 px-3 py-2 text-xs text-slate-400">
          Save the bot token above first, then come back to register the
          webhook.
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            {webhookRegistered ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-status-success" />
                <span className="text-status-success">
                  Webhook registered
                </span>
                {botUsername ? (
                  <span className="text-slate-400">— {botUsername}</span>
                ) : null}
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-status-warning" />
                <span className="text-status-warning">
                  Webhook not registered
                </span>
                {botUsername ? (
                  <span className="text-slate-400">— {botUsername}</span>
                ) : null}
              </>
            )}
          </div>

          {webhookRegistered && status?.webhook?.url ? (
            <div className="rounded-xl border border-ghost-border bg-ghost-raised/40 px-3 py-2 text-xs text-slate-300">
              <div className="text-slate-500">Delivery URL</div>
              <div className="break-all font-mono text-[11px]">
                {status.webhook.url}
              </div>
              {typeof status.webhook.pending_update_count === "number" ? (
                <div className="mt-1 text-slate-500">
                  Pending updates: {status.webhook.pending_update_count}
                </div>
              ) : null}
            </div>
          ) : null}

          {lastError ? (
            <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-3 py-2 text-xs text-slate-100">
              <div className="font-medium text-status-error">
                Last delivery error
              </div>
              <div className="mt-1">{lastError}</div>
            </div>
          ) : null}

          {!webhookRegistered ? (
            <p className="text-xs leading-5 text-slate-400">
              Telegram doesn&apos;t know where to send incoming messages yet.
              Click Register Webhook to point your bot at this instance.
            </p>
          ) : (
            <p className="text-xs leading-5 text-slate-400">
              Your bot is delivering messages to this instance. Message{" "}
              {botUsername || "your bot"} on Telegram and send /start to pair
              with an agent.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => void handleRegister()}
              disabled={working !== null}
            >
              {working === "register" ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {webhookRegistered ? "Re-register Webhook" : "Register Webhook"}
            </Button>
            {webhookRegistered ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleRemove()}
                disabled={working !== null}
              >
                {working === "remove" ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Remove Webhook
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
