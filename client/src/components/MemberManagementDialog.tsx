import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserMinus, Crown, Shield, User, UserCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface Member {
  id: number;
  userId: number;
  role: "owner" | "admin" | "member" | "guest";
  joinedAt: number;
  user: {
    id: number;
    name: string;
    email: string;
    avatar?: string | null;
  };
}

interface MemberManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: number;
  channelName: string;
  members: Member[];
  currentUserRole: "owner" | "admin" | "member" | "guest";
}

export function MemberManagementDialog({
  open,
  onOpenChange,
  channelId,
  channelName,
  members,
  currentUserRole,
}: MemberManagementDialogProps) {
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const utils = trpc.useUtils();

  const changeRoleMutation = trpc.communications.changeMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Member role updated successfully");
      utils.communications.getChannel.invalidate({ channelId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update member role");
    },
  });

  const removeMemberMutation = trpc.communications.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed successfully");
      utils.communications.getChannel.invalidate({ channelId });
      setMemberToRemove(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  const handleRoleChange = (userId: number, newRole: "owner" | "admin" | "member" | "guest") => {
    changeRoleMutation.mutate({
      channelId,
      userId,
      newRole,
    });
  };

  const handleRemoveMember = () => {
    if (!memberToRemove) return;
    removeMemberMutation.mutate({
      channelId,
      userId: memberToRemove.userId,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-amber-500" />;
      case "admin":
        return <Shield className="h-4 w-4 text-blue-500" />;
      case "guest":
        return <UserCheck className="h-4 w-4 text-purple-500" />;
      default:
        return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      default:
        return "outline";
    }
  };

  const canManageMembers = currentUserRole === "owner" || currentUserRole === "admin";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manage Members - {channelName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[500px] overflow-y-auto">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user.avatar || undefined} />
                    <AvatarFallback>
                      {member.user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{member.user.name}</p>
                      <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.user.email}</p>
                  </div>
                </div>

                {canManageMembers && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={member.role}
                      onValueChange={(value) =>
                        handleRoleChange(member.userId, value as "owner" | "admin" | "member" | "guest")
                      }
                      disabled={changeRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="guest">Guest</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setMemberToRemove(member)}
                      disabled={removeMemberMutation.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}

            {members.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No members found</div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{memberToRemove?.user.name}</strong> from this channel?
              They will lose access to all messages and sub-channels.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
