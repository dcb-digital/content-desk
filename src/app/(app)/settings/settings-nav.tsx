"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/settings", label: "LLM providers", exact: true },
  { href: "/settings/prompts", label: "Prompts", exact: false },
  { href: "/settings/usage", label: "Usage & costs", exact: false },
  { href: "/settings/team", label: "Team", exact: false },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-border -mb-2">
      {NAV.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              isActive
                ? "text-foreground border-foreground"
                : "text-muted-foreground border-transparent hover:text-foreground hover:border-border"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
