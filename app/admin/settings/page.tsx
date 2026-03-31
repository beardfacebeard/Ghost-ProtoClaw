"use client";

import { useEffect, useState } from "react";
import { Save, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchWithCsrf } from "@/lib/api/csrf-client";
import { toast } from "@/components/ui/toast";

type ProfileData = {
  displayName: string;
  email: string;
  role: string;
  createdAt: string;
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const response = await fetch("/api/admin/settings", {
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Failed to load profile.");
        }

        const data = (await response.json()) as ProfileData;
        setProfile(data);
        setDisplayName(data.displayName);
      } catch {
        toast.error("Failed to load your profile.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error("Display name cannot be empty.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetchWithCsrf("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ displayName: displayName.trim() })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message ?? "Failed to update profile.");
      }

      toast.success("Your display name has been saved.");

      setProfile((prev) =>
        prev ? { ...prev, displayName: displayName.trim() } : prev
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Settings
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage your account and preferences.
          </p>
        </div>
        <Card className="border-ghost-border bg-ghost-card">
          <CardContent className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasChanges = profile && displayName.trim() !== profile.displayName;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Settings
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage your account and preferences.
        </p>
      </div>

      <Card className="border-ghost-border bg-ghost-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <User className="h-5 w-5 text-brand-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm text-slate-300">
              Display Name
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your display name"
              className="max-w-md border-ghost-border bg-ghost-raised text-white placeholder:text-zinc-500 focus-visible:ring-brand-primary"
            />
            <p className="text-xs text-zinc-500">
              This is the name shown in the sidebar and dashboard greeting.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Email</Label>
            <p className="text-sm text-zinc-400">{profile?.email ?? "---"}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-slate-300">Role</Label>
            <p className="text-sm text-zinc-400">
              {profile?.role === "super_admin" ? "Super Admin" : "Admin"}
            </p>
          </div>

          {profile?.createdAt ? (
            <div className="space-y-2">
              <Label className="text-sm text-slate-300">Member Since</Label>
              <p className="text-sm text-zinc-400">
                {new Date(profile.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric"
                })}
              </p>
            </div>
          ) : null}

          <div className="pt-2">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
