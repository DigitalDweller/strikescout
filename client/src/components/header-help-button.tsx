import { HelpCircle } from "lucide-react";
import { useHelp } from "@/contexts/help-context";
import { Button } from "@/components/ui/button";

const NAV_HELP = {
  title: "Getting around Strikescout",
  body: (
    <>
      <p><strong>Sidebar (left)</strong> — Use the menu to jump between sections. Tap the ☰ button if the menu is hidden on mobile.</p>
      <p><strong>Overview</strong> — Your event dashboard. Quick actions, upcoming matches, and scouting progress.</p>
      <p><strong>Teams</strong> — See all teams, sort by performance, and view team profiles.</p>
      <p><strong>Matches</strong> — Schedule and results. The Match Simulator helps predict outcomes.</p>
      <p><strong>Scouting form</strong> — Where scouters enter match data during the competition.</p>
      <p><strong>Picklist</strong> — Rank teams for alliance selection. Drag to reorder.</p>
      <p><strong>Data</strong> — Export your data to CSV for backup or analysis.</p>
      <p><strong>Settings</strong> — Connect to TBA (The Blue Alliance) to sync teams and schedule.</p>
      <p className="pt-2 border-t text-muted-foreground">Look for the <HelpCircle className="inline h-3.5 w-3.5 mx-0.5 align-middle" /> icon on any page for more specific help.</p>
    </>
  ),
};

export function HeaderHelpButton() {
  const help = useHelp();
  if (!help || !help.helpTipsEnabled) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
      onClick={() => help.showHelp(NAV_HELP)}
      aria-label="How to use Strikescout"
      title="Help"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden sm:inline text-xs">Help</span>
    </Button>
  );
}
