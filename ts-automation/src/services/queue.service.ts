import { FlowService } from './flow.service.js';
import { ApiFlowService } from './api-flow.service.js';
import { DBService, type Task } from './db.service.js';
import { createClient } from '@supabase/supabase-js';

const MAX_SLOTS = 4;
const ANTI_THROTTLE_DELAY_MS = 8000;

type JobType = 'instant' | 'scheduled';

interface SlotState {
  id: number;
  busy: boolean;
  currentTaskId: string | null;
}

export class QueueService {
  private db = new DBService();
  private slots: SlotState[] = Array.from({ length: MAX_SLOTS }, (_, i) => ({
    id: i,
    busy: false,
    currentTaskId: null,
  }));
  private loopRunning = false;
  private inFlightTasks = new Set<string>();
  private supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
  );

  constructor(
    private flowService: FlowService,
    private apiFlowService: ApiFlowService
  ) {}

  async addTask(request: any): Promise<Task> {
    const task = await this.db.createTask(request);
    console.log(`[Queue] Task added: ${task.id}`);
    this.startLoop();
    return task;
  }

  async getTasks(): Promise<Task[]> {
    return this.db.getAllTasks();
  }

  getSlotStatus() {
    return this.slots.map(s => ({
      slot: s.id,
      busy: s.busy,
      taskId: s.currentTaskId,
    }));
  }

  private startLoop() {
    if (this.loopRunning) return;
    this.loopRunning = true;
    this.runLoop();
  }

  private async runLoop() {
    console.log('[Queue] Dispatch loop started');
    while (true) {
      const tasks = await this.db.getAllTasks();
      const pending = tasks.filter(t => t.status === 'PENDING' && !this.inFlightTasks.has(t.id));

      if (pending.length === 0) {
        await sleep(3000);
        const stillPending = (await this.db.getAllTasks()).filter(t => t.status === 'PENDING' && !this.inFlightTasks.has(t.id));
        if (stillPending.length === 0) {
          console.log('[Queue] No pending tasks — loop sleeping');
          this.loopRunning = false;
          return;
        }
        continue;
      }

      const freeSlots = this.slots.filter(s => !s.busy);
      if (freeSlots.length === 0) {
        await sleep(2000);
        continue;
      }

      for (const slot of freeSlots) {
        const tasksNow = await this.db.getAllTasks();
        const pendingNow = tasksNow.filter(t => t.status === 'PENDING' && !this.inFlightTasks.has(t.id));
        if (pendingNow.length === 0) break;

        const preferInstant = slot.id <= 1;
        const instantJobs = pendingNow.filter(t => !t.scheduled);
        const scheduledJobs = pendingNow.filter(t => !!t.scheduled);

        let task = preferInstant && instantJobs.length > 0 ? instantJobs[0] : 
                   !preferInstant && scheduledJobs.length > 0 ? scheduledJobs[0] : 
                   pendingNow[0];

        if (task) {
          this.inFlightTasks.add(task.id);
          this.assignTaskToSlot(slot, task);
        }
      }
      await sleep(1000);
    }
  }

  private assignTaskToSlot(slot: SlotState, task: Task) {
    slot.busy = true;
    slot.currentTaskId = task.id;
    console.log(`[Queue] Slot ${slot.id} → task ${task.id}`);

    this.runTask(slot, task).finally(async () => {
      this.inFlightTasks.delete(task.id);
      await sleep(ANTI_THROTTLE_DELAY_MS);
      slot.busy = false;
      slot.currentTaskId = null;
      this.startLoop();
    });
  }

  private async runTask(slot: SlotState, task: Task): Promise<void> {
    await this.db.updateTask(task.id, { status: 'GENERATING' } as Partial<Task>);
    console.log(`[Slot ${slot.id}] Starting task ${task.id}...`);

    try {
      let resultUrl: string | null = null;
      let generationId: string | null = null;

      // Try API First (No selectors needed if context exists)
      const hasApiContext = await this.apiFlowService.ensureContext(2000);
      
      if (hasApiContext) {
        console.log(`[Slot ${slot.id}] API Context ready, bypassing UI navigation.`);
        try {
          const apiResult = task.type === 'VIDEO' 
            ? await this.apiFlowService.generateVideo(task.prompt, this.mapAspectRatio(task.aspectRatio))
            : await this.apiFlowService.generateImage(task.prompt, this.mapAspectRatio(task.aspectRatio));
          
          console.log(`[Slot ${slot.id}] API Request success! Result keys:`, Object.keys(apiResult));

          if (task.type === 'IMAGE') {
            // Images might be returned synchronously
            const firstResult = apiResult.results?.[0] || apiResult;
            const mediaId = firstResult?.mediaId || firstResult?.mediaMetadata?.mediaId;
            const url = firstResult?.url || firstResult?.mediaMetadata?.url;
            
            if (url) {
              resultUrl = url;
            } else if (mediaId) {
              resultUrl = `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${mediaId}`;
            } else if (apiResult.generationId) {
               // Fallback to polling if it gave us a generationId
               resultUrl = await this.pollApiStatus(apiResult.generationId, slot.id);
            }
          } else {
             // Videos are typically async
             generationId = apiResult.generationId || apiResult.mediaId;
             if (generationId) {
               resultUrl = await this.pollApiStatus(generationId, slot.id);
             }
          }

          if (resultUrl) {
            console.log(`[Slot ${slot.id}] API successfully generated URL: ${resultUrl}`);
          }
        } catch (apiErr: any) {
          console.warn(`[Slot ${slot.id}] API Generation failed: ${apiErr.message}`);
          console.log(`[Slot ${slot.id}] Falling back to DOM automation...`);
          // Clear context to force a refresh later if needed, but for now we fallback
        }
      } else {
        console.log(`[Slot ${slot.id}] API Context not ready, falling back to DOM automation...`);
      }

      // Fallback to DOM if API failed or no context
      if (!resultUrl) {
        console.log(`[Slot ${slot.id}] Using FlowService (DOM Selectors) for task ${task.id}`);
        // Ensure project is open before trying DOM automation
        await this.flowService.ensureProjectOpen(task.projectId);
        const result = await this.flowService.generate(task);
        if (result.success) {
          resultUrl = result.downloads?.[0]?.url || null;
        } else {
          throw new Error(result.error || 'Generation failed');
        }
      }

      if (resultUrl) {
        await this.db.updateTask(task.id, {
          status: 'COMPLETED',
          resultUrl: resultUrl,
        } as Partial<Task>);

        if (task.userId) {
          await this.updateSupabaseRecord(task, resultUrl, 'success');
        }
        console.log(`[Slot ${slot.id}] Task ${task.id} completed. URL: ${resultUrl}`);
      } else {
        throw new Error('No result URL produced');
      }

    } catch (err: any) {
      await this.db.updateTask(task.id, {
        status: 'FAILED',
        error: err.message,
      } as Partial<Task>);
      if (task.userId) {
        await this.updateSupabaseRecord(task, null, 'failed', err.message);
      }
      console.error(`[Slot ${slot.id}] Task ${task.id} threw:`, err.message);
    }
  }

  private async pollApiStatus(genId: string, slotId: number): Promise<string | null> {
    const start = Date.now();
    const timeout = 180000; // 3 minutes

    while (Date.now() - start < timeout) {
      try {
        const status = await this.apiFlowService.checkStatus(genId);
        console.log(`[Slot ${slotId}] API Status: ${status.state}`);

        if (status.state === 'COMPLETE' || status.state === 'SUCCEEDED') {
          const result = status.results?.[0] || status.mediaMetadata;
          return result?.url || `https://labs.google/fx/api/trpc/media.getMediaUrlRedirect?name=${genId}`;
        }

        if (status.state === 'FAILED' || status.state === 'REJECTED') {
          throw new Error(`API reported failure state: ${status.state}`);
        }
      } catch (e) {
        console.warn(`[Slot ${slotId}] Status check error:`, e);
      }
      await sleep(5000);
    }
    return null;
  }

  private mapAspectRatio(ratio: string): string {
    if (ratio.includes('VIDEO')) return ratio;
    return ratio === '16_9' ? 'IMAGE_ASPECT_RATIO_LANDSCAPE' : 
           ratio === '9_16' ? 'IMAGE_ASPECT_RATIO_PORTRAIT' : 
           'IMAGE_ASPECT_RATIO_SQUARE';
  }

  private async updateSupabaseRecord(task: Task, url: string | null, status: string, errorMsg?: string) {
    if (!process.env.SUPABASE_URL) return;

    try {
      const { error } = await this.supabase.rpc('update_task_status_by_pc', {
        p_task_id: task.id,
        p_status: status === 'success' ? (task.scheduled ? 'completed' : 'done') : (task.scheduled ? 'failed' : 'error'),
        p_result_url: url,
        p_error_msg: errorMsg || null,
        p_is_batch: !!task.scheduled
      });

      if (error) {
        console.error('[Supabase Sync Error] RPC failed:', error);
      } else {
        console.log(`[Supabase Sync] Task ${task.id} updated successfully`);
      }
    } catch (e) {
      console.error('[Supabase Sync Error]', e);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
