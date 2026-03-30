import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconColor?: string;
  badge?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive: boolean;
  };
  href?: string;
  loading?: boolean;
};

export function StatCard({
  title,
  value,
  icon,
  iconColor = "text-slate-400",
  badge,
  trend,
  href,
  loading = false
}: StatCardProps) {
  const content = (
    <Card
      variant="hover"
      className={cn(
        "h-full rounded-xl border-ghost-border bg-ghost-surface transition-all",
        href && "group"
      )}
    >
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-400">{title}</div>
            {badge ? <div>{badge}</div> : null}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl bg-ghost-raised",
              iconColor
            )}
          >
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-20 bg-ghost-raised" />
            <Skeleton className="h-4 w-32 bg-ghost-raised" />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-3xl font-bold tracking-tight text-white">
              {value}
            </div>
            {trend ? (
              <div
                className={cn(
                  "text-sm",
                  trend.positive ? "text-status-active" : "text-brand-amber"
                )}
              >
                {trend.positive ? "+" : "-"}
                {Math.abs(trend.value)} {trend.label}
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
