import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            This page doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Button asChild className="mt-6 w-full sm:w-auto" variant="secondary">
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Back to home
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
