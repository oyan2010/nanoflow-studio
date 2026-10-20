import type { Page, Locator } from 'playwright';

/**
 * VEO Flow Selectors - Robust selector definitions
 * Uses icon-based and semantic selectors instead of hash-based class names
 */

export const SELECTORS = {
  home: {
    newProject: 'button:has-text("New project"), button:has-text("Create with Flow")',
    createWithFlow: 'button:has-text("Create with Flow")',
    projectCard: '[class*="project-card"], [class*="projectCard"], [data-testid*="project"]',
    signIn: 'button:has-text("Sign in")',
  },
  editor: {
    promptInput: '[role="textbox"], [contenteditable="true"], textarea[placeholder*="Describe"], textarea[aria-label*="prompt" i]',
    
    settingsMenu: [
      'button i:has-text("tune")',
      'button[id^="radix-"]:has-text("Video")',
      'button[id^="radix-"]:has-text("Image")',
      'button[aria-haspopup="dialog"]'
    ].join(', '),
    
    videoTab: 'button[role="tab"]:has-text("Video"), button[id$="-trigger-VIDEO"], button:has-text("Video")',
    imageTab: 'button[role="tab"]:has-text("Image"), button[id$="-trigger-IMAGE"], button:has-text("Image")',
    
    aspectRatios: {
      landscape_16_9: 'button:has-text("16:9"), button:has-text("Landscape (16:9)"), button:has-text("LANDSCAPE")',
      portrait_9_16: 'button:has-text("9:16"), button:has-text("Portrait (9:16)"), button:has-text("PORTRAIT")',
      square_1_1: 'button:has-text("1:1"), button:has-text("Square (1:1)"), button:has-text("SQUARE")',
      landscape_4_3: 'button:has-text("4:3"), button:has-text("Landscape (4:3)"), button:has-text("LANDSCAPE_4_3")',
      portrait_3_4: 'button:has-text("3:4"), button:has-text("Portrait (3:4)"), button:has-text("PORTRAIT_3_4")',
    },
    
    resultsCount: {
      x1: 'button[role="tab"]:has-text("1"), button[id$="-trigger-1"], button[aria-label*="1 result"]',
      x2: 'button[role="tab"]:has-text("2"), button[id$="-trigger-2"], button[aria-label*="2 result"]',
      x3: 'button[role="tab"]:has-text("3"), button[id$="-trigger-3"], button[aria-label*="3 result"]',
      x4: 'button[role="tab"]:has-text("4"), button[id$="-trigger-4"], button[aria-label*="4 result"]',
    },
    
    generateBtn: [
      'button i:has-text("arrow_forward")',
      'button i:has-text("send")',
      'button:has-text("Create")',
      'button:has-text("Generate")'
    ].join(', '),
    
    addImageBtn: [
      'button i:has-text("add")',
      'button i:has-text("add_photo_alternate")',
      'button:has-text("Add image")',
      'button:has-text("Upload")'
    ].join(', '),

    fileInput: 'input[type="file"]',
    
    dialog: 'div[role="dialog"]',
    dropdown: 'button[role="combobox"][aria-autocomplete="none"]',
    option: '[role="option"]',
    radio: '[role="radio"], [role="menuitemradio"]',
    listbox: '[role="listbox"]',
    
    modelDropdown: [
      'button:has-text("Veo"), button:has-text("Nano"), button:has-text("Imagen"), button:has-text("Model")',
      'button[id^="radix-"]:has-text("Veo"), button[id^="radix-"]:has-text("Nano"), button[id^="radix-"]:has-text("Imagen")',
      'div:has-text("Model"), [aria-haspopup="listbox"], [aria-haspopup="menu"]'
    ].join(', '),
    
    checkIcon: 'button i:has-text("check"), button i:has-text("done")',
    closeIcon: 'button i:has-text("close"), button i:has-text("clear")',
  },
  
  download: {
    video: 'video[src^="http"], video[src^="blob"]',
    image: 'img[src^="http"], img[src^="blob"]',
    downloadBtn: 'button:has-text("Download"), button i:has-text("download")',
  },
  
  errors: {
    queueFull: /queue.?full/i,
    policyError: /policy.?error|policy.?violation/i,
    generationFailed: /generation.?failed|failed.?generation/i,
    errorIcon: 'i:has-text("error"), i:has-text("cancel"), [class*="error"]',
  }
};

export const CONFIG = {
  ELEMENT_WAIT_TIMEOUT: 15000,
  GENERATION_TIMEOUT: 300000,
  CLICK_DELAY: 500,
  TYPE_DELAY: 50,
  STABILIZATION_DELAY: 200,
  POLL_INTERVAL: 2000,
};

export interface DownloadedResource {
  type: 'video' | 'image';
  url: string;
  filename: string;
  prompt?: string;
}

export interface GenerationStatus {
  status: 'idle' | 'generating' | 'complete' | 'error' | 'queue_full' | 'policy_error';
  progress: number;
  message?: string;
}

