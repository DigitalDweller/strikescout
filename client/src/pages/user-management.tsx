import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Shield,
  User as UserIcon,
  UsersRound,
  Download,
  Printer,
  Eye,
} from "lucide-react";
import type { Event } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { CredentialCards } from "@/components/credential-cards";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun } from "lucide-react";

interface UserData {
  id: number;
  username: string;
  displayName: string;
  role: string;
  demoEventId?: number | null;
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserData | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("scouter");
  const [newDemoEventId, setNewDemoEventId] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkResults, setBulkResults] = useState<{ username: string; password: string }[] | null>(null);

  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("scouter");
  const [editDemoEventId, setEditDemoEventId] = useState("");

  const { data: users, isLoading } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
  });

  const { data: eventOptions } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    enabled: currentUser?.role === "admin",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        username: newUsername,
        password: newPassword,
        role: newRole,
      };
      if (newRole === "demo") {
        const eid = parseInt(newDemoEventId, 10);
        body.demoEventId = eid;
      }
      const res = await apiRequest("POST", "/api/users", body);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User created" });
      setCreateOpen(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("scouter");
      setNewDemoEventId("");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async () => {
      const lines = bulkInput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const scouts = lines.map((line) => {
        const parts = line.split(/\s+/);
        const username = parts[0] || "";
        const password = parts[1] || "";
        return { username, password: password || undefined };
      });
      const res = await apiRequest("POST", "/api/users/bulk", { scouts });
      return await res.json();
    },
    onSuccess: (data: { created: number; results: { username: string; password: string; created: boolean; error?: string }[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: `Created ${data.created} scout${data.created === 1 ? "" : "s"}` });
      setBulkOpen(false);
      setBulkInput("");
      const created = data.results.filter((r) => r.created && r.password);
      setBulkResults(created.length > 0 ? created.map((r) => ({ username: r.username, password: r.password })) : null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to bulk create", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const body: Record<string, unknown> = {};
      if (editUsername && editUsername !== editUser.username) body.username = editUsername;
      if (editRole !== editUser.role) body.role = editRole;
      if (editPassword) body.password = editPassword;
      if (editRole === "demo") {
        const eid = parseInt(editDemoEventId, 10);
        if (editRole !== editUser.role || eid !== editUser.demoEventId) {
          body.demoEventId = eid;
        }
      }
      const res = await apiRequest("PATCH", `/api/users/${editUser.id}`, body);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User updated" });
      setEditUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update user", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteUser) return;
      await apiRequest("DELETE", `/api/users/${deleteUser.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted" });
      setDeleteUser(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete user", description: error.message, variant: "destructive" });
    },
  });

  const openEdit = (u: UserData) => {
    setEditUser(u);
    setEditUsername(u.username);
    setEditRole(u.role);
    setEditPassword("");
    setEditDemoEventId(u.demoEventId != null ? String(u.demoEventId) : "");
  };

  if (currentUser?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-4 right-4 z-50">
        <Button size="icon" variant="ghost" onClick={toggleTheme} className="bg-background/50 backdrop-blur-sm">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="h-auto px-0 py-0 text-sm text-muted-foreground hover:text-foreground" asChild>
            <Link href="/">
              <span className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Events
              </span>
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-bold">User Management</h1>
          </div>
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const scouters = users?.filter((u) => u.role === "scouter") ?? [];
                    const csv = "username\n" + scouters.map((u) => u.username).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "strikescout-usernames.csv";
                    a.click();
                    URL.revokeObjectURL(a.href);
                    toast({ title: "Usernames exported" });
                  }}
                >
                  Export usernames (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const scouters = users?.filter((u) => u.role === "scouter") ?? [];
                    const printWindow = window.open("", "_blank");
                    if (!printWindow || scouters.length === 0) return;
                    printWindow.document.write(`
                      <!DOCTYPE html>
                      <html>
                        <head><title>Strikescout Credential Cards</title></head>
                        <body class="p-4 font-sans">
                          <h1 class="text-lg font-bold mb-4">Scout credentials – write password when handing out</h1>
                          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem">
                            ${scouters.map((u) => `
                              <div class="border rounded p-4" style="break-inside:avoid">
                                <div class="text-xs text-gray-500 mb-1">Strikescout</div>
                                <div class="font-bold text-lg">${u.username}</div>
                                <div class="mt-2 text-sm text-gray-500">Password: _______________</div>
                              </div>
                            `).join("")}
                          </div>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                    printWindow.close();
                    toast({ title: "Print dialog opened" });
                  }}
                >
                  Print blank cards
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => setBulkOpen(true)}>
              <UsersRound className="h-4 w-4 mr-1" />
              Bulk Create
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add User
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {users?.map((u) => (
              <Card key={u.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        {u.role === "admin" ? (
                          <Shield className="h-4 w-4 text-amber-500" />
                        ) : u.role === "demo" ? (
                          <Eye className="h-4 w-4 text-sky-500" />
                        ) : (
                          <UserIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{u.username}</span>
                          <Badge
                            variant={u.role === "admin" ? "default" : u.role === "demo" ? "outline" : "secondary"}
                            className="text-[10px] px-1.5 py-0 shrink-0"
                          >
                            {u.role}
                          </Badge>
                        </div>
                        {u.role === "demo" && u.demoEventId != null && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            Comp:{" "}
                            {eventOptions?.find((e) => e.id === u.demoEventId)?.name ?? `Event #${u.demoEventId}`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {u.username !== "username123" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(u)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setDeleteUser(u)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {users?.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-muted-foreground">No users yet. Add one to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Create Scouts</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            One line per scout. Format: <code className="bg-muted px-1 rounded">username</code> or <code className="bg-muted px-1 rounded">username password</code>. Leave password blank to auto-generate.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              bulkCreateMutation.mutate();
            }}
            className="space-y-4"
          >
            <Textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder={"scout1\nscout2 pass123\nscout3"}
              rows={8}
              className="font-mono text-sm"
            />
            <Button type="submit" className="w-full" disabled={bulkCreateMutation.isPending || !bulkInput.trim()}>
              {bulkCreateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Scouts
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Credentials Result Dialog - after bulk create */}
      <Dialog open={!!bulkResults?.length} onOpenChange={(open) => { if (!open) setBulkResults(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Credentials Created</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Download or print these credentials to hand out at the comp. Passwords cannot be recovered later.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!bulkResults?.length) return;
                const csv = "username,password\n" + bulkResults.map((c) => `${c.username},${c.password}`).join("\n");
                const blob = new Blob([csv], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "strikescout-credentials.csv";
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: "CSV downloaded" });
              }}
            >
              <Download className="h-4 w-4 mr-1" />
              Download CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!bulkResults?.length) return;
                const printWindow = window.open("", "_blank");
                if (!printWindow) return;
                printWindow.document.write(`
                  <!DOCTYPE html>
                  <html>
                    <head><title>Strikescout Credentials</title></head>
                    <body class="p-4">
                      <div id="cards-root"></div>
                    </body>
                  </html>
                `);
                const root = printWindow.document.getElementById("cards-root");
                if (root) {
                  root.innerHTML = bulkResults.map((c) => `
                    <div class="credential-card border rounded-lg p-4 mb-4" style="break-inside:avoid">
                      <div class="text-xs text-gray-500 mb-1">Strikescout</div>
                      <div class="font-bold text-lg">${c.username}</div>
                      <div class="mt-2 text-sm">
                        <span class="text-gray-500">Password: </span>
                        <span class="font-mono">${c.password}</span>
                      </div>
                    </div>
                  `).join("");
                }
                printWindow.document.close();
                printWindow.print();
                printWindow.close();
                toast({ title: "Print dialog opened" });
              }}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print Cards
            </Button>
          </div>
          <div className="overflow-auto flex-1 -mx-6 px-6">
            {bulkResults && <CredentialCards credentials={bulkResults} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkResults(null)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Enter username"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => {
                  setNewRole(v);
                  if (v !== "demo") setNewDemoEventId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scouter">Scouter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newRole === "demo" && (
              <div className="space-y-2">
                <Label>Comp (event)</Label>
                <Select value={newDemoEventId || undefined} onValueChange={setNewDemoEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select competition" />
                  </SelectTrigger>
                  <SelectContent>
                    {(eventOptions ?? []).map((ev) => (
                      <SelectItem key={ev.id} value={String(ev.id)}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending || (newRole === "demo" && !newDemoEventId)}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create User
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                placeholder="Username"
              />
            </div>
            <div className="space-y-2">
              <Label>New Password (leave blank to keep current)</Label>
              <Input
                type="password"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
                placeholder="Leave blank to keep current"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                onValueChange={(v) => {
                  setEditRole(v);
                  if (v !== "demo") setEditDemoEventId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scouter">Scouter</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="demo">Demo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editRole === "demo" && (
              <div className="space-y-2">
                <Label>Comp (event)</Label>
                <Select value={editDemoEventId || undefined} onValueChange={setEditDemoEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select competition" />
                  </SelectTrigger>
                  <SelectContent>
                    {(eventOptions ?? []).map((ev) => (
                      <SelectItem key={ev.id} value={String(ev.id)}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={updateMutation.isPending || (editRole === "demo" && !editDemoEventId)}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{deleteUser?.username}</span>? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
