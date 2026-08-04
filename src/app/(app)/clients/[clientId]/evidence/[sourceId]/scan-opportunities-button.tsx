"use client";

import { useTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { scanOpportunities } from "./actions";

type Query = { query: string; clicks: number; impressions: number; ctr: number; position: number };

export function ScanOpportunitiesButton({
  clientId,
  queries,
  snapshotId,
}: {
  clientId: string;
  queries: Query[];
  snapshotId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function handleScan() {
    startTransition(async () => {
      const added = await scanOpportunities(clientId, queries, snapshotId);
      setResult(`Added ${added} new opportunities`);
      setTimeout(() => setResult(null), 4000);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {result && <p className="text-xs text-muted-foreground">{result}</p>}
      <Button size="sm" variant="outline" onClick={handleScan} disabled={pending}>
        <Zap className="size-3.5 mr-1.5" />
        {pending ? "Scanning…" : "Scan opportunities"}
      </Button>
    </div>
  );
}
