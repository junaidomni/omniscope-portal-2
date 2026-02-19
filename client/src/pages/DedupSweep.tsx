import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Search, GitMerge, XCircle, AlertTriangle, CheckCircle2, User, Loader2 } from "lucide-react";
import { toast } from "sonner";

type DedupCluster = {
  contacts: Array<{
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    organization: string | null;
    title: string | null;
  }>;
  confidence: number;
  reason: string;
};

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? "text-red-400 bg-red-500/10 border-red-500/20" :
    confidence >= 70 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" :
    "text-zinc-400 bg-zinc-500/10 border-zinc-500/20";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
      {confidence}% match
    </span>
  );
}

function ContactCard({ contact, isKeep }: { contact: DedupCluster["contacts"][0]; isKeep?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${isKeep ? "border-emerald-500/30 bg-emerald-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
      {isKeep && (
        <div className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Keep this record
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{contact.name}</p>
          {contact.email && <p className="text-xs text-muted-foreground truncate">{contact.email}</p>}
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {contact.title && (
          <p className="text-xs text-muted-foreground"><span className="text-zinc-500">Title:</span> {contact.title}</p>
        )}
        {contact.organization && (
          <p className="text-xs text-muted-foreground"><span className="text-zinc-500">Org:</span> {contact.organization}</p>
        )}
        {contact.phone && (
          <p className="text-xs text-muted-foreground"><span className="text-zinc-500">Phone:</span> {contact.phone}</p>
        )}
      </div>
    </div>
  );
}

export default function DedupSweep() {

  const [clusters, setClusters] = useState<DedupCluster[] | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [totalScanned, setTotalScanned] = useState(0);

  const scanMutation = trpc.dedup.scan.useMutation({
    onSuccess: (data) => {
      setClusters(data.clusters as DedupCluster[]);
      setTotalScanned(data.totalScanned);
      setDismissed(new Set());
    },
  });

  const mergeMutation = trpc.dedup.merge.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Contacts merged — records have been combined successfully.");
      // Remove this cluster from the list
      setClusters(prev => prev?.filter(c =>
        !(c.contacts.some(ct => ct.id === vars.keepId) && c.contacts.some(ct => ct.id === vars.mergeId))
      ) || null);
    },
    onError: (err) => {
      toast.error(`Merge failed: ${err.message}`);
    },
  });

  const dismissMutation = trpc.dedup.dismiss.useMutation({
    onSuccess: (_, vars) => {
      const key = `${vars.contactAId}-${vars.contactBId}`;
      setDismissed(prev => new Set([...prev, key]));
      toast.success("Dismissed — this pair has been marked as not a duplicate.");
    },
  });

  const activeClusters = clusters?.filter(c => {
    const key = `${c.contacts[0].id}-${c.contacts[1].id}`;
    return !dismissed.has(key);
  }) || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Deduplication Sweep</h1>
            <p className="text-sm text-muted-foreground">Scan approved contacts for potential duplicates</p>
          </div>
        </div>

        {/* Scan Button */}
        <div className="mt-8 mb-8">
          {clusters === null ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-xl">
              <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-30" />
              <p className="text-lg text-muted-foreground mb-2">No scan results yet</p>
              <p className="text-sm text-muted-foreground mb-6">Run a scan to find potential duplicate contacts in your approved records.</p>
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-black font-medium rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {scanMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
                ) : (
                  <><Search className="w-4 h-4" /> Run Dedup Scan</>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-muted-foreground">
                Scanned <span className="text-foreground font-medium">{totalScanned}</span> approved contacts — found <span className="text-amber-400 font-medium">{activeClusters.length}</span> potential duplicates
              </div>
              <button
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm bg-zinc-800 text-foreground rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                {scanMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Re-scan
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        {activeClusters.length > 0 && (
          <div className="space-y-6">
            {activeClusters.map((cluster, idx) => {
              const [a, b] = cluster.contacts;
              return (
                <div key={`${a.id}-${b.id}`} className="border border-zinc-800 rounded-xl p-5 bg-zinc-900/30 hover:border-zinc-700 transition-colors">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">{cluster.reason}</span>
                      <ConfidenceBadge confidence={cluster.confidence} />
                    </div>
                    <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  </div>

                  {/* Side by side */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <ContactCard contact={a} />
                    <ContactCard contact={b} />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => dismissMutation.mutate({ contactAId: a.id, contactBId: b.id })}
                      disabled={dismissMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-zinc-800 rounded-lg hover:bg-zinc-800 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Not a duplicate
                    </button>
                    <button
                      onClick={() => mergeMutation.mutate({ keepId: a.id, mergeId: b.id })}
                      disabled={mergeMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/10 transition-colors"
                    >
                      <GitMerge className="w-3 h-3" /> Keep left, merge right
                    </button>
                    <button
                      onClick={() => mergeMutation.mutate({ keepId: b.id, mergeId: a.id })}
                      disabled={mergeMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 transition-colors"
                    >
                      <GitMerge className="w-3 h-3" /> Keep right, merge left
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {clusters !== null && activeClusters.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-400 opacity-50" />
            <p className="text-lg text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground mt-1">No potential duplicates found among your approved contacts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
