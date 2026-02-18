import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  Mail, Inbox, Star, ChevronLeft, Loader2, BarChart3,
  TrendingUp, Users, Globe, Paperclip, Eye, ArrowUpRight,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
  CartesianGrid, Legend,
} from "recharts";

// ============================================================================
// STAR CONFIG (mirrored from MailModule)
// ============================================================================

const STAR_CONFIG: Record<number, { label: string; color: string; chartColor: string }> = {
  1: { label: "Reply Today", color: "text-yellow-500", chartColor: "#eab308" },
  2: { label: "Delegate", color: "text-orange-500", chartColor: "#f97316" },
  3: { label: "Critical", color: "text-red-500", chartColor: "#ef4444" },
};

// ============================================================================
// METRIC CARD
// ============================================================================

function MetricCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{label}</span>
        <Icon className={`h-4 w-4 ${accent || "text-zinc-700"}`} />
      </div>
      <div className={`text-2xl font-bold ${accent || "text-white"} tabular-nums`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-600 mt-1">{sub}</div>}
    </div>
  );
}

// ============================================================================
// CUSTOM TOOLTIP
// ============================================================================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 shadow-xl">
      <div className="text-[11px] text-zinc-400 mb-1">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-zinc-300">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN ANALYTICS PAGE
// ============================================================================

