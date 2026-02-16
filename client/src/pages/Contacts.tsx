import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Users, Star, Search, Plus, RefreshCw, Building2, Mail, Phone,
  Calendar, TrendingUp, Clock, Filter, ChevronRight, Briefcase,
  Globe, ArrowUpRight, Sparkles, UserPlus, Crown, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const categoryColors: Record<string, string> = {
  client: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  vendor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
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
  if (!date) return "Never";
  const diffDays = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function engagementDot(days: number | null) {
  if (days === null) return "bg-zinc-700";
  if (days <= 7) return "bg-emerald-500";
  if (days <= 30) return "bg-yellow-500";
  return "bg-red-500";
}

function engagementText(days: number | null) {
  if (days === null) return "text-zinc-600";
  if (days <= 7) return "text-emerald-400";
  if (days <= 30) return "text-yellow-400";
  return "text-red-400";
}

export default function Contacts() {
  const { isAuthenticated } = useAuth();
  const { data: contacts, isLoading, refetch } = trpc.contacts.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const syncMutation = trpc.contacts.syncFromMeetings.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Synced ${result.created || 0} new contacts, ${result.linked || 0} meeting links`);
      utils.contacts.list.invalidate();
    },
  });
  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => { toast.success("Contact created"); utils.contacts.list.invalidate(); setShowCreate(false); setNewContact({ name: "", email: "", phone: "", organization: "", title: "", category: "other" }); },
  });

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", organization: "", title: "", category: "other" as string });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let result = [...contacts];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") {
      if (categoryFilter === "starred") {
        result = result.filter((c: any) => c.starred);
      } else {
        result = result.filter((c: any) => c.category === categoryFilter);
      }
    }
    result.sort((a: any, b: any) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return (b.meetingCount || 0) - (a.meetingCount || 0);
    });
    return result;
  }, [contacts, search, categoryFilter]);

  const topEngaged = useMemo(() => {
    if (!contacts) return [];
    return [...contacts]
      .filter((c: any) => c.meetingCount > 0)
      .sort((a: any, b: any) => {
        if (b.meetingCount !== a.meetingCount) return b.meetingCount - a.meetingCount;
        const aDate = a.lastMeetingDate ? new Date(a.lastMeetingDate).getTime() : 0;
        const bDate = b.lastMeetingDate ? new Date(b.lastMeetingDate).getTime() : 0;
        return bDate - aDate;
      })
      .slice(0, 10);
  }, [contacts]);

  const starredContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c: any) => c.starred);
  }, [contacts]);

  const stats = useMemo(() => {
    if (!contacts) return { total: 0, clients: 0, prospects: 0, partners: 0, starred: 0, totalMeetings: 0 };
    return {
      total: contacts.length,
      clients: contacts.filter((c: any) => c.category === "client").length,
      prospects: contacts.filter((c: any) => c.category === "prospect").length,
      partners: contacts.filter((c: any) => c.category === "partner").length,
      starred: contacts.filter((c: any) => c.starred).length,
      totalMeetings: contacts.reduce((sum: number, c: any) => sum + (c.meetingCount || 0), 0),
    };
  }, [contacts]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/50 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-36 bg-zinc-800/50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="h-7 w-7 text-yellow-600" />
            Relationship Hub
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{stats.total} people across your network</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            Sync Meetings
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                <UserPlus className="h-4 w-4 mr-2" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600" /> New Contact
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label className="text-zinc-400 text-xs">Name *</Label>
                  <Input value={newContact.name} onChange={e => setNewContact(p => ({ ...p, name: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Full name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Email</Label>
                    <Input value={newContact.email} onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="email@example.com" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Phone</Label>
                    <Input value={newContact.phone} onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Organization</Label>
                    <Input value={newContact.organization} onChange={e => setNewContact(p => ({ ...p, organization: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Company name" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Title</Label>
                    <Input value={newContact.title} onChange={e => setNewContact(p => ({ ...p, title: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Job title" />
                  </div>
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs">Category</Label>
                  <Select value={newContact.category} onValueChange={v => setNewContact(p => ({ ...p, category: v }))}>
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button variant="ghost" className="text-zinc-400">Cancel</Button></DialogClose>
                <Button onClick={() => createMutation.mutate({
                  ...newContact,
                  email: newContact.email || undefined,
                  phone: newContact.phone || undefined,
                  organization: newContact.organization || undefined,
                  title: newContact.title || undefined,
                  category: newContact.category as any,
                })} disabled={!newContact.name.trim() || createMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Contact"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total People", value: stats.total, icon: Users, sub: `${stats.clients} clients · ${stats.prospects} prospects` },
          { label: "Clients", value: stats.clients, icon: Briefcase, sub: "Active clients" },
          { label: "Partners", value: stats.partners, icon: Globe, sub: "Strategic partners" },
          { label: "Starred", value: stats.starred, icon: Star, sub: "Trusted contacts" },
          { label: "Meetings", value: stats.totalMeetings, icon: Calendar, sub: "Total engagements" },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
            <CardContent className="pt-4 pb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top 10 Engaged Contacts */}
      {topEngaged.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-white">Top Engaged Contacts</h2>
            <Badge variant="outline" className="border-yellow-600/30 text-yellow-500 ml-2">{topEngaged.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {topEngaged.map((contact: any, idx: number) => (
              <Link key={contact.id} href={`/contact/${contact.id}`}>
                <Card className={`bg-zinc-900/60 border-zinc-800 hover:border-yellow-600/40 transition-all cursor-pointer group relative overflow-hidden ${idx < 3 ? "ring-1 ring-yellow-600/10" : ""}`}>
                  {idx < 3 && (
                    <div className="absolute top-0 right-0 w-8 h-8">
                      <div className="absolute top-0 right-0 w-0 h-0 border-t-[32px] border-l-[32px] border-t-yellow-600/80 border-l-transparent" />
                      <span className="absolute top-0.5 right-1.5 text-[10px] font-bold text-black">{idx + 1}</span>
                    </div>
                  )}
                  <CardContent className="pt-4 pb-3.5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                        {getInitials(contact.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors flex items-center gap-1">
                          {contact.name}
                          {contact.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">{contact.companyName || contact.organization || contact.title || "—"}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {contact.meetingCount} meetings
                      </span>
                      <span className={engagementText(contact.daysSinceLastMeeting)}>
                        {timeAgo(contact.lastMeetingDate)}
                      </span>
                    </div>
                    {contact.category && contact.category !== "other" && (
                      <Badge variant="outline" className={`mt-2 text-[10px] ${categoryColors[contact.category]}`}>
                        {contact.category}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Starred / Trusted Contacts */}
      {starredContacts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-lg font-semibold text-white">Trusted Contacts</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {starredContacts.map((contact: any) => (
              <Link key={contact.id} href={`/contact/${contact.id}`}>
                <div className="bg-zinc-900/80 border border-yellow-600/30 rounded-xl p-4 hover:border-yellow-600/60 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors flex items-center gap-1">
                        {contact.name}
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{contact.companyName || contact.organization || "—"}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search people by name, email, company, or title..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white">
            <Filter className="h-4 w-4 mr-2 text-zinc-500" /><SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All People</SelectItem>
            <SelectItem value="starred">Starred</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="prospect">Prospects</SelectItem>
            <SelectItem value="partner">Partners</SelectItem>
            <SelectItem value="vendor">Vendors</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Full Directory Table */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-400" />
          All People
          <span className="text-sm font-normal text-zinc-500">({filtered.length})</span>
        </h2>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-800 text-xs text-zinc-500 font-medium uppercase tracking-wider">
            <div className="col-span-4">Person</div>
            <div className="col-span-2">Company</div>
            <div className="col-span-1 text-center">Category</div>
            <div className="col-span-1 text-center">Meetings</div>
            <div className="col-span-2">Last Interaction</div>
            <div className="col-span-1 text-center">Health</div>
            <div className="col-span-1"></div>
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-zinc-600">
              {search ? "No contacts match your search" : "No contacts yet. Sync from meetings or add manually."}
            </div>
          ) : (
            filtered.map((contact: any) => (
              <Link key={contact.id} href={`/contact/${contact.id}`}>
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer group items-center">
                  <div className="col-span-4 flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarColor(contact.name)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                      {getInitials(contact.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate group-hover:text-yellow-400 transition-colors flex items-center gap-1">
                        {contact.name}
                        {contact.starred && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">{contact.email || contact.title || "—"}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-zinc-400 truncate">
                    {contact.companyName || contact.organization || "—"}
                  </div>
                  <div className="col-span-1 text-center">
                    {contact.category && contact.category !== "other" ? (
                      <Badge variant="outline" className={`text-[10px] ${categoryColors[contact.category]}`}>
                        {contact.category}
                      </Badge>
                    ) : <span className="text-zinc-600 text-xs">—</span>}
                  </div>
                  <div className="col-span-1 text-center text-sm text-zinc-400">{contact.meetingCount || 0}</div>
                  <div className="col-span-2 text-sm text-zinc-500">{timeAgo(contact.lastMeetingDate)}</div>
                  <div className="col-span-1 text-center">
                    <div className={`w-2.5 h-2.5 rounded-full mx-auto ${engagementDot(contact.daysSinceLastMeeting)}`} />
                  </div>
                  <div className="col-span-1 text-right">
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-yellow-600 transition-colors inline-block" />
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
