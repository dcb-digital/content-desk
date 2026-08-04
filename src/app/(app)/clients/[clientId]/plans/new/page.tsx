import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createPlan } from "../actions";

type Props = { params: Promise<{ clientId: string }> };

export default async function NewPlanPage({ params }: Props) {
  const { clientId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold">New content plan</h2>
        <p className="text-sm text-muted-foreground">Schedule posts, pages, and refreshes.</p>
      </div>

      <form action={createPlan} className="space-y-5">
        <input type="hidden" name="clientId" value={clientId} />

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="name">Plan name</label>
          <input
            id="name" name="name" required
            placeholder="e.g. Q3 2026 Content Plan"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="startDate">Start date</label>
            <input
              id="startDate" name="startDate" type="date" required defaultValue={today}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="horizonDays">Horizon</label>
            <select
              id="horizonDays" name="horizonDays" defaultValue="30"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="7" className="bg-background">7 days</option>
              <option value="30" className="bg-background">30 days</option>
              <option value="60" className="bg-background">60 days</option>
              <option value="90" className="bg-background">90 days</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="postsPerMonth">Posts per month</label>
            <input
              id="postsPerMonth" name="postsPerMonth" type="number" min="0" max="50" defaultValue="4"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pagesPerMonth">Pages per month</label>
            <input
              id="pagesPerMonth" name="pagesPerMonth" type="number" min="0" max="20" defaultValue="1"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="focusMode">Focus mode</label>
          <select
            id="focusMode" name="focusMode"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="balanced" className="bg-background">Balanced</option>
            <option value="opportunities_first" className="bg-background">Opportunities first</option>
            <option value="objectives_first" className="bg-background">Objectives first</option>
          </select>
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2 text-sm font-medium"
        >
          Create plan
        </button>
      </form>
    </div>
  );
}
