import { cn } from "@/lib/utils";
import { Logo } from "@/components/admin/Logo";

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
      <Logo className="h-11 w-11 flex-shrink-0" />
      <div>
        <div className="text-lg font-semibold tracking-[0.1em] text-white">
          Ghost ProtoClaw
        </div>
        <div className="mt-1 text-sm font-light text-zinc-400">
          Complex tech. Invisible effort.
        </div>
      </div>
    </div>
  );
}