export interface FailedPrompt {
  prompt: string;
  reason: string;
}

/**
 * Sleep helper
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Find element by icon text (Google Material Icons)
 */
export async function findByIcon(page: Page, iconText: string): Promise<Locator | null> {
  const selector = `button i:has-text("${iconText}")`;
  try {
    const element = page.locator(selector).first();
    if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
      return element;
    }
  } catch (e: unknown) {}
  return null;
}

/**
 * Wait for element to be visible with fallback selectors
 */
export async function waitForVisible(page: Page, selectors: string | string[], timeout = CONFIG.ELEMENT_WAIT_TIMEOUT): Promise<Locator> {
  const selectorList = Array.isArray(selectors) ? selectors : selectors.split(',').map(s => s.trim());
  
  for (const selector of selectorList) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: Math.min(timeout, 5000) }).catch(() => false)) {
        return element;
      }
    } catch (e: unknown) {}
  }
  
  const firstSelector = selectorList[0];
  return firstSelector ? page.locator(firstSelector).first() : page.locator(':empty').first();
}

/**
 * Click element with fallback - tries multiple selectors until one works
 */
export async function clickWithFallback(page: Page, selectors: string | string[], timeout = 3000): Promise<boolean> {
  const selectorList = Array.isArray(selectors) ? selectors : selectors.split(',').map(s => s.trim());
  
  for (const selector of selectorList) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout }).catch(() => false)) {
        await element.click();
        return true;
      }
    } catch (e) {
      console.log(`[SELECTORS] Selector failed: ${selector}`);
    }
  }
  
  console.error(`[SELECTORS] All selectors failed for: ${selectors}`);
  return false;
}

/**
 * Heavy click - dispatches full mouse event sequence for React/Angular compatibility
 */
export async function heavyClick(page: Page, locator: Locator): Promise<boolean> {
  try {
    await locator.scrollIntoViewIfNeeded();
    await sleep(100);
    
    const box = await locator.boundingBox();
    if (!box) return false;
    
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    
    const events = [
      'pointerover',
      'mouseover', 
      'pointerdown',
      'mousedown',
      'pointerup',
      'mouseup',
      'click',
    ];
    
    for (const eventType of events) {
      await locator.dispatchEvent(eventType, {
        clientX: x,
        clientY: y,
        bubbles: true,
        cancelable: true,
        button: eventType.includes('down') ? 0 : undefined,
      });
    }
    
    await sleep(CONFIG.CLICK_DELAY);
    return true;
  } catch (e) {
    console.error('[SELECTORS] Heavy click failed:', e);
    return false;
  }
}

/**
 * Type text with optional human-like typing
 */
export async function typeText(page: Page, locator: Locator, text: string, humanLike = false): Promise<void> {
  await locator.click();
  await sleep(100);
  
  if (humanLike) {
    for (let i = 0; i < text.length; i++) {
      const char = text[i] ?? '';
      await locator.press(char);
      await sleep(CONFIG.TYPE_DELAY + Math.random() * 20);
    }
  } else {
    await locator.fill(text);
  }
  
  await locator.dispatchEvent('input', { bubbles: true });
  await locator.dispatchEvent('change', { bubbles: true });
  await sleep(100);
}

/**
 * Close any open dialogs/dropdowns using Escape
 */
export async function closeDialogs(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await sleep(300);
  
  const dialog = await page.locator('div[role="dialog"]').isVisible().catch(() => false);
  if (dialog) {
    await page.keyboard.press('Escape');
    await sleep(200);
  }
}

/**
 * Select option from dropdown by text
 */
export async function selectDropdownOption(page: Page, optionText: string, exactMatch = false): Promise<boolean> {
  const options = page.locator(SELECTORS.editor.option);
  const count = await options.count();
  
  const searchFor = optionText.toLowerCase();
  
  for (let i = 0; i < count; i++) {
    const opt = options.nth(i);
    const text = (await opt.textContent() || '').trim().toLowerCase();
    
    if (exactMatch && text === searchFor) {
      await opt.click();
      await sleep(300);
      return true;
    }
    
    if (!exactMatch && (text.includes(searchFor) || searchFor.includes(text))) {
      await opt.click();
      await sleep(300);
      return true;
    }
  }
  
  return false;
}

/**
 * Get progress percentage from page
 */
