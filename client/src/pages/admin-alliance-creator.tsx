import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Swords, BarChart3, Users } from "lucide-react";

export default function AllianceCreator() {
  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Alliance Creator</h1>
        <Badge variant="secondary">Coming Soon</Badge>
      </div>

      <Card>
        <CardContent className="p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-6 rounded-2xl bg-primary/5">
              <Sparkles className="h-16 w-16 text-primary" />
            </div>
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-semibold">Coming Soon</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Alliance Creator will let you simulate matches before they happen.
              Build alliances, compare team stats, and develop winning strategies
              based on your scouting data.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-4 max-w-lg mx-auto">
            <div className="text-center space-y-2 p-4 rounded-md bg-muted/50">
              <Swords className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Match Simulation</p>
              <p className="text-xs text-muted-foreground">Predict outcomes</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-md bg-muted/50">
              <Users className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Alliance Builder</p>
              <p className="text-xs text-muted-foreground">Optimal pairings</p>
            </div>
            <div className="text-center space-y-2 p-4 rounded-md bg-muted/50">
              <BarChart3 className="h-6 w-6 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Stat Comparison</p>
              <p className="text-xs text-muted-foreground">Side by side</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
