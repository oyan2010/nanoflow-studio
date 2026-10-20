import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface BatchJob {
    id: string;
    status: string;
    total_items: number;
    completed_items: number;
    failed_items: number;
    created_at: string;
    completed_at: string | null;
    download_url: string | null;
}

export function useBatchRealtime(userId: string | undefined) {
    const [batches, setBatches] = useState<BatchJob[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

        // Load initial data
        loadBatches();

        // Subscribe to real-time updates
        const batchChannel = supabase
            .channel('user-batch-updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'batch_jobs',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    console.log('Real-time batch update:', payload);

                    if (payload.eventType === 'INSERT') {
                        setBatches((prev) => [payload.new as BatchJob, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setBatches((prev) =>
                            prev.map((batch) =>
                                batch.id === (payload.new as BatchJob).id
                                    ? (payload.new as BatchJob)
                                    : batch
                            )
                        );

                        // Send browser notification when batch completes
                        const newBatch = payload.new as BatchJob;
                        if (
                            newBatch.status === 'completed' &&
                            Notification.permission === 'granted'
                        ) {
                            new Notification('🎉 Batch Complete!', {
                                body: `${newBatch.completed_items} videos are ready to download!`,
                                icon: '/logo.png',
                                tag: newBatch.id,
                            });
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setBatches((prev) =>
                            prev.filter((batch) => batch.id !== (payload.old as BatchJob).id)
                        );
                    }
                }
            )
            .subscribe();

        setChannel(batchChannel);

        return () => {
            batchChannel.unsubscribe();
        };
    }, [userId]);


    // Also implement polling fallback for robustness
    useEffect(() => {
        if (!userId) return;

        // Poll every 30 seconds to catch missed realtime events
        const pollInterval = setInterval(() => {
            // Only poll if we have pending or processing items to avoid unnecessary load
            const hasPending = batches.some(b => ['pending', 'processing', 'queued'].includes(b.status));
            if (hasPending) {
                console.log("[Batch Poll] Refreshing batches via fallback poll...");
                loadBatches();
            }
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [userId, batches]);

    const loadBatches = async () => {
        if (!userId) return;

        // Don't set global loading state on background refresh
        // setIsLoading(true); 
        try {
            const { data, error } = await supabase
                .from('batch_jobs')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (data) setBatches(data as BatchJob[]);
        } catch (error) {
            console.error('Error loading batches:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return { batches, setBatches, isLoading, refresh: loadBatches };
}
