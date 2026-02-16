import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  Briefcase, Search, Plus, Filter, ChevronRight, Globe,
  Users, Building2, Loader2, TrendingUp
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

const statusColors: Record<string, string> = {
  active: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  inactive: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  prospect: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  partner: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

function getCompanyInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getCompanyColor(name: string) {
  const colors = [
    "from-yellow-600 to-amber-700", "from-emerald-600 to-green-700",
    "from-blue-600 to-indigo-700", "from-purple-600 to-violet-700",
    "from-rose-600 to-pink-700", "from-cyan-600 to-teal-700",
  ];
  return colors[name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length];
}

export default function Companies() {
  const { isAuthenticated } = useAuth();
  const { data: companies, isLoading } = trpc.companies.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => { toast.success("Company created"); utils.companies.list.invalidate(); setShowCreate(false); setNewCompany({ name: "", domain: "", industry: "", status: "active" }); },
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", domain: "", industry: "", status: "active" as string });

  const filtered = useMemo(() => {
    if (!companies) return [];
    let result = [...companies];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c: any) =>
        c.name?.toLowerCase().includes(q) ||
        c.domain?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((c: any) => c.status === statusFilter);
    }
    return result;
  }, [companies, search, statusFilter]);

  const stats = useMemo(() => {
    if (!companies) return { total: 0, active: 0, prospects: 0, partners: 0 };
    return {
      total: companies.length,
      active: companies.filter((c: any) => c.status === "active").length,
      prospects: companies.filter((c: any) => c.status === "prospect").length,
      partners: companies.filter((c: any) => c.status === "partner").length,
    };
  }, [companies]);

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 bg-zinc-800/50 rounded-xl" />)}
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
            <Briefcase className="h-7 w-7 text-yellow-600" />
            Companies
          </h1>
          <p className="text-zinc-500 text-sm mt-1">{stats.total} organizations in your network</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
              <Plus className="h-4 w-4 mr-2" /> Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-yellow-600" /> New Company
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label className="text-zinc-400 text-xs">Company Name *</Label>
                <Input value={newCompany.name} onChange={e => setNewCompany(p => ({ ...p, name: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Company name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-zinc-400 text-xs">Domain / Website</Label>
                  <Input value={newCompany.domain} onChange={e => setNewCompany(p => ({ ...p, domain: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="example.com" />
                </div>
                <div>
                  <Label className="text-zinc-400 text-xs">Industry</Label>
                  <Input value={newCompany.industry} onChange={e => setNewCompany(p => ({ ...p, industry: e.target.value }))}
                    className="bg-zinc-800 border-zinc-700 text-white mt-1" placeholder="Financial Services" />
                </div>
              </div>
              <div>
                <Label className="text-zinc-400 text-xs">Status</Label>
                <Select value={newCompany.status} onValueChange={v => setNewCompany(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="partner">Partner</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="ghost" className="text-zinc-400">Cancel</Button></DialogClose>
              <Button onClick={() => createMutation.mutate({
                ...newCompany,
                domain: newCompany.domain || undefined,
                industry: newCompany.industry || undefined,
                status: newCompany.status as any,
              })} disabled={!newCompany.name.trim() || createMutation.isPending}
                className="bg-yellow-600 hover:bg-yellow-700 text-black font-semibold">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Company"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Companies", value: stats.total, icon: Building2 },
          { label: "Active", value: stats.active, icon: TrendingUp },
          { label: "Prospects", value: stats.prospects, icon: Search },
          { label: "Partners", value: stats.partners, icon: Globe },
        ].map((stat) => (
          <Card key={stat.label} className="bg-zinc-900/50 border-zinc-800 hover:border-yellow-600/20 transition-colors">
            <CardContent className="pt-4 pb-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <Input placeholder="Search companies by name, domain, or industry..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-zinc-900 border-zinc-800 text-white placeholder:text-zinc-600" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-zinc-900 border-zinc-800 text-white">
            <Filter className="h-4 w-4 mr-2 text-zinc-500" /><SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Companies Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          {search ? "No companies match your search" : "No companies yet. Add one to get started."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((company: any) => (
            <Link key={company.id} href={`/company/${company.id}`}>
              <Card className="bg-zinc-900/60 border-zinc-800 hover:border-yellow-600/40 transition-all cursor-pointer group">
                <CardContent className="pt-4 pb-3.5">
                  <div className="flex items-center gap-3 mb-3">
                    {company.logoUrl ? (
                      <img src={company.logoUrl} alt={company.name} className="w-10 h-10 rounded-lg object-cover" />
                    ) : (
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${getCompanyColor(company.name)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getCompanyInitials(company.name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-white truncate group-hover:text-yellow-400 transition-colors">
                        {company.name}
                      </div>
                      <div className="text-xs text-zinc-500 truncate">
                        {company.industry || company.domain || "—"}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-yellow-600 transition-colors flex-shrink-0" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] ${statusColors[company.status] || statusColors.active}`}>
                      {company.status}
                    </Badge>
                    {company.domain && (
                      <span className="text-xs text-zinc-600 flex items-center gap-1">
                        <Globe className="h-3 w-3" /> {company.domain}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
