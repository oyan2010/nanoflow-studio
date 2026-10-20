import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { FlowService } from '../src/services/flow.service.js';
import type { GenerationRequest } from '../src/services/flow.service.js';

const OUTPUT_DIR = path.resolve('output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runTest() {
  console.log('='.repeat(50));
  console.log('Starting Image Generation Test');
  console.log('='.repeat(50));
  
  const userDataDir = path.resolve('./user_data');
  
  console.log('Launching browser with persistent context...');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1366, height: 768 },
    args: ['--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
  });
  
  let page = browser.pages()[0];
  
  if (!page) {
    page = await browser.newPage();
  } else {
    console.log('Reusing existing page:', page.url());
  }
  
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') {
      console.error(`[BROWSER ERROR] ${text}`);
    } else if (type === 'warning') {
      console.warn(`[BROWSER WARN] ${text}`);
    }
  });
  
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.message}`);
  });
  
  page.on('requestfailed', request => {
    console.error(`[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`);
  });
  
  const flowService = new FlowService(page);
  
  try {
    const request: GenerationRequest = {
      type: 'IMAGE',
      prompt: 'A futuristic city with neon lights, cyberpunk style, high detail, 4k',
      aspectRatio: '16_9',
      resultCount: 1,
      humanLike: false,
      waitForCompletion: true,
      outputDir: OUTPUT_DIR,
    };
    
    console.log('\nStarting generation with FlowService...');
    console.log('Request:', JSON.stringify(request, null, 2));
    
    const result = await flowService.generate(request);
    
    console.log('\n' + '='.repeat(50));
    console.log('Generation Result:');
    console.log('='.repeat(50));
    console.log('Success:', result.success);
    console.log('Status:', result.status);
    console.log('Downloads:', result.downloadCount);
    
    if (result.failedPrompts && result.failedPrompts.length > 0) {
      console.log('Failed Prompts:', result.failedPrompts);
    }
    
    if (result.error) {
      console.log('Error:', result.error);
      console.log('Step:', result.step);
    }
    
    if (result.success && result.downloads && result.downloads.length > 0) {
      console.log('\n' + '='.repeat(50));
      console.log('SUCCESS! Images downloaded:');
      result.downloads.forEach((d, i) => {
        console.log(`  ${i + 1}. ${d.filename}`);
      });
      console.log('='.repeat(50));
    } else {
      console.log('\n' + '='.repeat(50));
      console.log('No images downloaded - check browser manually');
      console.log('='.repeat(50));
    }
    
    console.log('\nKeeping browser open for inspection (60s)...');
    await page.waitForTimeout(60000);
    
  } catch (error: unknown) {
    console.error('\n' + '='.repeat(50));
    console.log('TEST FAILED:', error instanceof Error ? error.message : error);
    console.log('='.repeat(50));
    
    await page.screenshot({ path: path.join(OUTPUT_DIR, `error_${Date.now()}.png`) });
    console.log('Screenshot saved for debugging');
    
    console.log('\nKeeping browser open for inspection (300s)...');
    await page.waitForTimeout(300000);
    
  } finally {
    // await browser.close();
  }
}

runTest();
