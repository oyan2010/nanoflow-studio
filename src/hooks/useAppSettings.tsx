import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  batch_mode: "dynamic" | "fixed";
  fixed_batch_size: number;
  instant_batch_pro: number;
  instant_batch_ultra: number;
  scheduled_batch_size: number;
  pro_price: number;
  ultra_price: number;
  max_retry_attempts: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  batch_mode: "dynamic",
  fixed_batch_size: 2,
  instant_batch_pro: 1,
  instant_batch_ultra: 2,
  scheduled_batch_size: 5,
  pro_price: 1999,
  ultra_price: 2899,
  max_retry_attempts: 3,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      // Use raw query to avoid type issues with new table
      const { data, error } = await supabase
        .from("app_settings" as any)
        .select("key, value");

      if (error) throw error;

      if (data) {
        const settingsMap: Partial<AppSettings> = {};
        (data as any[]).forEach((row: { key: string; value: any }) => {
          const key = row.key as keyof AppSettings;
          let value = row.value;
          // Handle string-encoded JSON
          if (typeof value === "string") {
            try {
              value = JSON.parse(value);
            } catch {
              // Keep as string if not valid JSON
            }
          }
          (settingsMap as any)[key] = value;
        });
        setSettings({ ...DEFAULT_SETTINGS, ...settingsMap });
      }
    } catch (error) {
      console.error("Error loading app settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    try {
      const { error } = await supabase
        .from("app_settings" as any)
        .upsert({
          key,
          value: JSON.stringify(value),
          updated_at: new Date().toISOString()
        } as any, { onConflict: "key" });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, [key]: value }));
      return true;
    } catch (error) {
      console.error("Error updating setting:", error);
      return false;
    }
  };

  const updateMultipleSettings = async (updates: Partial<AppSettings>) => {
    try {
      const upserts = Object.entries(updates).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("app_settings" as any)
        .upsert(upserts as any, { onConflict: "key" });

      if (error) throw error;

      setSettings((prev) => ({ ...prev, ...updates }));
      return true;
    } catch (error) {
      console.error("Error updating settings:", error);
      return false;
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    isLoading,
    loadSettings,
    updateSetting,
    updateMultipleSettings,
  };
}
