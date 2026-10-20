import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface PresenceState {
  onlineUsers: number;
  dynamicBatchSize: number;
}

export function usePresence() {
  const { user } = useAuth();
  const [presence, setPresence] = useState<PresenceState>({
    onlineUsers: 1,
    dynamicBatchSize: 2,
  });

  const updatePresence = useCallback(async (isGenerating: boolean = false) => {
    if (!user) return;

    try {
      // Upsert presence record
      const { error } = await supabase
        .from("user_presence")
        .upsert(
          {
            user_id: user.id,
            last_seen_at: new Date().toISOString(),
            is_generating: isGenerating,
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("Error updating presence:", error);
      }
    } catch (e) {
      console.error("Presence update failed:", e);
    }
  }, [user]);

  const fetchDynamicBatchSize = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("get_dynamic_batch_size");
      
      if (!error && data) {
        setPresence((prev) => ({
          ...prev,
          dynamicBatchSize: Math.max(1, Math.min(data, 10)), // Clamp between 1-10
        }));
      }
    } catch (e) {
      console.error("Failed to get dynamic batch size:", e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Initial presence update
    updatePresence();
    fetchDynamicBatchSize();

    // Heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      updatePresence();
      fetchDynamicBatchSize();
    }, 30000);

    // Realtime presence channel for counting online users
    const channel = supabase.channel("online_users");

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const count = Object.keys(state).length;
        setPresence((prev) => ({
          ...prev,
          onlineUsers: Math.max(1, count),
        }));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      channel.unsubscribe();
    };
  }, [user, updatePresence, fetchDynamicBatchSize]);

  return {
    ...presence,
    updatePresence,
    setGenerating: (isGenerating: boolean) => updatePresence(isGenerating),
  };
}
