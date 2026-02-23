import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, Volume2, Check } from "lucide-react";

interface NotificationPreferences {
  callNotifications: boolean;
  soundVolume: number;
  deliveryMethod: "browser" | "in-app" | "both";
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  callNotifications: true,
  soundVolume: 80,
  deliveryMethod: "both",
};

export function NotificationSettings() {
  const { data: user } = trpc.auth.me.useQuery();
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);

  // Load preferences from user profile
  useEffect(() => {
    if (user?.notificationPreferences) {
      try {
        const parsed = JSON.parse(user.notificationPreferences);
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      } catch (error) {
        console.error("Failed to parse notification preferences:", error);
      }
    }
  }, [user]);

  const updatePreferencesMutation = trpc.auth.updateNotificationPreferences.useMutation({
    onSuccess: () => {
      toast.success("Notification preferences saved");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save preferences");
    },
  });

  const handleSave = () => {
    updatePreferencesMutation.mutate(preferences);
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Notification Settings</h2>
        <p className="text-muted-foreground">
          Manage how you receive notifications for calls and messages
        </p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Call Notifications Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="call-notifications" className="text-base font-medium">
                Call Notifications
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Receive notifications when someone starts a call in your channels
            </p>
          </div>
          <Switch
            id="call-notifications"
            checked={preferences.callNotifications}
            onCheckedChange={(checked) => updatePreference("callNotifications", checked)}
          />
        </div>

        {/* Sound Volume Slider */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="sound-volume" className="text-base font-medium">
              Notification Sound Volume
            </Label>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              id="sound-volume"
              value={[preferences.soundVolume]}
              onValueChange={([value]) => updatePreference("soundVolume", value)}
              max={100}
              step={5}
              className="flex-1"
              disabled={!preferences.callNotifications}
            />
            <span className="text-sm text-muted-foreground w-12 text-right">
              {preferences.soundVolume}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Adjust the volume of notification sounds
          </p>
        </div>

        {/* Delivery Method */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Notification Delivery</Label>
          <RadioGroup
            value={preferences.deliveryMethod}
            onValueChange={(value) =>
              updatePreference("deliveryMethod", value as NotificationPreferences["deliveryMethod"])
            }
            disabled={!preferences.callNotifications}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="browser" id="browser" />
              <Label htmlFor="browser" className="font-normal cursor-pointer">
                Browser notifications only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="in-app" id="in-app" />
              <Label htmlFor="in-app" className="font-normal cursor-pointer">
                In-app banners only
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="font-normal cursor-pointer">
                Both browser and in-app notifications
              </Label>
            </div>
          </RadioGroup>
          <p className="text-sm text-muted-foreground">
            Choose how you want to receive call notifications
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updatePreferencesMutation.isPending}
          >
            {updatePreferencesMutation.isPending ? (
              "Saving..."
            ) : hasChanges ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </>
            ) : (
              "No Changes"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}
