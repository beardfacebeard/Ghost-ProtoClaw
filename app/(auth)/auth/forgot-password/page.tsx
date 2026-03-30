"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
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

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ""
    }
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(values)
      });

      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      setMessage(
        payload?.message ?? "If that email is registered, you'll receive a reset link."
      );
    } catch {
      setMessage("If that email is registered, you'll receive a reset link.");
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
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription className="text-sm text-zinc-400">
              Enter your email and we&apos;ll send a secure reset link if an
              account is registered.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {message && (
              <div className="rounded-xl border border-ghost-border bg-ghost-raised px-4 py-3 text-sm text-zinc-100">
                {message}
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

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? "Sending Reset Link..."
                : "Send Reset Link"}
            </Button>

            <div className="text-center text-sm text-zinc-500">
              <Link href="/login" className="text-zinc-300 hover:text-white">
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}
