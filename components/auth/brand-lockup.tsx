import { cn } from "@/lib/utils";

type BrandLockupProps = {
  className?: string;
  centered?: boolean;
};

export function BrandLockup({
  className,
  centered = false
}: BrandLockupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4",
        centered && "justify-center text-center",
        className
      )}
    >
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-primary/35 bg-brand-primary/10 shadow-brand-sm">
        <div className="absolute inset-2 rounded-xl bg-brand-primary/20 blur-md" />
        <span className="relative text-lg font-semibold text-white">GP</span>
      </div>
      <div>
        <div className="text-lg font-semibold tracking-[0.18em] text-white">
          Ghost ProtoClaw
        </div>
        <div className="mt-1 text-sm text-zinc-400">
          Complex tech. Invisible effort.
        </div>
      </div>
    </div>
  );
}
