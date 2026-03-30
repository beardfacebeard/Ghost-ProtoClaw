import Link from "next/link";

import { BrandLockup } from "@/components/auth/brand-lockup";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SetupPasswordPageProps = {
  searchParams?: {
    mode?: string;
    error?: string;
  };
};

function getErrorMessage(error?: string) {
  if (error === "invalid_password") {
    return "Use a password with at least 8 characters and make sure both fields match.";
  }

  if (error === "invalid_link") {
    return "This setup link is invalid or has expired. Request a new one from your administrator.";
  }

  return null;
}

export default function SetupPasswordPage({
  searchParams
}: SetupPasswordPageProps) {
  const mode = searchParams?.mode === "invite" ? "invite" : "reset";
  const errorMessage = getErrorMessage(searchParams?.error);

  return (
    <Card className="border-ghost-border bg-ghost-surface/95 backdrop-blur">
      <CardHeader className="space-y-6 pb-4">
        <BrandLockup />
        <div className="space-y-2">
          <CardTitle className="text-2xl">
            {mode === "invite" ? "Set Your Password" : "Choose a New Password"}
          </CardTitle>
          <CardDescription className="text-sm text-zinc-400">
            {mode === "invite"
              ? "Finish your Ghost ProtoClaw invitation by setting a secure password."
              : "Enter your new password to regain access to Mission Control."}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form
          action={`/auth/magic?mode=${mode}`}
          method="post"
          className="space-y-5"
        >
          <input type="hidden" name="mode" value={mode} />
          {errorMessage && (
            <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm text-zinc-100">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Create a secure password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Re-enter your password"
            />
          </div>

          <Button type="submit" className="w-full">
            {mode === "invite" ? "Activate Mission Control" : "Update Password"}
          </Button>

          <div className="text-center text-sm text-zinc-500">
            <Link href="/login" className="text-zinc-300 hover:text-white">
              Back to sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
