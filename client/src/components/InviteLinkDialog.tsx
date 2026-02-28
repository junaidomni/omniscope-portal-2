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
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface InviteLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: number;
  channelName: string;
}

export function InviteLinkDialog({ open, onOpenChange, channelId, channelName }: InviteLinkDialogProps) {
  const [expiresInDays, setExpiresInDays] = useState<string>("7");
  const [maxUses, setMaxUses] = useState<string>("");
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);


  const createInviteMutation = trpc.communications.createInviteLink.useMutation({
    onSuccess: (data) => {
      setInviteUrl(data.inviteUrl);
      toast({
        title: "Invite Link Generated",
        description: "Share this link with external parties to join the deal room.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate invite link",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    createInviteMutation.mutate({
      channelId,
      expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      origin: window.location.origin,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Invite link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    setInviteUrl("");
    setExpiresInDays("7");
    setMaxUses("");
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Invite Link</DialogTitle>
          <DialogDescription>
            Create a secure invite link for <strong>{channelName}</strong>
          </DialogDescription>
        </DialogHeader>

        {!inviteUrl ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="expiresInDays">Expires In (Days)</Label>
                <Input
                  id="expiresInDays"
                  type="number"
                  placeholder="7 (leave empty for no expiry)"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  disabled={createInviteMutation.isPending}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for a link that never expires
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxUses">Maximum Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  disabled={createInviteMutation.isPending}
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for unlimited uses
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={createInviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={createInviteMutation.isPending}>
                {createInviteMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Generate Link
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Invite Link</Label>
                <div className="flex gap-2">
                  <Input
                    value={inviteUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expiresInDays
                    ? `Expires in ${expiresInDays} days`
                    : "Never expires"}
                  {maxUses ? ` • Max ${maxUses} uses` : " • Unlimited uses"}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
