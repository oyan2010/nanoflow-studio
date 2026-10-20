
import type { Page } from 'playwright';
import { API_TEMPLATES, DEFAULT_CLIENT_CONTEXT_TEMPLATE } from '../templates.js';

export interface InterceptedContext {
  authorization: string;
  googApiKey: string;
  projectId: string;
  sessionId: string;
  recaptchaToken: string;
}

export class ApiFlowService {
  private context: InterceptedContext | null = null;
  private isHookInjected = false;

  constructor(private page: Page) {}

  /**
   * Injects the fetch hook to capture the next legitimate API request.
   */
  async injectInterceptor() {
    if (this.isHookInjected) return;

    await this.page.addInitScript(() => {
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        try {
          const urlStr = (args[0] && typeof args[0] === 'object' && 'url' in args[0]) ? args[0].url : String(args[0]);
          const options = args[1] || {};

          if (urlStr.includes('aisandbox-pa.googleapis.com')) {
            console.log(`[Browser Fetch] -> ${urlStr}`);
            
            if (options.body && typeof options.body === 'string') {
              console.log(`[Browser Fetch Body] ->`, options.body.substring(0, 300));
            }
          }

          if (
            urlStr.includes('batchGenerateImages') || 
            urlStr.includes('generateVideo') || 
            urlStr.includes('generationStatus') ||
            urlStr.includes('flow/') ||
            urlStr.includes('video:')
          ) {
            const headers = (options.headers as Record<string, string>) || {};
            const auth = headers['Authorization'] || headers['authorization'] || '';
            const apiKey = headers['X-Goog-Api-Key'] || headers['x-goog-api-key'] || '';
            
            if (options.body && typeof options.body === 'string') {
              const body = JSON.parse(options.body);
              
              const context = {
                authorization: auth,
                googApiKey: apiKey,
                projectId: body.clientContext?.projectId,
                sessionId: body.clientContext?.sessionId,
                recaptchaToken: body.clientContext?.recaptchaContext?.token
              };

              if (context.authorization && context.projectId) {
                // Notify the Node.js side
                (window as any).onApiIntercepted(context).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.error('[Interceptor] Parse error', e);
        }
        return originalFetch.apply(this, args);
      };
      console.log('[Interceptor] Fetch hook injected');
    });

    // Expose binding to receive data back in Node.js
    await this.page.exposeBinding('onApiIntercepted', ({ frame }, context) => {
      console.log('[ApiFlowService] Context intercepted!', context.projectId);
      this.context = context;
    });

    this.isHookInjected = true;
  }

  /**
   * Waits for the context to be captured. 
   * If not captured, it might try to trigger a request by typing in the prompt box.
   */
  async ensureContext(timeout = 30000): Promise<boolean> {
    if (this.context) return true;

    console.log('[ApiFlowService] Waiting for API context interception...');
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.context) return true;
      await new Promise(r => setTimeout(r, 1000));
      
      // Optional: Trigger a "fake" request if the user is idle
      // We can't easily trigger a full generation without a token, 
      // but the site might send a status check automatically.
    }
    return false;
  }

  /**
   * Replays a generation request using the captured context.
   */
  async generateImage(prompt: string, aspectRatio = "IMAGE_ASPECT_RATIO_LANDSCAPE"): Promise<any> {
    if (!this.context) throw new Error('API Context not captured yet');

    const template = JSON.parse(JSON.stringify(API_TEMPLATES.BATCH_GENERATE_IMAGES));
    template.body.requests[0].prompt = prompt;
    template.body.requests[0].aspectRatio = aspectRatio;
    template.body.clientContext.projectId = this.context.projectId;
    template.body.clientContext.sessionId = this.context.sessionId;
    template.body.clientContext.recaptchaContext.token = this.context.recaptchaToken;

    return this.executeApiCall(template.endpoint, template.body);
  }

  async generateVideo(prompt: string, aspectRatio = "VIDEO_ASPECT_RATIO_LANDSCAPE"): Promise<any> {
    if (!this.context) throw new Error('API Context not captured yet');

    const template = JSON.parse(JSON.stringify(API_TEMPLATES.GENERATE_VIDEO));
    template.body.prompt = prompt;
    template.body.aspectRatio = aspectRatio;
    template.body.clientContext.projectId = this.context.projectId;
    template.body.clientContext.sessionId = this.context.sessionId;
    template.body.clientContext.recaptchaContext.token = this.context.recaptchaToken;

    return this.executeApiCall(template.endpoint, template.body);
  }

  async checkStatus(generationId: string): Promise<any> {
    if (!this.context) throw new Error('API Context not captured yet');

    const template = JSON.parse(JSON.stringify(API_TEMPLATES.STATUS));
    template.body.generationId = generationId;
    template.body.clientContext.projectId = this.context.projectId;
    template.body.clientContext.sessionId = this.context.sessionId;
    template.body.clientContext.recaptchaContext.token = this.context.recaptchaToken;

    return this.executeApiCall(template.endpoint, template.body);
  }

  private async executeApiCall(endpoint: string, body: any): Promise<any> {
    if (!this.context) throw new Error('No context');

    const auth = this.context.authorization;
    const apiKey = this.context.googApiKey;

    console.log(`[ApiFlowService] Executing API call to ${endpoint}...`);

    return this.page.evaluate(async ({ url, body, auth, apiKey }) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth,
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`API Error ${response.status}: ${text}`);
      }

      const jsonResult = await response.json();
      console.log(`[ApiFlowService] API Response (${endpoint}):`, JSON.stringify(jsonResult).substring(0, 500));
      return jsonResult;
    }, { url: endpoint, body, auth, apiKey });
  }

  getContext() {
    return this.context;
  }
}
