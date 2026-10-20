import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings, Save, Zap, Clock, RefreshCw } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

export function GenerationSettingsCard() {
  const { settings, isLoading, updateMultipleSettings, loadSettings } = useAppSettings();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formValues, setFormValues] = useState({
    batch_mode: settings.batch_mode,
    fixed_batch_size: settings.fixed_batch_size,
    instant_batch_pro: settings.instant_batch_pro,
    instant_batch_ultra: settings.instant_batch_ultra,
    scheduled_batch_size: settings.scheduled_batch_size,
    max_retry_attempts: settings.max_retry_attempts,
    pro_price: settings.pro_price,
    ultra_price: settings.ultra_price,
  });

  useEffect(() => {
    setFormValues({
      batch_mode: settings.batch_mode,
      fixed_batch_size: settings.fixed_batch_size,
      instant_batch_pro: settings.instant_batch_pro,
      instant_batch_ultra: settings.instant_batch_ultra,
      scheduled_batch_size: settings.scheduled_batch_size,
      max_retry_attempts: settings.max_retry_attempts,
      pro_price: settings.pro_price,
      ultra_price: settings.ultra_price,
    });
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    const success = await updateMultipleSettings(formValues);
    setIsSaving(false);
    
    if (success) {
      toast.success("Settings saved successfully");
    } else {
      toast.error("Failed to save settings");
    }
  };

  if (isLoading) {
    return (
      <Card className="glass p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="glass p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Generation Settings</h3>
            <p className="text-sm text-muted-foreground">Configure batch processing behavior</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={loadSettings}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Batch Mode Toggle */}
      <div className="p-4 rounded-lg bg-muted/50 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-medium">Batch Mode</Label>
            <p className="text-xs text-muted-foreground">
              {formValues.batch_mode === "dynamic" 
                ? "Automatically adjusts based on server load" 
                : "Uses fixed batch size for all users"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs ${formValues.batch_mode === "dynamic" ? "text-primary font-medium" : "text-muted-foreground"}`}>
              Dynamic
            </span>
            <Switch
              checked={formValues.batch_mode === "fixed"}
              onCheckedChange={(checked) => 
                setFormValues((prev) => ({ ...prev, batch_mode: checked ? "fixed" : "dynamic" }))
              }
            />
            <span className={`text-xs ${formValues.batch_mode === "fixed" ? "text-primary font-medium" : "text-muted-foreground"}`}>
              Fixed
            </span>
          </div>
        </div>

        {formValues.batch_mode === "fixed" && (
          <div className="space-y-2">
            <Label htmlFor="fixed_batch_size">Fixed Batch Size</Label>
            <Input
              id="fixed_batch_size"
              type="number"
              min={1}
              max={10}
              value={formValues.fixed_batch_size}
              onChange={(e) => setFormValues((prev) => ({ ...prev, fixed_batch_size: parseInt(e.target.value) || 2 }))}
              className="rounded-xl"
            />
          </div>
        )}
      </div>

      {/* Instant Mode Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-chart-4" />
          <Label className="font-medium">Instant Mode (Wait for Results)</Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="instant_batch_pro">Pro Users (concurrent)</Label>
            <Input
              id="instant_batch_pro"
              type="number"
              min={1}
              max={5}
              value={formValues.instant_batch_pro}
              onChange={(e) => setFormValues((prev) => ({ ...prev, instant_batch_pro: parseInt(e.target.value) || 1 }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="instant_batch_ultra">Ultra Users (concurrent)</Label>
            <Input
              id="instant_batch_ultra"
              type="number"
              min={1}
              max={5}
              value={formValues.instant_batch_ultra}
              onChange={(e) => setFormValues((prev) => ({ ...prev, instant_batch_ultra: parseInt(e.target.value) || 2 }))}
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Scheduled Mode Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-chart-2" />
          <Label className="font-medium">Scheduled Mode (Background)</Label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scheduled_batch_size">Concurrent Videos</Label>
            <Input
              id="scheduled_batch_size"
              type="number"
              min={2}
              max={10}
              value={formValues.scheduled_batch_size}
              onChange={(e) => setFormValues((prev) => ({ ...prev, scheduled_batch_size: parseInt(e.target.value) || 5 }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_retry_attempts">Max Retry Attempts</Label>
            <Input
              id="max_retry_attempts"
              type="number"
              min={1}
              max={5}
              value={formValues.max_retry_attempts}
              onChange={(e) => setFormValues((prev) => ({ ...prev, max_retry_attempts: parseInt(e.target.value) || 3 }))}
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Pricing Settings */}
      <div className="space-y-4">
        <Label className="font-medium">Plan Pricing (PKR)</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="pro_price">Pro Plan</Label>
            <Input
              id="pro_price"
              type="number"
              min={0}
              value={formValues.pro_price}
              onChange={(e) => setFormValues((prev) => ({ ...prev, pro_price: parseInt(e.target.value) || 1600 }))}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ultra_price">Ultra Plan</Label>
            <Input
              id="ultra_price"
              type="number"
              min={0}
              value={formValues.ultra_price}
              onChange={(e) => setFormValues((prev) => ({ ...prev, ultra_price: parseInt(e.target.value) || 2199 }))}
              className="rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button 
        variant="hero" 
        className="w-full gap-2" 
        onClick={handleSave}
        disabled={isSaving}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Save Settings
      </Button>
    </Card>
  );
}
