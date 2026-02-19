import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, UserPlus, Trash2, Crown, Zap, Download, Webhook, Loader2, CheckCircle, AlertCircle, Mail, Clock, X, Users, ScrollText, Search } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminPanel() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteRole, setInviteRole] = useState<"user" | "admin">("user");
  const [importLimit, setImportLimit] = useState("10");
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.admin.getAllUsers.useQuery();
  const { data: invitationsList = [] } = trpc.admin.listInvitations.useQuery();

  const createInvitation = trpc.admin.createInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation created successfully");
      setInviteEmail("");
      setInviteFullName("");
      setInviteRole("user");
      utils.admin.listInvitations.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const deleteInvitation = trpc.admin.deleteInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation revoked");
      utils.admin.listInvitations.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const updateUserRole = trpc.admin.updateUserRole.useMutation({
    onSuccess: () => {
      toast.success("User role updated");
      utils.admin.getAllUsers.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const deleteUser = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User removed");
      utils.admin.getAllUsers.invalidate();
    },
    onError: (error: { message: string }) => {
      toast.error(error.message);
    },
  });

  const importFathom = trpc.admin.importFathomMeetings.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} meeting(s) from Fathom`);
      } else if (data.skipped > 0) {
        toast.info(`All ${data.skipped} meeting(s) already imported`);
      }
      if (data.errors > 0) {
        toast.error(`${data.errors} meeting(s) failed to import`);
      }
    },
    onError: (error: { message: string }) => {
      toast.error(`Fathom import failed: ${error.message}`);
    },
  });

  const registerWebhook = trpc.admin.registerFathomWebhook.useMutation({
    onSuccess: () => {
      toast.success("Fathom webhook registered successfully");
    },
    onError: (error: { message: string }) => {
      toast.error(`Webhook registration failed: ${error.message}`);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }
    if (!inviteFullName.trim()) {
      toast.error("Please enter the person's full name");
      return;
    }
    createInvitation.mutate({
      email: inviteEmail.toLowerCase().trim(),
      fullName: inviteFullName.trim(),
      role: inviteRole,
    });
  };

  const handleImportFathom = () => {
    const limit = parseInt(importLimit) || 10;
    setImportResult(null);
    importFathom.mutate({ limit });
  };

  const handleRegisterWebhook = () => {
    const webhookUrl = `${window.location.origin}/api/webhook/fathom`;
    registerWebhook.mutate({ webhookUrl });
  };

  const pendingInvitations = invitationsList.filter((inv: { acceptedAt: Date | null }) => !inv.acceptedAt);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Admin Panel</h1>
            <p className="text-zinc-400">Manage users, integrations, and system settings</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/activity-log">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors">
                <ScrollText className="w-4 h-4" /> Activity Log
              </button>
            </Link>
            <Link href="/admin/dedup">
              <button className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors">
                <Search className="w-4 h-4" /> Dedup Sweep
              </button>
            </Link>
          </div>
        </div>

        {/* Invite New User */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-yellow-600" />
              Invite New User
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Only invited users can access the portal. They must sign in with the email specified below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input
                placeholder="Full Name"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white md:col-span-1"
              />
              <Input
                placeholder="Email Address"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-white md:col-span-2"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "user" | "admin")}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="user" className="text-white">Team Member</SelectItem>
                  <SelectItem value="admin" className="text-white">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleInvite}
                disabled={createInvitation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
              >
                {createInvitation.isPending ? "Sending..." : "Send Invite"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                Pending Invitations ({pendingInvitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvitations.map((inv: { id: number; fullName: string; email: string; role: string; createdAt: Date }) => (
                  <div key={inv.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-4">
                      <div className="h-9 w-9 rounded-full bg-yellow-600/20 border border-yellow-600/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{inv.fullName}</p>
                        <p className="text-zinc-400 text-xs">{inv.email}</p>
                      </div>
                      <Badge
                        variant={inv.role === "admin" ? "default" : "outline"}
                        className={inv.role === "admin"
                          ? "bg-yellow-600 text-black text-xs"
                          : "border-zinc-700 text-zinc-400 text-xs"
                        }
                      >
                        {inv.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-xs">
                        Invited {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteInvitation.mutate({ id: inv.id })}
                        className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Users */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-yellow-600" />
              Active Users ({users?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400">Name</TableHead>
                  <TableHead className="text-zinc-400">Email</TableHead>
                  <TableHead className="text-zinc-400">Role</TableHead>
                  <TableHead className="text-zinc-400">Last Sign In</TableHead>
                  <TableHead className="text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} className="border-zinc-800">
                    <TableCell className="text-white font-medium">
                      {user.name || "—"}
                    </TableCell>
                    <TableCell className="text-zinc-300">{user.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={user.role === "admin" ? "default" : "outline"}
                        className={
                          user.role === "admin"
                            ? "bg-yellow-600 text-black hover:bg-yellow-700"
                            : "border-zinc-700 text-zinc-400"
                        }
                      >
                        {user.role === "admin" && <Crown className="h-3 w-3 mr-1" />}
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-zinc-400">
                      {new Date(user.lastSignedIn).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) =>
                            updateUserRole.mutate({ userId: user.id, role: newRole as "user" | "admin" })
                          }
                        >
                          <SelectTrigger className="w-32 h-8 bg-zinc-800 border-zinc-700 text-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-800 border-zinc-700">
                            <SelectItem value="user" className="text-white text-xs">Member</SelectItem>
                            <SelectItem value="admin" className="text-white text-xs">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remove ${user.name || user.email}? They will need a new invitation to access the portal.`)) {
                              deleteUser.mutate({ userId: user.id });
                            }
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Fathom Integration */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Fathom Integration
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Import meetings from Fathom and configure automatic ingestion
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-zinc-800/50 rounded-lg p-5 border border-zinc-700/50">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <Download className="h-4 w-4 text-yellow-600" />
                Import Meetings
              </h3>
              <p className="text-zinc-400 text-sm mb-4">
                Pull existing meetings from your Fathom account. Each meeting is analyzed by AI to extract intelligence data.
              </p>
              <div className="flex items-center gap-3">
                <Select value={importLimit} onValueChange={setImportLimit}>
                  <SelectTrigger className="w-24 h-9 bg-zinc-800 border-zinc-700 text-white text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    <SelectItem value="5" className="text-white">5</SelectItem>
                    <SelectItem value="10" className="text-white">10</SelectItem>
                    <SelectItem value="20" className="text-white">20</SelectItem>
                    <SelectItem value="50" className="text-white">50</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleImportFathom}
                  disabled={importFathom.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black"
                >
                  {importFathom.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Import from Fathom</>
                  )}
                </Button>
              </div>
              {importResult && (
                <div className="mt-4 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700/50 flex items-center gap-4 text-sm">
                  {importResult.imported > 0 && (
                    <span className="flex items-center gap-1 text-green-400">
                      <CheckCircle className="h-4 w-4" />{importResult.imported} imported
                    </span>
                  )}
                  {importResult.skipped > 0 && (
                    <span className="flex items-center gap-1 text-zinc-400">
                      <AlertCircle className="h-4 w-4" />{importResult.skipped} already existed
                    </span>
                  )}
                  {importResult.errors > 0 && (
                    <span className="flex items-center gap-1 text-red-400">
                      <AlertCircle className="h-4 w-4" />{importResult.errors} errors
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-5 border border-zinc-700/50">
              <h3 className="text-white font-medium flex items-center gap-2 mb-3">
                <Webhook className="h-4 w-4 text-yellow-600" />
                Automatic Webhook
              </h3>
              <p className="text-zinc-400 text-sm mb-4">
                Register a webhook with Fathom to automatically ingest new meetings as they happen.
              </p>
              <div className="flex items-center gap-2 text-sm mb-3">
                <span className="text-zinc-400">Webhook URL:</span>
                <code className="bg-zinc-900 px-2 py-1 rounded text-yellow-600 text-xs font-mono">
                  {window.location.origin}/api/webhook/fathom
                </code>
              </div>
              <Button
                onClick={handleRegisterWebhook}
                disabled={registerWebhook.isPending}
                variant="outline"
                className="border-yellow-600/30 text-yellow-600 hover:bg-yellow-600/10"
              >
                {registerWebhook.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering...</>
                ) : (
                  <><Webhook className="h-4 w-4 mr-2" />Register Webhook</>
                )}
              </Button>
              {registerWebhook.isSuccess && (
                <p className="text-sm text-green-400 flex items-center gap-1 mt-2">
                  <CheckCircle className="h-4 w-4" />
                  Webhook registered. New meetings will be automatically ingested.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
