import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { GenerationRequest } from './flow.service.js';

export interface Task extends GenerationRequest {
  id: string;
  status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
  scheduled?: boolean;       // true = scheduled/bulk job, false/undefined = instant
  userId?: string;           // Supabase user ID who submitted this task
  plan?: string;             // User's plan (for priority routing)
  createdAt: string;
  updatedAt: string;
  error?: string;
  resultUrl?: string;        // Public URL of the generated file (if uploaded)
}

export class DBService {
  private dbPath = path.resolve('tasks.json');

  constructor() {
    if (!fs.existsSync(this.dbPath)) {
      fs.writeFileSync(this.dbPath, JSON.stringify([], null, 2));
    }
  }

  async getAllTasks(): Promise<Task[]> {
    try {
      const data = fs.readFileSync(this.dbPath, 'utf-8');
      return JSON.parse(data) as Task[];
    } catch {
      return [];
    }
  }

  async createTask(request: GenerationRequest & Partial<Task>): Promise<Task> {
    const tasks = await this.getAllTasks();
    const newTask: Task = {
      ...request,
      id: uuidv4(),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tasks.push(newTask);
    this.saveTasks(tasks);
    return newTask;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const tasks = await this.getAllTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = {
        ...tasks[index]!,
        ...updates,
        id,
        updatedAt: new Date().toISOString(),
      } as Task;
      this.saveTasks(tasks);
    }
  }

  async deleteOldCompleted(olderThanHours = 48): Promise<number> {
    const tasks = await this.getAllTasks();
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    const filtered = tasks.filter(t => {
      if (t.status === 'COMPLETED' || t.status === 'FAILED') {
        return new Date(t.updatedAt).getTime() > cutoff;
      }
      return true;
    });
    const removed = tasks.length - filtered.length;
    if (removed > 0) {
      this.saveTasks(filtered);
      console.log(`[DB] Cleaned up ${removed} old tasks`);
    }
    return removed;
  }

  private saveTasks(tasks: Task[]): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(tasks, null, 2));
  }
}
