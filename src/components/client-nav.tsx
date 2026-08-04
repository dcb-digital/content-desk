"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Overview", href: "" },
  { label: "Knowledge", href: "/knowledge" },
  { label: "Objectives", href: "/objectives" },
  { label: "Evidence", href: "/evidence" },
  { label: "Opportunities", href: "/opportunities" },
  { label: "Plans", href: "/plans" },
  { label: "Documents", href: "/documents" },
];

export function ClientNav({ clientId }: { clientId: string }) {
  const pathname = usePathname();
  const base = `/clients/${clientId}`;

  return (
    <nav className="flex gap-0.5 border-b border-border -mb-px overflow-x-auto">
      {tabs.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive =
          tab.href === ""
            ? pathname === base
            : pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors",
              isActive
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
