import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface DirectInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: number;
  channelName: string;
}

export function DirectInviteDialog({
  open,
  onOpenChange,
  channelId,
  channelName,
}: DirectInviteDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  // Fetch all users in the organization
  const { data: users, isLoading: usersLoading } = trpc.team.listMembers.useQuery(
    undefined,
    { enabled: open }
  );

  // Fetch current channel members to exclude them
  const { data: channelDetails } = trpc.communications.getChannelDetails.useQuery(
    { channelId },
    { enabled: open }
  );

  const inviteUsersMutation = trpc.communications.inviteUsers.useMutation({
    onSuccess: (data) => {
      toast.success(`Invited ${data.invited} of ${data.total} users`);
      utils.communications.getChannelDetails.invalidate({ channelId });
      utils.communications.listChannels.invalidate();
      onOpenChange(false);
      setSelectedUserIds(new Set());
      setSearchQuery("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to invite users");
    },
  });

  // Filter out users who are already members
  const existingMemberIds = new Set(channelDetails?.members.map((m) => m.userId) || []);
  const availableUsers = users?.filter((u) => !existingMemberIds.has(u.id)) || [];

  // Filter by search query
  const filteredUsers = availableUsers.filter((u) =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const handleInvite = () => {
    if (selectedUserIds.size === 0) {
      toast.error("Please select at least one user");
      return;
    }

    inviteUsersMutation.mutate({
      channelId,
      userIds: Array.from(selectedUserIds),
      role: "member",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Users to {channelName}</DialogTitle>
          <DialogDescription>
            Select internal users to add to this channel. They will be able to view and send messages immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* User List */}
          <ScrollArea className="h-[300px] border rounded-lg">
            {usersLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <UserPlus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "No users found" : "All users are already members"}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className="w-full p-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
                  >
                    <Checkbox
                      checked={selectedUserIds.has(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatar || undefined} />
                      <AvatarFallback>
                        {user.name?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{user.name || "Unnamed User"}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                    {user.role === "admin" && (
                      <Badge variant="outline" className="text-xs">
                        Admin
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected Count */}
          {selectedUserIds.size > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedUserIds.size} user{selectedUserIds.size !== 1 ? "s" : ""} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUserIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={selectedUserIds.size === 0 || inviteUsersMutation.isPending}
            >
              {inviteUsersMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Inviting...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite {selectedUserIds.size > 0 ? `(${selectedUserIds.size})` : ""}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
