import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Shield, Eye, MessageSquare, Users, Building2, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function PlatformOversight() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);

  // Fetch all organizations (platform owners can see all)
  const { data: organizations, isLoading: orgsLoading } = trpc.admin.listAllOrganizations.useQuery();

  // Fetch all channels for selected org
  const { data: channels, isLoading: channelsLoading } = trpc.admin.listOrgChannels.useQuery(
    { orgId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );

  // Fetch messages for selected channel
  const { data: messages, isLoading: messagesLoading } = trpc.admin.getChannelMessages.useQuery(
    { channelId: selectedChannelId!, limit: 100 },
    { enabled: !!selectedChannelId }
  );

  // Audit log mutation
  const logAuditMutation = trpc.admin.logOversightAction.useMutation();

  const handleViewChannel = (channelId: number, channelName: string) => {
    setSelectedChannelId(channelId);
    
    // Log audit action
    logAuditMutation.mutate({
      action: "view_channel",
      targetType: "channel",
      targetId: channelId,
      metadata: { channelName },
    });

    toast.info("Audit logged", {
      description: `Viewing channel: ${channelName}`,
    });
  };

  const filteredOrgs = organizations?.filter((org) =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-500" />
              Platform Oversight Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Compliance and audit access to all communications across workspaces
            </p>
          </div>
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Sensitive Access
          </Badge>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-6 p-6 overflow-hidden">
        {/* Organizations List */}
        <Card className="col-span-3 p-4 flex flex-col h-full">
          <div className="mb-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Organizations
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {orgsLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : filteredOrgs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No organizations found</div>
              ) : (
                filteredOrgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setSelectedOrgId(org.id);
                      setSelectedChannelId(null);
                    }}
                    className={`w-full p-3 rounded-lg text-left hover:bg-accent transition-colors ${
                      selectedOrgId === org.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="font-medium">{org.name}</div>
                    <div className="text-sm text-muted-foreground">{org.slug}</div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Channels List */}
        <Card className="col-span-3 p-4 flex flex-col h-full">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Channels
          </h2>

          {!selectedOrgId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select an organization to view channels
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {channelsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : channels && channels.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No channels found</div>
                ) : (
                  channels?.map((channel) => (
                    <button
                      key={channel.id}
                      onClick={() => handleViewChannel(channel.id, channel.name || "Unnamed Channel")}
                      className={`w-full p-3 rounded-lg text-left hover:bg-accent transition-colors ${
                        selectedChannelId === channel.id ? "bg-accent" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium truncate">{channel.name || "Unnamed Channel"}</div>
                        <Badge variant="outline" className="text-xs">
                          {channel.type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <Users className="h-3 w-3" />
                        {channel.memberCount || 0} members
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </Card>

        {/* Messages View */}
        <Card className="col-span-6 p-4 flex flex-col h-full">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Messages
          </h2>

          {!selectedChannelId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a channel to view messages
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-4">
                {messagesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : messages && messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No messages found</div>
                ) : (
                  messages?.map((msg) => (
                    <div key={msg.id} className="p-3 rounded-lg border border-border">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={msg.user.avatar || undefined} />
                          <AvatarFallback>
                            {msg.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className="font-medium">{msg.user.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm mt-1 whitespace-pre-wrap">{msg.content}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}
        </Card>
      </div>

      {/* Audit Warning Footer */}
      <div className="p-4 border-t border-border bg-destructive/10">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">
            All oversight actions are logged for compliance. Use this access responsibly.
          </span>
        </div>
      </div>
    </div>
  );
}
