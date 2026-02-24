import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Bot, ClipboardList, BarChart3, Shield } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function AuthPage() {
  const { loginMutation } = useAuth();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="flex justify-center lg:hidden mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Bot className="h-7 w-7" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">FRC Scout Hub</h1>
            <p className="text-sm text-muted-foreground">Sign in to start scouting</p>
          </div>

          <Form {...loginForm}>
            <form
              onSubmit={loginForm.handleSubmit((data) => loginMutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={loginForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your username"
                        data-testid="input-login-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter your password"
                        data-testid="input-login-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                )}
                Sign In
              </Button>
            </form>
          </Form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Contact your admin for login credentials
          </p>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-primary p-12 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary/80" />
        <div className="relative text-primary-foreground max-w-lg text-center space-y-8">
          <div className="flex justify-center">
            <div className="p-5 rounded-2xl bg-primary-foreground/10 backdrop-blur-sm">
              <Bot className="h-16 w-16" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-bold tracking-tight">
              Track. Analyze. Win.
            </h2>
            <p className="text-lg opacity-90 leading-relaxed">
              Your team's scouting companion for the 2026 FIRST Robotics
              Competition season. Scout robots, track stats, and build winning
              strategies.
            </p>
          </div>
          <div className="flex justify-center gap-10 pt-4">
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <ClipboardList className="h-7 w-7 opacity-80" />
              </div>
              <p className="text-sm font-medium opacity-90">Scout Matches</p>
            </div>
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <BarChart3 className="h-7 w-7 opacity-80" />
              </div>
              <p className="text-sm font-medium opacity-90">Track Stats</p>
            </div>
            <div className="text-center space-y-2">
              <div className="flex justify-center">
                <Shield className="h-7 w-7 opacity-80" />
              </div>
              <p className="text-sm font-medium opacity-90">Build Strategy</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
