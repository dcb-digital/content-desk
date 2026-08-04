import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Workspace configuration, prompts, and usage.
        </p>
      </div>

      <SettingsNav />

      <div>{children}</div>
    </div>
  );
}
