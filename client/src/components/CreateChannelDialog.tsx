import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Users, Briefcase, Search, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type ChannelType = "dm" | "group" | "deal_room";

interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChannelCreated?: (channelId: number) => void;
}

export function CreateChannelDialog({ open, onOpenChange, onChannelCreated }: CreateChannelDialogProps) {
  const [step, setStep] = useState<"select" | "create">("select");
  const [selectedType, setSelectedType] = useState<ChannelType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [userSearchQuery, setUserSearchQuery] = useState("");

  const utils = trpc.useUtils();

  // Fetch users for DM and group chat creation
  const { data: users, isLoading: usersLoading } = trpc.users.list.useQuery(
    undefined,
    { enabled: open && (selectedType === "dm" || selectedType === "group") }
  );

  const createDealRoom = trpc.communications.createDealRoom.useMutation({
    onSuccess: (data) => {
      toast.success("Channel created successfully!");
      utils.communications.listChannels.invalidate();
      utils.communications.listDealRooms.invalidate();
      onChannelCreated?.(data.dealRoomId);
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create channel");
    },
  });

  const handleClose = () => {
    setStep("select");
    setSelectedType(null);
    setName("");
    setDescription("");
    setSelectedUserId(null);
    setSelectedUserIds(new Set());
    setUserSearchQuery("");
    onOpenChange(false);
  };

  const handleSelectType = (type: ChannelType) => {
    setSelectedType(type);
    setStep("create");
  };

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }

    if (selectedType === "deal_room") {
      createDealRoom.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        vertical: "general", // Default vertical
      });
    } else if (selectedType === "group") {
      if (selectedUserIds.size === 0) {
        toast.error("Please select at least one person");
        return;
      }
      // TODO: Implement group chat creation backend
      toast.info("Group chat creation coming soon!");
      handleClose();
    } else if (selectedType === "dm") {
      if (!selectedUserId) {
        toast.error("Please select a person");
        return;
      }
      // TODO: Implement DM creation backend
      toast.info("Direct message creation coming soon!");
      handleClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Channel</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <button
                onClick={() => handleSelectType("dm")}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-amber-500/50 hover:bg-accent/50 transition-all text-left group"
              >
                <div className="p-2 rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <MessageSquare className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Direct Message</h3>
                  <p className="text-sm text-muted-foreground">
                    Start a private 1-on-1 conversation with someone
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelectType("group")}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-amber-500/50 hover:bg-accent/50 transition-all text-left group"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Group Chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a multi-person group for team discussions
                  </p>
                </div>
              </button>

              <button
                onClick={() => handleSelectType("deal_room")}
                className="flex items-start gap-4 p-4 rounded-lg border border-border hover:border-amber-500/50 hover:bg-accent/50 transition-all text-left group"
              >
                <div className="p-2 rounded-lg bg-amber-500/10 group-hover:bg-amber-500/20 transition-colors">
                  <Briefcase className="w-6 h-6 text-amber-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-1">Channel</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a secure space for external collaboration with sub-channels
                  </p>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {selectedType === "dm" && "New Direct Message"}
                {selectedType === "group" && "New Group Chat"}
                {selectedType === "deal_room" && "New Channel"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {selectedType === "dm" || selectedType === "group" ? (
                <>
                  <div className="grid gap-2">
                    <Label>{selectedType === "dm" ? "Select a person" : "Select members"} *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-[250px] border rounded-lg">
                    {usersLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {users
                          ?.filter(
                            (u) =>
                              u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
                              u.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
                          )
                          .map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                if (selectedType === "dm") {
                                  setSelectedUserId(user.id);
                                } else {
                                  setSelectedUserIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(user.id)) {
                                      next.delete(user.id);
                                    } else {
                                      next.add(user.id);
                                    }
                                    return next;
                                  });
                                }
                              }}
                              className={`w-full p-3 rounded-lg hover:bg-accent transition-colors flex items-center gap-3 ${
                                selectedType === "dm"
                                  ? selectedUserId === user.id
                                    ? "bg-accent border-2 border-amber-500"
                                    : ""
                                  : selectedUserIds.has(user.id)
                                  ? "bg-accent border-2 border-purple-500"
                                  : ""
                              }`}
                            >
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
                            </button>
                          ))}
                      </div>
                    )}
                  </ScrollArea>
                  {/* Group name input (only for group chat) */}
                  {selectedType === "group" && (
                    <div className="grid gap-2">
                      <Label htmlFor="groupName">Group Name *</Label>
                      <Input
                        id="groupName"
                        placeholder="e.g., Marketing Team"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                  )}
                  {/* Selected count for group chat */}
                  {selectedType === "group" && selectedUserIds.size > 0 && (
                    <div className="text-sm text-muted-foreground">
                      {selectedUserIds.size} member{selectedUserIds.size !== 1 ? "s" : ""} selected
                    </div>
                  )}
                </>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    {selectedType === "deal_room" ? "Channel Name" : "Name"} *
                  </Label>
                  <Input
                    id="name"
                    placeholder={
                      selectedType === "deal_room"
                        ? "e.g., Dubai Gold Q1 2026"
                        : "e.g., Marketing Team"
                    }
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              {selectedType !== "dm" && (
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder={
                      selectedType === "deal_room"
                        ? "Describe the deal or transaction..."
                        : "Describe the purpose of this group..."
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              )}

              {selectedType === "deal_room" && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    A #general sub-channel will be automatically created inside this channel.
                    You can add more sub-channels later.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("select")}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createDealRoom.isPending || (selectedType !== "dm" && !name.trim())}
              >
                {createDealRoom.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
