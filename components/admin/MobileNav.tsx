"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mobileNavItems } from "@/components/admin/navigation";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  onMoreClick: () => void;
};

export function MobileNav({ onMoreClick }: MobileNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-line-subtle bg-bg-surface/95 px-2 py-2 backdrop-blur lg:hidden">
      <div className="grid h-11 grid-cols-5 gap-1">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isMore = !("href" in item);
          const active =
            !isMore &&
            (item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href));

          const className = cn(
            "flex flex-col items-center justify-center rounded-lg text-[11px] transition-colors",
            active ? "text-steel-bright" : "text-ink-muted hover:text-white"
          );

          if (isMore) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={onMoreClick}
                className={className}
              >
                <Icon className="mb-1 h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={className}>
              <Icon className="mb-1 h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
