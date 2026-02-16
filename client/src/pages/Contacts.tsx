import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Search, Building2, Mail, Phone, ChevronRight,
  RefreshCw, Plus, UserPlus, MessageSquare, Star,
  Loader2, TrendingUp, Calendar, Crown, ArrowUpRight
} from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const CATEGORY_COLORS: Record<string, string> = {
  client: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  vendor: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  other: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  client: "Client",
  prospect: "Prospect",
  partner: "Partner",
  vendor: "Vendor",
  other: "Other",
};

function formatRelative(d: string | Date | null) {
  if (!d) return "";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.charAt(0).toUpperCase();
}

// Engagement health color based on days since last meeting
function getEngagementColor(days: number | null) {
  if (days === null) return { bg: "bg-zinc-500/10", text: "text-zinc-500", dot: "bg-zinc-500" };
  if (days <= 7) return { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-500" };
  if (days <= 14) return { bg: "bg-yellow-500/10", text: "text-yellow-400", dot: "bg-yellow-500" };
  return { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-500" };
}

export default function Contacts() {
  const { isAuthenticated } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [newContact, setNewContact] = useState({
    name: "", email: "", phone: "", organization: "", title: "",
    category: "other" as string,
  });

  const utils = trpc.useUtils();

  const { data: contacts, isLoading } = trpc.contacts.list.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  const syncMutation = trpc.contacts.syncFromMeetings.useMutation({
    onSuccess: (data) => {
      toast.success(`Contacts synced — linked ${data.linked} contacts from ${data.meetings} meetings.`);
      utils.contacts.list.invalidate();
    },
    onError: () => toast.error("Could not sync contacts from meetings."),
  });

  const createMutation = trpc.contacts.create.useMutation({
    onSuccess: () => {
      toast.success("Contact created");
      utils.contacts.list.invalidate();
      setShowCreate(false);
      setNewContact({ name: "", email: "", phone: "", organization: "", title: "", category: "other" });
    },
  });

  const toggleStarMutation = trpc.contacts.toggleStar.useMutation({
    onSuccess: () => utils.contacts.list.invalidate(),
  });

  const handleSync = async () => {
    setSyncing(true);
    try { await syncMutation.mutateAsync(); } finally { setSyncing(false); }
  };

  // Stats
  const stats = useMemo(() => {
    if (!contacts) return { total: 0, starred: 0, clients: 0, prospects: 0, partners: 0, vendors: 0, totalMeetings: 0 };
    return {
      total: contacts.length,
      starred: contacts.filter((c: any) => c.starred).length,
      clients: contacts.filter((c: any) => c.category === "client").length,
      prospects: contacts.filter((c: any) => c.category === "prospect").length,
      partners: contacts.filter((c: any) => c.category === "partner").length,
      vendors: contacts.filter((c: any) => c.category === "vendor").length,
      totalMeetings: contacts.reduce((sum: number, c: any) => sum + (c.meetingCount || 0), 0),
    };
  }, [contacts]);

  // Top 10 most engaged contacts (by meeting count, then most recent)
  const top10 = useMemo(() => {
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

  // Starred contacts
  const starredContacts = useMemo(() => {
    if (!contacts) return [];
    return contacts.filter((c: any) => c.starred);
  }, [contacts]);

  // Filtered list for the full directory
  const filtered = useMemo(() => {
    if (!contacts) return [];
    let list = [...contacts];
    if (categoryFilter !== "all") list = list.filter((c: any) => c.category === categoryFilter);
    if (showStarredOnly) list = list.filter((c: any) => c.starred);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.organization?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
    }
    list.sort((a: any, b: any) => {
      if (a.starred && !b.starred) return -1;
      if (!a.starred && b.starred) return 1;
      return (b.meetingCount || 0) - (a.meetingCount || 0);
    });
    return list;
  }, [contacts, searchQuery, categoryFilter, showStarredOnly]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="bg-zinc-900/50 border-zinc-800">
              <CardContent className="pt-5 pb-4">
                <Skeleton className="h-4 w-20 bg-zinc-800 mb-3" />
                <Skeleton className="h-8 w-16 bg-zinc-800" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-40 bg-zinc-800/50 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Client Contacts</h1>
          <p className="text-sm text-zinc-500 mt-1">Relationship intelligence across all verticals</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync from Meetings"}
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium">
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-yellow-600" />
                  New Contact
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label className="text-zinc-400 text-xs">Name *</Label>
                  <Input value={newContact.name} onChange={(e) => setNewContact(p => ({ ...p, name: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Full name" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Email</Label>
                    <Input value={newContact.email} onChange={(e) => setNewContact(p => ({ ...p, email: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="email@example.com" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Phone</Label>
                    <Input value={newContact.phone} onChange={(e) => setNewContact(p => ({ ...p, phone: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="+1 (555) 000-0000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-zinc-400 text-xs">Organization</Label>
                    <Input value={newContact.organization} onChange={(e) => setNewContact(p => ({ ...p, organization: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Company name" />
                  </div>
                  <div>
                    <Label className="text-zinc-400 text-xs">Title</Label>
                    <Input value={newContact.title} onChange={(e) => setNewContact(p => ({ ...p, title: e.target.value }))}
                      className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Job title" />
                  </div>
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs">Category</Label>
                  <Select value={newContact.category} onValueChange={(v) => setNewContact(p => ({ ...p, category: v }))}>
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
                <DialogClose asChild>
                  <Button variant="ghost" className="text-zinc-400">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={() => createMutation.mutate({
                    ...newContact,
                    email: newContact.email || undefined,
                    phone: newContact.phone || undefined,
                    organization: newContact.organization || undefined,
                    title: newContact.title || undefined,
                    category: newContact.category as any,
                  })}
                  disabled={!newContact.name.trim() || createMutation.isPending}
                  className="bg-yellow-600 hover:bg-yellow-700 text-black font-medium"
                >
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Contact"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stat Cards Row — matching dashboard MetricCard style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
          <CardContent className="pt-4 pb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Contacts</span>
              <Users className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{stats.clients} clients · {stats.prospects} prospects</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
          <CardContent className="pt-4 pb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Starred</span>
              <Star className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-white">{stats.starred}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Trusted contacts</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
          <CardContent className="pt-4 pb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Meetings</span>
              <Calendar className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalMeetings}</p>
            <p className="text-xs text-zinc-600 mt-0.5">Across all contacts</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
          <CardContent className="pt-4 pb-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Categories</span>
              <Building2 className="h-4 w-4 text-yellow-600" />
            </div>
            <p className="text-2xl font-bold text-white">{stats.partners + stats.vendors}</p>
            <p className="text-xs text-zinc-600 mt-0.5">{stats.partners} partners · {stats.vendors} vendors</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Most Engaged — Premium Cards */}
      {top10.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-yellow-500" />
            <h2 className="text-lg font-semibold text-white">Top Engaged Contacts</h2>
            <Badge variant="outline" className="border-yellow-600/30 text-yellow-500 ml-2">{top10.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {top10.map((contact: any, idx: number) => {
              const engagement = getEngagementColor(contact.daysSinceLastMeeting);
              return (
                <Link key={contact.id} href={`/contact/${contact.id}`}>
                  <Card className={`bg-zinc-900/60 border-zinc-800 hover:border-yellow-600/40 transition-all cursor-pointer group relative overflow-hidden ${idx < 3 ? "ring-1 ring-yellow-600/10" : ""}`}>
                    {/* Rank indicator for top 3 */}
                    {idx < 3 && (
                      <div className="absolute top-0 right-0 w-8 h-8">
                        <div className="absolute top-0 right-0 w-0 h-0 border-t-[32px] border-l-[32px] border-t-yellow-600/30 border-l-transparent" />
                        <span className="absolute top-0.5 right-1.5 text-[10px] font-bold text-yellow-500">#{idx + 1}</span>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-yellow-600/15 flex items-center justify-center flex-shrink-0 group-hover:bg-yellow-600/25 transition-colors">
                          <span className="text-sm font-bold text-yellow-500">{getInitials(contact.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white group-hover:text-yellow-500 transition-colors truncate">
                            {contact.name}
                          </p>
                          {contact.organization && (
                            <p className="text-xs text-zinc-500 truncate">{contact.organization}</p>
                          )}
                        </div>
                        {contact.starred && (
                          <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3 text-zinc-500" />
                          <span className="text-xs font-semibold text-zinc-300">{contact.meetingCount}</span>
                          <span className="text-xs text-zinc-600">meetings</span>
                        </div>
                        <div className={`flex items-center gap-1 ${engagement.text}`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${engagement.dot}`} />
                          <span className="text-[10px] font-medium">
                            {contact.daysSinceLastMeeting === null ? "—" :
                             contact.daysSinceLastMeeting === 0 ? "Today" :
                             `${contact.daysSinceLastMeeting}d`}
                          </span>
                        </div>
                      </div>
                      {contact.category && contact.category !== "other" && (
                        <Badge variant="outline" className={`text-[10px] mt-2 ${CATEGORY_COLORS[contact.category] || ""}`}>
                          {CATEGORY_LABELS[contact.category] || contact.category}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Starred Contacts Section */}
      {starredContacts.length > 0 && !showStarredOnly && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            <h2 className="text-lg font-semibold text-white">Trusted Contacts</h2>
            <Badge variant="outline" className="border-yellow-600/30 text-yellow-500 ml-2">{starredContacts.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {starredContacts.slice(0, 6).map((contact: any) => {
              const engagement = getEngagementColor(contact.daysSinceLastMeeting);
              return (
                <Link key={contact.id} href={`/contact/${contact.id}`}>
                  <Card className="bg-zinc-900/60 border-zinc-800 hover:border-yellow-600/40 transition-all cursor-pointer group ring-1 ring-yellow-600/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-lg bg-yellow-600/15 flex items-center justify-center flex-shrink-0 group-hover:bg-yellow-600/25 transition-colors">
                          <span className="text-lg font-bold text-yellow-500">{getInitials(contact.name)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white group-hover:text-yellow-500 transition-colors truncate">
                              {contact.name}
                            </p>
                            <Star className="h-3 w-3 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {contact.organization && (
                              <span className="text-xs text-zinc-500 truncate">{contact.organization}</span>
                            )}
                            {contact.category && contact.category !== "other" && (
                              <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[contact.category] || ""}`}>
                                {CATEGORY_LABELS[contact.category]}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 text-xs text-zinc-400">
                            <MessageSquare className="h-3 w-3" />
                            <span className="font-medium">{contact.meetingCount || 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 mt-0.5 ${engagement.text}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${engagement.dot}`} />
                            <span className="text-[10px]">
                              {contact.lastMeetingDate ? formatRelative(contact.lastMeetingDate) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Directory */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-white">All Contacts</h2>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search by name, email, organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-zinc-900 border-zinc-800 text-white"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-white">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="client">Clients</SelectItem>
              <SelectItem value="prospect">Prospects</SelectItem>
              <SelectItem value="partner">Partners</SelectItem>
              <SelectItem value="vendor">Vendors</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showStarredOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            className={showStarredOnly
              ? "bg-yellow-600 hover:bg-yellow-700 text-black"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }
          >
            <Star className={`h-4 w-4 mr-1.5 ${showStarredOnly ? "fill-current" : ""}`} />
            Starred
          </Button>
        </div>

        {/* Contact Grid */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="h-12 w-12 text-zinc-700 mb-3" />
            <p className="text-zinc-400 text-sm mb-2">
              {searchQuery ? "No contacts match your search" : showStarredOnly ? "No starred contacts" : "No contacts found"}
            </p>
            {!searchQuery && !showStarredOnly && (
              <p className="text-zinc-600 text-xs mb-4">
                Click "Sync from Meetings" to auto-create contacts from your meeting participants
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((contact: any) => {
              const engagement = getEngagementColor(contact.daysSinceLastMeeting);
              return (
                <div key={contact.id} className="relative group">
                  {/* Star toggle button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleStarMutation.mutate({ id: contact.id });
                    }}
                    className="absolute top-3 right-3 z-10 p-1 rounded hover:bg-zinc-700/50 transition-colors"
                  >
                    <Star className={`h-3.5 w-3.5 ${contact.starred ? "text-yellow-500 fill-yellow-500" : "text-zinc-600 hover:text-zinc-400"}`} />
                  </button>

                  <Link href={`/contact/${contact.id}`}>
                    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/30 transition-all cursor-pointer h-full">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-10 w-10 rounded-lg bg-yellow-600/15 flex items-center justify-center flex-shrink-0 group-hover:bg-yellow-600/25 transition-colors">
                            <span className="text-sm font-bold text-yellow-500">{getInitials(contact.name)}</span>
                          </div>
                          <div className="flex-1 min-w-0 pr-6">
                            <p className="text-sm font-semibold text-white group-hover:text-yellow-500 transition-colors truncate">
                              {contact.name}
                            </p>
                            {contact.title && (
                              <p className="text-xs text-zinc-500 truncate">{contact.title}</p>
                            )}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1.5 mb-3">
                          {contact.organization && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Building2 className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                              <span className="truncate">{contact.organization}</span>
                            </div>
                          )}
                          {contact.email && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Mail className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                              <span className="truncate">{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <Phone className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
                          <div className="flex items-center gap-3">
                            {contact.category && contact.category !== "other" && (
                              <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[contact.category] || ""}`}>
                                {CATEGORY_LABELS[contact.category]}
                              </Badge>
                            )}
                            <div className="flex items-center gap-1 text-xs text-zinc-500">
                              <MessageSquare className="h-3 w-3" />
                              <span className="font-medium">{contact.meetingCount || 0}</span>
                            </div>
                          </div>
                          <div className={`flex items-center gap-1 ${engagement.text}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${engagement.dot}`} />
                            <span className="text-[10px] font-medium">
                              {contact.lastMeetingDate ? formatRelative(contact.lastMeetingDate) : "No meetings"}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
