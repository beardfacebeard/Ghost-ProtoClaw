"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useTransition
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

type LoginFormValues = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [csrfToken, setCsrfToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isRedirecting, startTransition] = useTransition();

  const redirectTarget = searchParams.get("redirect")?.startsWith("/")
    ? searchParams.get("redirect")!
    : "/admin";
  const incomingError = searchParams.get("error");

  const initialMessage = useMemo(() => {
    if (incomingError === "invalid_link") {
      return "That sign-in link is invalid or has already been used.";
    }

    if (incomingError === "account_suspended") {
      return "Account suspended. Contact your administrator.";
    }

    return null;
  }, [incomingError]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: ""
    }
  });

  useEffect(() => {
    let active = true;

    fetch("/api/auth/csrf", {
      method: "GET",
      cache: "no-store"
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to initialize CSRF.");
        }

        return response.json();
      })
      .then((data: { csrfToken?: string }) => {
        if (active) {
          setCsrfToken(data.csrfToken ?? "");
        }
      })
      .catch(() => {
        if (active) {
          setFormError(
            "Unable to start a secure sign-in session. Refresh the page and try again."
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          ...values,
          csrfToken
        })
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        if (response.status === 401) {
          setFormError("Invalid email or password.");
          return;
        }

        setFormError(
          payload?.error ??
            "Unable to sign in right now. Please check your details and try again."
        );
        return;
      }

      startTransition(() => {
        router.push(redirectTarget);
      });
    } catch {
      setFormError("Unable to sign in right now. Please try again.");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="space-y-6"
    >
      <Card className="border-ghost-border bg-ghost-surface/95 backdrop-blur">
        <CardHeader className="space-y-6 pb-4">
          <BrandLockup />
          <div className="space-y-2">
            <CardTitle className="text-2xl">Sign In</CardTitle>
            <CardDescription className="text-sm text-zinc-400">
              Enter your operator credentials to access Ghost ProtoClaw.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {(formError || initialMessage) && (
              <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm text-zinc-100">
                {formError || initialMessage}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="owner@business.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-status-error">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="pr-12"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors hover:text-white"
                  aria-label={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-sm text-status-error">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={
                form.formState.isSubmitting || isRedirecting || csrfToken.length === 0
              }
            >
              {form.formState.isSubmitting || isRedirecting
                ? "Signing In..."
                : "Sign In"}
            </Button>

            <div className="text-center text-sm">
              <Link
                href="/auth/forgot-password"
                className="text-zinc-400 hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-zinc-500">
        Need help?{" "}
        <a
          href="https://ghostprotoclaw.com"
          target="_blank"
          rel="noreferrer"
          className="text-zinc-300 hover:text-white"
        >
          Visit ghostprotoclaw.com
        </a>
      </p>
    </motion.div>
  );
}

function LoginPageFallback() {
  return (
    <Card className="border-ghost-border bg-ghost-surface/95 backdrop-blur">
      <CardHeader className="space-y-6 pb-4">
        <BrandLockup />
        <div className="space-y-2">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription className="text-sm text-zinc-400">
            Loading secure sign-in...
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-10 rounded-lg bg-ghost-raised" />
          <div className="h-10 rounded-lg bg-ghost-raised" />
          <div className="h-10 rounded-lg bg-ghost-raised" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
