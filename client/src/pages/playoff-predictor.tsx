import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ArrowLeft } from "lucide-react";
import { useSiteFlip } from "@/contexts/site-flip";

const PROTEST_WINDOW_MS = 5000;
const PROTEST_CLICKS_NEEDED = 10;
const PROTEST_BUTTON_DELAY_MS = 3000;

export default function PlayoffPredictor() {
  const { id } = useParams<{ id: string }>();
  const eventId = parseInt(id || "0");
  const { setFlipped } = useSiteFlip();
  const [showProtestButton, setShowProtestButton] = useState(false);
  const clickTimesRef = useRef<number[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setShowProtestButton(true), PROTEST_BUTTON_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  const handleProtestClick = () => {
    const now = Date.now();
    clickTimesRef.current = [...clickTimesRef.current, now].filter(
      (t) => now - t <= PROTEST_WINDOW_MS
    );
    if (clickTimesRef.current.length >= PROTEST_CLICKS_NEEDED) {
      setFlipped(true);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <Card className="border-dashed">
        <CardContent className="pt-8 pb-8 px-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-muted p-4">
              <TrendingUp className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold mb-2">Playoff predictor</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Simulate bracket outcomes and see who might advance. This feature is coming soon.
          </p>
          {showProtestButton ? (
            <Button variant="outline" onClick={handleProtestClick}>
              Protest
            </Button>
          ) : (
            <Link href={`/events/${eventId}`}>
              <span className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                <ArrowLeft className="h-4 w-4" />
                Back to overview
              </span>
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
