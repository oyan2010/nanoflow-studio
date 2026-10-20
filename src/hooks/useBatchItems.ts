import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface BatchItem {
    id: string;
    batch_id: string;
    prompt: string;
    status: string;
    video_url: string | null;
    error_message: string | null;
    created_at: string;
    updated_at?: string | null;
}

export function useBatchItems(batchId: string | null) {
    const [items, setItems] = useState<BatchItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [channel, setChannel] = useState<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!batchId) {
            setItems([]);
            if (channel) {
                channel.unsubscribe();
                setChannel(null);
            }
            return;
        }

        // Load initial items
        loadItems();

        // Subscribe to real-time updates for this batch
        const itemsChannel = supabase
            .channel(`batch-items-${batchId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'batch_items',
                    filter: `batch_id=eq.${batchId}`,
                },
                (payload) => {
                    console.log('Real-time item update:', payload);

                    if (payload.eventType === 'INSERT') {
                        setItems((prev) => [...prev, payload.new as BatchItem]);
                    } else if (payload.eventType === 'UPDATE') {
                        setItems((prev) =>
                            prev.map((item) =>
                                item.id === (payload.new as BatchItem).id
                                    ? (payload.new as BatchItem)
                                    : item
                            )
                        );

                        // Optional: Notify on individual video completion
                        const newItem = payload.new as BatchItem;
                        if (
                            newItem.status === 'completed' &&
                            newItem.video_url &&
                            Notification.permission === 'granted'
                        ) {
                            // Uncomment if you want per-video notifications
                            // new Notification('Video Ready!', {
                            //   body: newItem.prompt.slice(0, 50) + '...',
                            //   tag: newItem.id,
                            // });
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setItems((prev) =>
                            prev.filter((item) => item.id !== (payload.old as BatchItem).id)
                        );
                    }
                }
            )
            .subscribe();

        setChannel(itemsChannel);

        return () => {
            itemsChannel.unsubscribe();
        };
    }, [batchId]);


    // Implement polling fallback for items
    useEffect(() => {
        if (!batchId) return;

        // Poll every 4 seconds if items are effectively active to ensure UI stays in sync
        const pollInterval = setInterval(() => {
            if (items.some(i => ['pending', 'processing'].includes(i.status))) {
                // Background reload
                loadItems(false);
            }
        }, 4000);

        return () => clearInterval(pollInterval);
    }, [batchId, items]);

    const loadItems = async (showLoading = true) => {
        if (!batchId) return;

        if (showLoading) setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('batch_items')
                .select('*')
                .eq('batch_id', batchId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            if (data) {
                // Merge strategies? Or just replace? Replace is safer for status updates.
                setItems(data as BatchItem[]);
            }
        } catch (error) {
            console.error('Error loading batch items:', error);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    return { items, isLoading, refresh: () => loadItems(true) };
}
