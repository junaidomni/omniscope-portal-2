import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useRoute, Link } from "wouter";
import { toast } from "sonner";
import {
  Building2, Users, Calendar, Sparkles, ChevronLeft, Globe,
  Edit2, Save, X, Briefcase, MessageSquare, Clock, FileText,
  TrendingUp, Loader2, RefreshCw, CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Streamdown } from "streamdown";

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string) {
  const colors = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return colors[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
}

function timeAgo(date: string | Date | null) {
  if (!date) return "—";
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

const interactionIcons: Record<string, any> = {
  meeting: Calendar,
  note: MessageSquare,
  doc_shared: FileText,
  task_update: CheckSquare,
  email: MessageSquare,
  call: MessageSquare,
  intro: Users,
};

export default function CompanyProfile() {
  const [, params] = useRoute("/company/:id");
  const companyId = Number(params?.id);
  const { data: profile, isLoading, refetch } = trpc.companies.getProfile.useQuery(
    { id: companyId },
    { enabled: !!companyId }
  );
  const utils = trpc.useUtils();

  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => { toast.success("Company updated"); setEditing(false); refetch(); },
  });
  const refreshAiMutation = trpc.companies.refreshAiMemory.useMutation({
    onSuccess: () => { toast.success("AI Memory refreshed"); refetch(); },
    onError: () => toast.error("Failed to refresh AI Memory"),
  });

  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [activeTab, setActiveTab] = useState<"overview" | "people" | "timeline" | "ai" | "tasks">("overview");

  if (isLoading || !profile) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64 bg-zinc-800" />
        <Skeleton className="h-48 bg-zinc-800/50 rounded-xl" />
      </div>
    );
  }

  const startEdit = () => {
    setEditData({
      name: profile.name,
      domain: profile.domain || "",
      industry: profile.industry || "",
      status: profile.status,
      notes: profile.notes || "",
      owner: profile.owner || "",
    });
    setEditing(true);
  };

  const tabs = [
    { key: "overview", label: "Overview", icon: Building2 },
    { key: "people", label: `People (${profile.people?.length || 0})`, icon: Users },
    { key: "timeline", label: `Timeline (${profile.interactions?.length || 0})`, icon: Clock },
    { key: "ai", label: "AI Memory", icon: Sparkles },
    { key: "tasks", label: `Tasks (${profile.tasks?.length || 0})`, icon: CheckSquare },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Link href="/companies">
          <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <ChevronLeft className="h-4 w-4 mr-1" /> Companies
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile.logoUrl ? (
            <img src={profile.logoUrl} alt={profile.name} className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${getAvatarColor(profile.name)} flex items-center justify-center text-white text-lg font-bold`}>
              {getInitials(profile.name)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
            <div className="flex items-center gap-3 mt-1">
              {profile.industry && <span className="text-sm text-zinc-400">{profile.industry}</span>}
              {profile.domain && (
                <a href={`https://${profile.domain}`} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-yellow-600 hover:text-yellow-500 flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {profile.domain}
                </a>
              )}
              <Badge variant="outline" className={`text-[10px] ${
                profile.status === "active" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                profile.status === "partner" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" :
                profile.status === "prospect" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"
              }`}>{profile.status}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300" onClick={startEdit}>
              <Edit2 className="h-4 w-4 mr-2" /> Edit
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="text-zinc-400" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black"
                onClick={() => updateMutation.mutate({ id: companyId, ...editData })}
                disabled={updateMutation.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {tabs.map(tab => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-yellow-600 text-yellow-500"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-400 uppercase tracking-wider">Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {editing ? (
                <>
                  <div>
                    <label className="text-xs text-zinc-500">Name</label>
                    <Input value={editData.name} onChange={e => setEditData((p: any) => ({ ...p, name: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Domain</label>
                    <Input value={editData.domain} onChange={e => setEditData((p: any) => ({ ...p, domain: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Industry</label>
                    <Input value={editData.industry} onChange={e => setEditData((p: any) => ({ ...p, industry: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Status</label>
                    <Select value={editData.status} onValueChange={v => setEditData((p: any) => ({ ...p, status: v }))}>
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-700">
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Owner</label>
                    <Input value={editData.owner} onChange={e => setEditData((p: any) => ({ ...p, owner: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500">Notes</label>
                    <Textarea value={editData.notes} onChange={e => setEditData((p: any) => ({ ...p, notes: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" rows={3} />
                  </div>
                </>
              ) : (
                <>
                  {[
                    { label: "Domain", value: profile.domain },
                    { label: "Industry", value: profile.industry },
                    { label: "Status", value: profile.status },
                    { label: "Owner", value: profile.owner },
                  ].map(field => (
                    <div key={field.label} className="flex justify-between items-center py-1.5 border-b border-zinc-800/50">
                      <span className="text-xs text-zinc-500">{field.label}</span>
                      <span className="text-sm text-white">{field.value || "—"}</span>
                    </div>
                  ))}
                  {profile.notes && (
                    <div className="pt-2">
                      <span className="text-xs text-zinc-500">Notes</span>
                      <p className="text-sm text-zinc-300 mt-1">{profile.notes}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-400 uppercase tracking-wider">Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{profile.people?.length || 0}</div>
                  <div className="text-xs text-zinc-500">People</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{profile.interactions?.length || 0}</div>
                  <div className="text-xs text-zinc-500">Interactions</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{profile.tasks?.length || 0}</div>
                  <div className="text-xs text-zinc-500">Tasks</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-500">
                    {profile.interactions?.length > 0 ? timeAgo(profile.interactions[0]?.timestamp) : "—"}
                  </div>
                  <div className="text-xs text-zinc-500">Last Activity</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "people" && (
        <div className="space-y-3">
          {(!profile.people || profile.people.length === 0) ? (
            <div className="text-center py-12 text-zinc-600">No people linked to this company yet.</div>
          ) : (
            profile.people.map((person: any) => (
              <Link key={person.id} href={`/contact/${person.id}`}>
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 hover:border-yellow-600/40 transition-all cursor-pointer group flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(person.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                    {getInitials(person.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-white group-hover:text-yellow-400 transition-colors">{person.name}</div>
                    <div className="text-xs text-zinc-500">{person.title || person.email || "—"}</div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-zinc-600 rotate-180 group-hover:text-yellow-600" />
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-3">
          {(!profile.interactions || profile.interactions.length === 0) ? (
            <div className="text-center py-12 text-zinc-600">No interactions recorded yet.</div>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />
              {profile.interactions.map((interaction: any, idx: number) => {
                const Icon = interactionIcons[interaction.type] || MessageSquare;
                return (
                  <div key={interaction.id || idx} className="relative pl-12 pb-4">
                    <div className="absolute left-3 top-1 w-5 h-5 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center">
                      <Icon className="h-2.5 w-2.5 text-yellow-600" />
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400">{interaction.type}</Badge>
                        <span className="text-xs text-zinc-600">{timeAgo(interaction.timestamp)}</span>
                      </div>
                      <p className="text-sm text-zinc-300">{interaction.summary || "No summary"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "ai" && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-600" /> AI Memory
            </CardTitle>
            <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300"
              onClick={() => refreshAiMutation.mutate({ id: companyId })}
              disabled={refreshAiMutation.isPending}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshAiMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {profile.aiMemory ? (
              <div className="prose prose-invert prose-sm max-w-none">
                <Streamdown>{profile.aiMemory}</Streamdown>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-600">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-zinc-700" />
                <p>No AI Memory generated yet. Click "Refresh" to generate an executive brief.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "tasks" && (
        <div className="space-y-3">
          {(!profile.tasks || profile.tasks.length === 0) ? (
            <div className="text-center py-12 text-zinc-600">No tasks linked to this company.</div>
          ) : (
            profile.tasks.map((task: any) => (
              <div key={task.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 flex items-center gap-3">
                <CheckSquare className={`h-4 w-4 flex-shrink-0 ${task.status === "done" ? "text-emerald-500" : "text-zinc-600"}`} />
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${task.status === "done" ? "text-zinc-500 line-through" : "text-white"}`}>{task.title}</div>
                  {task.assignedName && <div className="text-xs text-zinc-500">{task.assignedName}</div>}
                </div>
                <Badge variant="outline" className={`text-[10px] ${
                  task.priority === "high" ? "border-red-500/30 text-red-400" :
                  task.priority === "medium" ? "border-yellow-500/30 text-yellow-400" :
                  "border-zinc-700 text-zinc-400"
                }`}>{task.priority}</Badge>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
