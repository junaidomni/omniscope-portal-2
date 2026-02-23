import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Search, User, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface NewDMDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewDMDialog({ open, onOpenChange }: NewDMDialogProps) {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  // Load platform users with search
  const { data: users, isLoading } = trpc.users.list.useQuery(
    { search, limit: 50 },
    { enabled: open }
  );
  
  // Get current user to filter out from list
  const { data: currentUser } = trpc.auth.me.useQuery();
  const filteredUsers = users?.filter(u => u.id !== currentUser?.id) || [];

  // Create DM mutation
  const createDM = trpc.communications.createDM.useMutation({
    onSuccess: (data) => {
      toast.success("DM created");
      onOpenChange(false);
      setLocation(`/mobile/chat/${data.channelId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create DM");
    },
  });

  const handleSelectUser = (userId: number) => {
    createDM.mutate({ recipientId: userId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-none">
          <DialogTitle>New Direct Message</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Contact List */}
          <div className="flex-1 min-h-0 space-y-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoading && filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            )}

            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                disabled={createDM.isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{user.name || 'Unknown User'}</div>
                  {user.email && (
                    <div className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </div>
                  )}
                </div>
                {createDM.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
