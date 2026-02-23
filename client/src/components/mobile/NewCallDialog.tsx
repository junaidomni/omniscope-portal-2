import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Phone, Video, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";

interface NewCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewCallDialog({ open, onOpenChange }: NewCallDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  
  const { data: contactsData, isLoading } = trpc.contacts.list.useQuery({
    search: searchQuery || undefined,
    limit: 50,
  });
  
  const createDM = trpc.communications.createDM.useMutation({
    onSuccess: (data) => {
      // Start call immediately after creating/finding DM
      startCallMutation.mutate({
        channelId: data.channelId,
        type: callType!,
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create conversation");
    },
  });
  
  const startCallMutation = trpc.communications.startCall.useMutation({
    onSuccess: (data) => {
      toast.success("Call started");
      onOpenChange(false);
      setLocation(`/mobile/chat/${data.call.channelId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start call");
    },
  });
  
  const [callType, setCallType] = useState<"voice" | "video" | null>(null);
  
  const handleStartCall = (contactId: number, type: "voice" | "video") => {
    setCallType(type);
    createDM.mutate({ recipientId: contactId });
  };
  
  const contacts = contactsData?.contacts || [];
  const filteredContacts = searchQuery
    ? contacts.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-none">
          <DialogTitle>New Call</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            
            {!isLoading && filteredContacts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No contacts found" : "No contacts available"}
              </div>
            )}
            
            {filteredContacts.map((contact) => {
              const initials = contact.name
                .split(" ")
                .map(n => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              
              return (
                <div
                  key={contact.id}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <Avatar className="h-10 w-10 flex-none">
                    <AvatarFallback className="bg-[#D4AF37]/20 text-[#D4AF37]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{contact.name}</div>
                    {contact.email && (
                      <div className="text-sm text-muted-foreground truncate">
                        {contact.email}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 flex-none">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartCall(contact.id, "voice")}
                      disabled={createDM.isPending || startCallMutation.isPending}
                      className="h-8 w-8 p-0"
                    >
                      {createDM.isPending && callType === "voice" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartCall(contact.id, "video")}
                      disabled={createDM.isPending || startCallMutation.isPending}
                      className="h-8 w-8 p-0"
                    >
                      {createDM.isPending && callType === "video" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Video className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
