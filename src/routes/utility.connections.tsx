import { createFileRoute } from "@tanstack/react-router";
import { Cable } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/utility/connections")({
  component: UtilityConnectionsPage,
});

function UtilityConnectionsPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Cable className="h-5 w-5 text-orange-400" />
        <h1 className="font-mono text-sm uppercase tracking-widest text-orange-400">
          Grid Connections — UTL-02
        </h1>
      </div>
      <Card className="flex flex-1 items-center justify-center border-orange-400/20 bg-orange-400/5 p-12">
        <p className="font-mono text-xs text-muted-foreground">
          Grid connection management module — in development
        </p>
      </Card>
    </div>
  );
}
