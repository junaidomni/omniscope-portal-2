import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DealRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (channelId: number) => void;
}

export function DealRoomDialog({ open, onOpenChange, onSuccess }: DealRoomDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();

  const createDealRoomMutation = trpc.communications.createDealRoom.useMutation({
    onSuccess: (data) => {
      toast.success("Deal Room Created", {
        description: "Your deal room has been created successfully.",
      });
      utils.communications.listChannels.invalidate();
      onSuccess?.(data.channelId);
      handleClose();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to create deal room",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Validation Error", {
        description: "Please enter a room name",
      });
      return;
    }

    createDealRoomMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      vertical: "general", // Default vertical since user doesn't select
    });
  };

  const handleClose = () => {
    setName("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Deal Room</DialogTitle>
            <DialogDescription>
              Create a private, invite-only channel for external parties to collaborate on deals.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Room Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Dubai Gold Transaction Q1 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={createDealRoomMutation.isPending}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the deal or transaction"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={createDealRoomMutation.isPending}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createDealRoomMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createDealRoomMutation.isPending}>
              {createDealRoomMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Deal Room
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
