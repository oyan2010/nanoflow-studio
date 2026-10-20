import type { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import {
  SELECTORS,
  CONFIG,
  sleep,
  waitForVisible,
  clickWithFallback,
  heavyClick,
  typeText,
  closeDialogs,
  selectDropdownOption,
  getProgress,
  findFailedPrompts,
  findDownloadableResources,
  type DownloadedResource,
  type GenerationStatus,
  type FailedPrompt,
} from '../selectors.js';

export type GenerationType = 'VIDEO' | 'IMAGE';
export type AspectRatio = '16_9' | '9_16' | '1_1' | '4_3' | '3_4';
export type ResultCount = 1 | 2 | 3 | 4;

export interface ImageUpload {
  base64: string;
  name: string;
}

export interface GenerationRequest {
  type: GenerationType;
  prompt: string;
  aspectRatio: AspectRatio;
  resultCount: ResultCount;
  modelName?: string;
  images?: ImageUpload[];
  humanLike?: boolean;
  waitForCompletion?: boolean;
  downloadQuality?: 'original' | 'high' | 'low';
  outputDir?: string;
  projectId?: string;
}

export interface GenerationResult {
  success: boolean;
  status?: string;
  downloads?: DownloadedResource[];
  downloadCount?: number;
  error?: string;
  step?: string;
  failedPrompts?: FailedPrompt[];
}

export class FlowService {
  private pendingDownloads: DownloadedResource[] = [];
  
  constructor(private page: Page) {}

  /**
   * Ensures the browser is on a project page.
   * If already on a project page, it stays there.
   * Otherwise, it creates a new project.
   */
  async ensureProjectOpen(projectId?: string): Promise<void> {
    const url = this.page.url();
    
    // If we are already on a project page and no specific projectId is requested, we are good.
    if (!projectId && url.includes('/project/')) {
      console.log('[FlowService] Already in a project:', url);
      return;
    }

    // If a specific projectId is requested and we are already there, we are good.
    if (projectId && url.includes(`/project/${projectId}`)) {
      console.log('[FlowService] Already in requested project:', projectId);
      return;
    }

    let targetUrl = projectId 
      ? `https://labs.google/fx/tools/flow/project/${projectId}`
      : 'https://labs.google/fx/tools/flow';

    console.log('[FlowService] Navigating to:', targetUrl);
    await this.page.goto(targetUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
    await sleep(2000);

    // If we went to the base URL, we need to click "New project"
    if (!projectId || !this.page.url().includes('/project/')) {
      console.log('[FlowService] Looking for "New project" button...');
      const clicked = await clickWithFallback(this.page, SELECTORS.home.newProject);
      if (clicked) {
        console.log('[FlowService] Clicked "New project"');
        await sleep(3000);
      } else {
        // Check if we need to sign in
        if (await clickWithFallback(this.page, SELECTORS.home.signIn)) {
          console.log('[FlowService] Sign-in required. Please authenticate manually.');
          throw new Error('SIGN_IN_REQUIRED');
        }
      }
    }

    // Final check for editor readiness
    try {
      await waitForVisible(this.page, SELECTORS.editor.promptInput, 30000);
      console.log('[FlowService] Editor ready at:', this.page.url());
      
      // Inject protection scripts if they exist
      await this.injectProtectionScripts();
    } catch (e) {
      console.error('[FlowService] Editor failed to load. Current URL:', this.page.url());
      throw new Error('EDITOR_LOAD_FAILED');
    }
  }

  /**
   * Injects protection and automation scripts into the page
   */
  private async injectProtectionScripts(): Promise<void> {
    try {
      const scriptsDir = path.resolve(process.cwd(), 'protection_scripts');
      if (fs.existsSync(scriptsDir)) {
        const scripts = ['flow_automation.js', 'veo_content_protection.js', 'veo_persistent_lock.js'];
        for (const scriptName of scripts) {
          const scriptPath = path.join(scriptsDir, scriptName);
          if (fs.existsSync(scriptPath)) {
            const content = fs.readFileSync(scriptPath, 'utf-8');
            await this.page.addInitScript(content);
            await this.page.evaluate(content).catch(() => {});
            console.log(`[FlowService] Injected ${scriptName}`);
          }
        }
      }
    } catch (e: any) {
      console.error('[FlowService] Failed to inject protection scripts:', e.message);
    }
  }

  /**
   * Main generation method with full feature support
   */
  async generate(request: GenerationRequest): Promise<GenerationResult> {
    console.log('[FlowService] Starting generation:', request.type, request.prompt.substring(0, 50) + '...');
    
    await this.ensureProjectOpen(request.projectId);

    try {
      if (!request.waitForCompletion) {
        return await this.generateFireAndForget(request);
      }
      
      return await this.generateSequential(request);
      
    } catch (error: any) {
      console.error('[FlowService] Generation error:', error.message);
      return {
        success: false,
        error: error.message,
        step: 'unknown',
      };
    }
  }

  /**
   * Fire and forget - submit prompt and return immediately
   */
  private async generateFireAndForget(request: GenerationRequest): Promise<GenerationResult> {
    await this.configureSettings({
      type: request.type,
      aspectRatio: request.aspectRatio,
      resultCount: request.resultCount,
      modelName: request.modelName,
    });

    if (request.images && request.images.length > 0) {
      for (const img of request.images) {
        const uploadResult = await this.uploadImage(img.base64, img.name, request.aspectRatio);
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error ?? 'Upload failed', step: 'upload' };
        }
      }
    }

    if (request.prompt) {
      const submitResult = await this.submitPrompt(request.prompt, request.humanLike);
      if (!submitResult) {
        return { success: false, error: 'Failed to submit prompt', step: 'submit' };
      }
    }

    return { success: true, status: 'submitted_async' };
  }

  /**
   * Sequential - submit and wait for completion, then download
   */
  private async generateSequential(request: GenerationRequest): Promise<GenerationResult> {
    const modelName = request.modelName ?? undefined;
    await this.configureSettings({
      type: request.type,
      aspectRatio: request.aspectRatio,
      resultCount: request.resultCount,
      modelName,
    });

    if (request.images && request.images.length > 0) {
      for (const img of request.images) {
        const uploadResult = await this.uploadImage(img.base64, img.name, request.aspectRatio);
        if (!uploadResult.success) {
          return { success: false, error: uploadResult.error ?? 'Upload failed', step: 'upload' };
        }
      }
    }

    if (request.prompt) {
      const submitResult = await this.submitPrompt(request.prompt, request.humanLike);
      if (!submitResult) {
        return { success: false, error: 'Failed to submit prompt', step: 'submit' };
      }
    }

    console.log('[FlowService] Waiting for generation to complete...');
    const genStatus = await this.waitForGeneration();
    
    if (!genStatus.success) {
      return {
        success: false,
        error: `generation_${genStatus.status}`,
        step: 'generation',
      };
    }

    await sleep(2000);
    
    const resources = await this.scanForDownloads(request.prompt);
    const failedPrompts = await findFailedPrompts(this.page);
    
    return {
      success: true,
      status: 'completed',
      downloads: resources,
      downloadCount: resources.length,
      failedPrompts,
    };
  }

  /**
   * Configure settings (type, aspect ratio, result count, model)
   */
  async configureSettings(options: {
    type: GenerationType;
    aspectRatio: AspectRatio;
    resultCount: ResultCount;
    modelName?: string | undefined;
  }): Promise<void> {
    console.log('[FlowService] Configuring settings:', options);
    
    const settingsOpened = await this.openSettingsMenu();
    if (!settingsOpened) {
      console.log('[FlowService] Could not open settings, trying direct config...');
    }

    await sleep(500);

    const typeTab = options.type === 'VIDEO' ? SELECTORS.editor.videoTab : SELECTORS.editor.imageTab;
    await clickWithFallback(this.page, typeTab);
    await sleep(500);

    if (options.modelName) {
      await this.selectModel(options.modelName);
    }

    const ratioSelector = this.getRatioSelector(options.aspectRatio);
    if (ratioSelector) {
      await clickWithFallback(this.page, ratioSelector);
      await sleep(300);
    }

    const countSelector = SELECTORS.editor.resultsCount[`x${options.resultCount}` as keyof typeof SELECTORS.editor.resultsCount];
    if (countSelector) {
      console.log(`[FlowService] Selecting result count: ${options.resultCount}`);
      const clicked = await clickWithFallback(this.page, countSelector);
      if (!clicked) {
        // Try clicking by text if selector failed
        await this.page.locator(`button:has-text("${options.resultCount}")`).first().click().catch(() => {});
      }
      await sleep(300);
    }

    await closeDialogs(this.page);
  }

  /**
   * Open settings menu using tune icon
   */
  private async openSettingsMenu(): Promise<boolean> {
    const tuneButton = await findByIcon(this.page, 'tune');
    if (tuneButton) {
      await heavyClick(this.page, tuneButton);
      await sleep(700);
      return true;
    }

    return await clickWithFallback(this.page, SELECTORS.editor.settingsMenu);
  }

  /**
   * Select model from dropdown
   */
  async selectModel(modelName: string): Promise<boolean> {
    console.log('[FlowService] Selecting model:', modelName);
    
    // First, try to see if it's already selected
    const currentModel = await this.page.locator(SELECTORS.editor.modelDropdown).first().textContent().catch(() => '');
    if (currentModel?.includes(modelName)) {
      console.log('[FlowService] Model already selected:', modelName);
      return true;
    }

    const modelSelectors = [
      SELECTORS.editor.modelDropdown,
      `button:has-text("${modelName}")`,
      `button:has-text("Veo")`,
      `button:has-text("Nano")`,
      `button:has-text("Imagen")`,
    ];

    for (const selector of modelSelectors) {
      try {
        const btn = this.page.locator(selector).first();
        if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await heavyClick(this.page, btn);
          await sleep(1000); // Wait for dropdown to open
          
          const found = await selectDropdownOption(this.page, modelName);
          if (found) {
            console.log('[FlowService] Model selected via dropdown:', modelName);
            await sleep(500);
            return true;
          }
          
          // Fallback: try clicking any button with the model name that might have appeared
          const directBtn = this.page.locator(`[role="option"]:has-text("${modelName}"), button:has-text("${modelName}")`).first();
          if (await directBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            await directBtn.click();
            console.log('[FlowService] Model selected via direct click:', modelName);
            return true;
          }
        }
      } catch (e) {
        console.log('[FlowService] Model selector failed:', selector);
      }
    }

    console.log('[FlowService] Could not select model:', modelName);
    return false;
  }

  /**
   * Upload image from base64
   */
  async uploadImage(base64Data: string, fileName: string, aspectRatio?: AspectRatio): Promise<{ success: boolean; error?: string }> {
    console.log('[FlowService] Uploading image:', fileName);
    
    const addBtnVisible = await clickWithFallback(this.page, SELECTORS.editor.addImageBtn);
    if (!addBtnVisible) {
      return { success: false, error: 'Add image button not found' };
    }

    await sleep(500);

    const fileInput = this.page.locator(SELECTORS.editor.fileInput);
    if (!(await fileInput.isVisible().catch(() => false))) {
      return { success: false, error: 'File input not found' };
    }

    const buffer = this.base64ToFile(base64Data, fileName);
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'image/png',
      buffer,
    });
    await sleep(1000);

    await sleep(2000);

    if (aspectRatio) {
      const ratioSelector = this.getRatioSelector(aspectRatio);
      if (ratioSelector) {
        await clickWithFallback(this.page, ratioSelector);
        await sleep(300);
      }
    }

    const confirmBtn = await findByIcon(this.page, 'check') || await findByIcon(this.page, 'done');
    if (confirmBtn) {
      await heavyClick(this.page, confirmBtn);
      await sleep(500);
    }

    console.log('[FlowService] Image uploaded');
    return { success: true };
  }

  /**
   * Submit prompt to generate
   */
  async submitPrompt(prompt: string, humanLike = false): Promise<boolean> {
    console.log('[FlowService] Submitting prompt:', prompt.substring(0, 50) + '...');
    
    const promptInput = await waitForVisible(this.page, SELECTORS.editor.promptInput);
    await typeText(this.page, promptInput, prompt, humanLike);
    await sleep(500);

    const genBtnClicked = await clickWithFallback(this.page, SELECTORS.editor.generateBtn);
    if (!genBtnClicked) {
      console.error('[FlowService] Generate button not found');
      return false;
    }

    await sleep(1000);
    
    const error = await this.checkForSubmissionErrors();
    if (error) {
      console.error('[FlowService] Submission error:', error);
      throw new Error(error);
    }

    console.log('[FlowService] Prompt submitted successfully');
    return true;
  }

  /**
   * Check for submission errors (queue full, policy, etc.)
   */
  private async checkForSubmissionErrors(): Promise<string | null> {
    const bodyText = await this.page.locator('body').textContent() || '';
    
    if (bodyText.match(/queue.?full/i)) {
      return 'queue_full';
    }
    
    if (bodyText.match(/policy.?error/i)) {
      return 'policy_error';
    }

    for (let i = 0; i < 5; i++) {
      await sleep(1000);
      const currentText = await this.page.locator('body').textContent() || '';
      
      if (currentText.match(/403|forbidden/i)) {
        return 'submission_failed_403';
      }
      
      if (currentText.match(/queue.?full/i)) {
        return 'queue_full';
      }
    }

    return null;
  }

  /**
   * Download a resource as base64 using the page's context
   * (Essential for blob: URLs or private Google URLs)
   */
  async getResourceBase64(url: string): Promise<string | null> {
    try {
      console.log('[FlowService] Fetching resource as base64:', url.substring(0, 50));
      const base64 = await this.page.evaluate(async (src) => {
        const response = await fetch(src);
        const blob = await response.blob();
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }, url);
      
      // Strip prefix if needed
      return base64.split(',')[1] || null;
    } catch (e: any) {
      console.error('[FlowService] Base64 fetch failed:', e.message);
      return null;
    }
  }

  /**
   * Wait for generation to complete
   */
  async waitForGeneration(): Promise<{ success: boolean; status: string }> {
    console.log('[FlowService] Waiting for generation...');
    const startTime = Date.now();
    let lastProgress = 0;

    while (Date.now() - startTime < CONFIG.GENERATION_TIMEOUT) {
      const status = await getProgress(this.page);
      
      if (status.progress !== lastProgress) {
        console.log(`[FlowService] Progress: ${status.progress}%`);
        lastProgress = status.progress;
      }

      if (status.status === 'complete') {
        console.log('[FlowService] Generation complete!');
        return { success: true, status: 'complete' };
      }

      // If progress is stuck but enough time has passed, check if resources actually appeared
      if (Date.now() - startTime > 15000 && lastProgress >= 50) {
        try {
           const resources = await findDownloadableResources(this.page);
           if (resources.length > 0) {
             console.log('[FlowService] Found generated resources, assuming complete despite progress bar.');
             return { success: true, status: 'complete' };
           }
        } catch (e) {}
      }

      if (status.status === 'queue_full') {
        return { success: false, status: 'queue_full' };
      }

      if (status.status === 'policy_error') {
        return { success: false, status: 'policy_error' };
      }

      await sleep(CONFIG.POLL_INTERVAL);
    }

    return { success: false, status: 'timeout' };
  }

  /**
   * Scan for downloadable resources
   */
  async scanForDownloads(promptPrefix?: string): Promise<DownloadedResource[]> {
    console.log('[FlowService] Scanning for downloads...');
    
    const resources = await findDownloadableResources(this.page);
    
    for (const resource of resources) {
      if (promptPrefix) {
        const safeName = promptPrefix.replace(/[^a-z0-9]/gi, '_').substring(0, 40);
        resource.filename = `${safeName}_${resource.filename}`;
      }
    }
    
    console.log(`[FlowService] Found ${resources.length} downloadable resources`);
    return resources;
  }

  /**
   * Download a file from URL
   */
  async downloadFile(url: string, filename: string, outputDir?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const dir = outputDir || path.resolve('output');
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const filePath = path.join(dir, filename);
      const protocol = url.startsWith('https') ? https : http;
      
      const file = fs.createWriteStream(filePath);
      
      protocol.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log('[FlowService] Following redirect to:', response.headers.location);
          file.close();
          this.downloadFile(response.headers.location, filename, outputDir).then(resolve).catch(reject);
          return;
        }
        
        if (response.statusCode && response.statusCode >= 400) {
          file.close();
          fs.unlinkSync(filePath);
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log('[FlowService] Downloaded:', filePath);
          resolve(filePath);
        });
      }).on('error', (err) => {
        file.close();
        reject(err);
      });
    });
  }

  /**
   * Download all completed resources
   */
  async downloadAll(resources: DownloadedResource[], outputDir?: string): Promise<string[]> {
    const downloaded: string[] = [];
    
    for (const resource of resources) {
      try {
        const filePath = await this.downloadFile(resource.url, resource.filename, outputDir);
        downloaded.push(filePath);
      } catch (e) {
        console.error('[FlowService] Download failed:', resource.filename, e);
      }
    }
    
    return downloaded;
  }

  /**
   * Get aspect ratio selector
   */
  private getRatioSelector(ratio: AspectRatio): string | null {
    switch (ratio) {
      case '16_9': return SELECTORS.editor.aspectRatios.landscape_16_9;
      case '9_16': return SELECTORS.editor.aspectRatios.portrait_9_16;
      case '1_1': return SELECTORS.editor.aspectRatios.square_1_1;
      case '4_3': return SELECTORS.editor.aspectRatios.landscape_4_3;
      case '3_4': return SELECTORS.editor.aspectRatios.portrait_3_4;
      default: return null;
    }
  }

  /**
   * Convert base64 to File object
   */
  private base64ToFile(base64Data: string, fileName: string, mimeType = 'image/png'): Buffer {
    const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');
    return Buffer.from(base64, 'base64');
  }
}

/**
 * Helper function to find button by icon
 */
async function findByIcon(page: Page, iconText: string) {
  const selector = `button i:has-text("${iconText}")`;
  try {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
      return element;
    }
  } catch (e) {}
  return null;
}
