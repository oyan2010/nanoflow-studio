import { chromium } from 'playwright';
import { FlowService, type GenerationRequest } from './services/flow.service.js';
import fs from 'fs';
import path from 'path';

async function runAutomation() {
  const requestsPath = path.resolve('requests.json');
  let requests: GenerationRequest[] = [];

  if (fs.existsSync(requestsPath)) {
    console.log('Loading requests from requests.json...');
    try {
      requests = JSON.parse(fs.readFileSync(requestsPath, 'utf-8'));
    } catch (e) {
      console.error('Failed to parse requests.json:', e);
    }
  } 
  
  if (requests.length === 0) {
    console.log('No valid requests found. Using default example.');
    requests = [
      {
        type: 'VIDEO',
        prompt: 'A futuristic city, cinematic style',
        aspectRatio: '16_9',
        resultCount: 1,
        modelName: 'Veo 3.1 - Lite'
      }
    ];
  }

  // Use persistent context to leverage existing Google login
  const userDataDir = '../ExtensionData'; 
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, 
    viewport: { width: 1366, height: 768 },
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages()[0] || await context.newPage();
  const flow = new FlowService(page);

  try {
    for (const req of requests) {
      console.log('Processing request:', JSON.stringify(req, null, 2));
      await flow.generate(req);
      await page.waitForTimeout(5000);
    }
    console.log('All generation requests processed.');
  } catch (error) {
    console.error('Automation failed:', error);
  } finally {
    // Keep open as requested
  }
}

runAutomation();
