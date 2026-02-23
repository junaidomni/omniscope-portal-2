import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Video, Search, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

interface ContactSearchCallInitiatorProps {
  onClose: () => void;
}

export function ContactSearchCallInitiator({ onClose }: ContactSearchCallInitiatorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  // Search contacts
  const { data: contacts, isLoading } = trpc.contacts.searchContacts.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.length > 0 }
  );

  // Start direct call mutation
  const startCallMutation = trpc.communications.startDirectCall.useMutation({
    onSuccess: (data) => {
      toast.success(`Starting ${data.callType} call...`);
      setLocation(`/communications?channel=${data.channelId}`);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to start call");
    },
  });

  const handleStartCall = (contactId: number, callType: "voice" | "video") => {
    startCallMutation.mutate({ contactId, callType });
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Start a call with...</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          autoFocus
        />
      </div>

      <ScrollArea className="h-64">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && searchQuery && contacts && contacts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No contacts found
          </div>
        )}

        {!searchQuery && (
          <div className="text-center py-8 text-muted-foreground">
            Type to search for contacts
          </div>
        )}

        {contacts && contacts.length > 0 && (
          <div className="space-y-2">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={contact.photoUrl || undefined} />
                    <AvatarFallback>
                      {contact.name?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    {contact.email && (
                      <p className="text-sm text-muted-foreground">{contact.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartCall(contact.id, "voice")}
                    disabled={startCallMutation.isPending}
                    className="gap-1"
                  >
                    <Phone className="h-4 w-4" />
                    Voice
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStartCall(contact.id, "video")}
                    disabled={startCallMutation.isPending}
                    className="gap-1"
                  >
                    <Video className="h-4 w-4" />
                    Video
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
