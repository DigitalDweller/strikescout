import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const HELP_TIPS_STORAGE_KEY = "strikescout-help-tips-enabled";

function getStoredHelpTipsEnabled(): boolean {
  try {
    const v = localStorage.getItem(HELP_TIPS_STORAGE_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

export interface HelpContent {
  title: string;
  body: ReactNode;
  /** Optional; if provided, shows a "Learn more" link */
  learnMoreUrl?: string;
}

type HelpContextValue = {
  showHelp: (content: HelpContent) => void;
  hideHelp: () => void;
  /** Whether inline ? help tips are shown. Toggle in Settings. */
  helpTipsEnabled: boolean;
  setHelpTipsEnabled: (enabled: boolean) => void;
  /** For inline help: render a small ? icon that shows help on hover (1s delay). Hidden when helpTipsEnabled is false. */
  HelpTrigger: (props: { content: HelpContent; className?: string }) => JSX.Element | null;
};

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState<HelpContent | null>(null);
  const [helpTipsEnabled, setHelpTipsEnabledState] = useState(getStoredHelpTipsEnabled);

  useEffect(() => {
    try {
      localStorage.setItem(HELP_TIPS_STORAGE_KEY, String(helpTipsEnabled));
    } catch {
      /* ignore */
    }
  }, [helpTipsEnabled]);

  const setHelpTipsEnabled = useCallback((enabled: boolean) => {
    setHelpTipsEnabledState(enabled);
  }, []);

  const showHelp = useCallback((c: HelpContent) => {
    setContent(c);
    setOpen(true);
  }, []);

  const hideHelp = useCallback(() => {
    setOpen(false);
    setContent(null);
  }, []);

  const HelpTrigger = useCallback(
    ({ content: c, className }: { content: HelpContent; className?: string }) => {
      if (!helpTipsEnabled) return null;
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <span
              role="img"
              aria-label="What is this?"
              className={cn(
                "inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
                className
              )}
            >
              <HelpCircle className="h-4 w-4" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[240px] text-left">
            <div className="space-y-1">
              <p className="font-semibold">{c.title}</p>
              <div className="text-muted-foreground text-xs [&>p]:mt-0 [&>p]:leading-relaxed">
                {c.body}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    },
    [helpTipsEnabled]
  );

  return (
    <HelpContext.Provider value={{ showHelp, hideHelp, helpTipsEnabled, setHelpTipsEnabled, HelpTrigger }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{content?.title}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-3 prose prose-sm dark:prose-invert max-w-none">
            {content?.body}
          </div>
          {content?.learnMoreUrl && (
            <a
              href={content.learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Learn more →
            </a>
          )}
          <Button variant="outline" onClick={hideHelp} className="mt-2">
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  return ctx;
}