export async function getProgress(page: Page): Promise<GenerationStatus> {
  const bodyText = await page.locator('body').textContent() || '';
  
  const percentMatch = bodyText.match(/(\d+)%/);
  if (percentMatch && percentMatch[1]) {
    return { status: 'generating', progress: parseInt(percentMatch[1]) };
  }
  
  const loadingIcon = await page.locator('i:has-text("progress_activity")').isVisible().catch(() => false);
  if (loadingIcon) {
    return { status: 'generating', progress: 0 };
  }
  
  const videos = page.locator('video[src^="http"], video[src^="blob"]');
  if (await videos.first().isVisible().catch(() => false)) {
    return { status: 'complete', progress: 100 };
  }

  // Also check for images as completion indicator
  const images = page.locator('img[src^="http"], img[src^="blob"]');
  const imageCount = await images.count();
  for (let i = 0; i < imageCount; i++) {
    const img = images.nth(i);
    const src = await img.getAttribute('src') || '';
    const isGenerated = src.startsWith('blob:') || (src.includes('googleusercontent.com') && !src.includes('lh3.googleusercontent.com/a/'));
    if (isGenerated) {
      if (await img.isVisible().catch(() => false)) {
         return { status: 'complete', progress: 100 };
      }
    }
  }
  
  if (bodyText.match(SELECTORS.errors.queueFull)) {
    return { status: 'queue_full', progress: 0, message: 'Queue is full' };
  }
  
  if (bodyText.match(SELECTORS.errors.policyError)) {
    return { status: 'policy_error', progress: 0, message: 'Policy violation' };
  }
  
  return { status: 'idle', progress: 0 };
}

/**
 * Find failed generation prompts in the UI
 */
export async function findFailedPrompts(page: Page): Promise<FailedPrompt[]> {
  const failedPrompts: FailedPrompt[] = [];
  
  const errorCards = page.locator('[class*="card"], [class*="item"], [class*="prompt"]');
  const count = await errorCards.count();
  
  for (let i = 0; i < count; i++) {
    const card = errorCards.nth(i);
    const cardText = await card.textContent() || '';
    
    if (cardText.match(/failed|error/i)) {
      const textElements = await card.locator('p, span, div').all();
      let promptText = '';
      let reason = 'Failed Generation';
      
      for (const el of textElements) {
        const text = (await el.textContent() || '').trim();
        if (text.length > 20 && !text.match(/failed|error|retry|generate/i)) {
          promptText = text.slice(0, 100);
          break;
        }
      }
      
      if (cardText.match(/policy/i)) reason = 'Policy violation';
      else if (cardText.match(/timeout/i)) reason = 'Generation timeout';
      else if (cardText.match(/capacity/i)) reason = 'Server capacity issue';
      
      if (promptText) {
        failedPrompts.push({ prompt: promptText, reason });
      }
    }
  }
  
  return failedPrompts;
}

/**
 * Find downloadable resources (videos/images) in the UI
 */
export async function findDownloadableResources(page: Page): Promise<DownloadedResource[]> {
  const resources: DownloadedResource[] = [];
  
  // 1. Check for intercepted downloads from our protection script
  try {
    const intercepted = await page.evaluate(() => {
      const state = (window as any).veoState;
      if (state && state.pendingDownloads && state.pendingDownloads.length > 0) {
        const downloads = [...state.pendingDownloads];
        state.pendingDownloads = []; 
        return downloads;
      }
      return [];
    });
    
    if (intercepted && intercepted.length > 0) {
      console.log(`[SELECTORS] Found ${intercepted.length} intercepted resources`);
      for (const item of intercepted) {
        resources.push({
          type: item.url.includes('.mp4') || item.filename.includes('.mp4') ? 'video' : 'image',
          url: item.url,
          filename: item.filename,
          prompt: item.prompt
        });
      }
    }
  } catch (e) {}

  // 2. Scan DOM for videos
  const videos = page.locator('video[src^="http"], video[src^="blob"]');
  const videoCount = await videos.count();
  
  for (let i = 0; i < videoCount; i++) {
    const video = videos.nth(i);
    const src = await video.getAttribute('src');
    if (src && !resources.find(r => r.url === src)) {
      resources.push({
        type: 'video',
        url: src,
        filename: `video_${Date.now()}_${i}.mp4`,
      });
    }
  }
  
  // 3. Scan DOM for images
  const images = page.locator('img[src^="http"], img[src^="blob"]');
  const imageCount = await images.count();
  
  for (let i = 0; i < imageCount; i++) {
    const img = images.nth(i);
    const src = await img.getAttribute('src');
    if (src) {
      const isGenerated = src.startsWith('blob:') || src.includes('googleusercontent.com') || src.includes('fife');
      const isUI = src.includes('lh3.googleusercontent.com/a/') || src.includes('accounts.google') || src.length < 50;

      if (isGenerated && !isUI && !resources.find(r => r.url === src)) {
        const ext = src.includes('.png') ? 'png' : src.includes('.webp') ? 'webp' : 'jpg';
        resources.push({
          type: 'image',
          url: src,
          filename: `image_${Date.now()}_${i}.${ext}`,
        });
      }
    }
  }
  
  return resources;
}

/**
 * Check if element is fully visible in viewport
 */
export async function isFullyVisible(page: Page, locator: Locator): Promise<boolean> {
  try {
    const box = await locator.boundingBox();
    if (!box) return false;
    
    const viewport = page.viewportSize();
    if (!viewport) return true;
    
    return box.width > 0 && 
           box.height > 0 && 
           box.x >= 0 && 
           box.y >= 0 && 
           box.x + box.width <= viewport.width && 
           box.y + box.height <= viewport.height;
  } catch {
    return false;
  }
}