export default function MailAnalytics() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const analyticsQuery = trpc.mail.analytics.useQuery();
  const data = analyticsQuery.data;

  // Pie chart colors
  const PIE_COLORS = ["#eab308", "#f97316", "#ef4444", "#3b82f6", "#8b5cf6", "#6b7280"];

  // Star pie data
  const starPieData = useMemo(() => {
    if (!data?.starDistribution) return [];
    return [1, 2, 3]
      .filter((level) => (data.starDistribution as Record<number, number>)[level] > 0)
      .map((level) => ({
        name: STAR_CONFIG[level].label,
        value: (data.starDistribution as Record<number, number>)[level],
        color: STAR_CONFIG[level].chartColor,
      }));
  }, [data?.starDistribution]);

  // Domain pie data
  const domainPieData = useMemo(() => {
    if (!data?.topDomains) return [];
    return data.topDomains.slice(0, 6).map((d: any, i: number) => ({
      name: d.domain,
      value: d.count,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [data?.topDomains]);

  if (analyticsQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <Loader2 className="h-6 w-6 animate-spin text-yellow-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <div className="text-center">
          <BarChart3 className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">No email data available</p>
          <p className="text-[11px] text-zinc-600 mt-1">Connect Gmail and sync emails to see analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh)] flex flex-col bg-black overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800/80 flex items-center gap-3 px-4 bg-black/95 backdrop-blur flex-shrink-0">
        <button
          onClick={() => navigate("/mail")}
          className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <BarChart3 className="h-4 w-4 text-yellow-600" />
        <span className="text-sm font-medium text-white">Mail Analytics</span>
        <span className="text-[10px] text-zinc-600 bg-zinc-800/60 rounded px-2 py-0.5">
          {data.totalMessages} messages analyzed
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

          {/* ── METRIC CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Total Threads"
              value={data.totalThreads}
              icon={Mail}
              accent="text-yellow-500"
            />
            <MetricCard
              label="Total Messages"
              value={data.totalMessages}
              icon={Inbox}
            />
            <MetricCard
              label="Unread"
              value={data.unreadCount}
              sub={data.totalMessages > 0 ? `${Math.round((data.unreadCount / data.totalMessages) * 100)}% of total` : undefined}
              icon={Eye}
              accent="text-blue-500"
            />
            <MetricCard
              label="Last 7 Days"
              value={data.last7DaysCount}
              icon={TrendingUp}
              accent="text-emerald-500"
            />
            <MetricCard
              label="Starred"
              value={data.totalStarred}
              icon={Star}
              accent="text-yellow-500"
            />
            <MetricCard
              label="Attachments"
              value={`${data.attachmentRate}%`}
              sub={`${data.withAttachments} emails`}
              icon={Paperclip}
            />
          </div>

          {/* ── DAILY VOLUME CHART ── */}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Email Volume</h3>
                <p className="text-[11px] text-zinc-600 mt-0.5">Last 14 days — received vs sent</p>
              </div>
              <div className="flex items-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-yellow-600" />
                  <span className="text-zinc-500">Received</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm bg-zinc-600" />
                  <span className="text-zinc-500">Sent</span>
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.dailyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  tickFormatter={(d: string) => {
                    const date = new Date(d + "T00:00:00");
                    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                  axisLine={{ stroke: "#27272a" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <RechartsTooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="received"
                  name="Received"
                  stroke="#ca8a04"
                  fill="#ca8a04"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  name="Sent"
                  stroke="#52525b"
                  fill="#52525b"
                  fillOpacity={0.1}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* ── STAR DISTRIBUTION + TOP DOMAINS ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Star Distribution */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Star Priority Distribution</h3>
              <p className="text-[11px] text-zinc-600 mb-4">{data.totalStarred} threads prioritized</p>
              {starPieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={starPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {starPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2">
                    {starPieData.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-[11px] text-zinc-400">{entry.name}</span>
                        <span className="text-[11px] text-white font-semibold ml-auto">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-zinc-700 text-xs">
                  No starred threads yet
                </div>
              )}
            </div>

            {/* Top Domains */}
            <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Top Sender Domains</h3>
              <p className="text-[11px] text-zinc-600 mb-4">Most active email domains</p>
              {domainPieData.length > 0 ? (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie
                        data={domainPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={60}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {domainPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1 min-w-0">
                    {domainPieData.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                        <span className="text-[11px] text-zinc-400 truncate">{entry.name}</span>
                        <span className="text-[11px] text-white font-semibold ml-auto flex-shrink-0">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-zinc-700 text-xs">
                  No domain data available
                </div>
              )}
            </div>
          </div>

          {/* ── TOP SENDERS TABLE ── */}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Top Senders</h3>
                <p className="text-[11px] text-zinc-600 mt-0.5">Most frequent email senders</p>
              </div>
              <Users className="h-4 w-4 text-zinc-700" />
            </div>
            {data.topSenders.length > 0 ? (
              <div className="space-y-0">
                {/* Header */}
                <div className="flex items-center gap-3 px-3 py-2 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest border-b border-zinc-800/40">
                  <span className="w-6 text-center">#</span>
                  <span className="flex-1">Sender</span>
                  <span className="w-16 text-right">Emails</span>
                  <span className="w-24 text-right">Share</span>
                </div>
                {data.topSenders.map((sender: any, i: number) => {
                  const pct = data.totalMessages > 0
                    ? Math.round((sender.count / data.totalMessages) * 100)
                    : 0;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/30 transition-colors"
                    >
                      <span className="w-6 text-center text-[11px] text-zinc-600 tabular-nums">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] text-zinc-300 truncate">{sender.name}</div>
                        <div className="text-[10px] text-zinc-600 truncate">{sender.email}</div>
                      </div>
                      <span className="w-16 text-right text-[12px] text-white font-semibold tabular-nums">{sender.count}</span>
                      <div className="w-24 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-600 rounded-full"
                            style={{ width: `${Math.min(pct * 2, 100)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-500 tabular-nums w-8 text-right">{pct}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-zinc-700 text-xs">
                No sender data available
              </div>
            )}
          </div>

          {/* ── TOP DOMAINS BAR CHART ── */}
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Domain Distribution</h3>
                <p className="text-[11px] text-zinc-600 mt-0.5">Email volume by sender domain</p>
              </div>
              <Globe className="h-4 w-4 text-zinc-700" />
            </div>
            {data.topDomains.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.topDomains.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="domain"
                    tick={{ fill: "#a1a1aa", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                  />
                  <RechartsTooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Emails" fill="#ca8a04" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-32 text-zinc-700 text-xs">
                No domain data available
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
