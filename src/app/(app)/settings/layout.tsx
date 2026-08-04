import Link from "next/link";

const NAV = [
  { href: "/settings", label: "LLM providers" },
  { href: "/settings/prompts", label: "Prompts" },
  { href: "/settings/usage", label: "Usage & costs" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Workspace configuration, prompts, and usage.
        </p>
      </div>

      <nav className="flex gap-1 border-b border-border -mb-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border-b-2 border-transparent hover:border-border -mb-px"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
