import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { chromium, type BrowserContext } from 'playwright';
import { FlowService } from './services/flow.service.js';
import { ApiFlowService } from './services/api-flow.service.js';
import { QueueService } from './services/queue.service.js';
import { EmailService, type SendEmailOptions } from './services/email.service.js';
import { TunnelService } from './services/tunnel.service.js';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = util.promisify(exec);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// ===== Services =====
const emailService = new EmailService();

// ===== State =====
let context: BrowserContext | null = null;
let queue: QueueService | null = null;
let settings = {
  headless: process.env.HEADLESS === 'true',
  delay: 5000,
};

// ===== Middleware =====
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('web'));

// Request logging middleware
app.use((req, res, next) => {
  const isHeartbeat = req.path === '/' || req.path === '/api/health';
  if (!isHeartbeat) {
    console.log(`[Incoming Request] ${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(`[Payload]`, JSON.stringify(req.body, null, 2));
    }
  }
  next();
});

// ===== API Token Auth =====
let PC_API_TOKEN = process.env.PC_API_TOKEN;

// FOOLPROOF FALLBACK: Read from TOKEN.txt if it exists
const tokenFilePath = path.resolve(process.cwd(), 'TOKEN.txt');
if (fs.existsSync(tokenFilePath)) {
  PC_API_TOKEN = fs.readFileSync(tokenFilePath, 'utf-8').trim();
  console.log(`[Auth] Loaded token from TOKEN.txt (Length: ${PC_API_TOKEN.length})`);
} else if (!PC_API_TOKEN) {
  const localEnvPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(localEnvPath)) {
    const envContent = fs.readFileSync(localEnvPath, 'utf-8');
    const match = envContent.match(/^PC_API_TOKEN=["']?([^"'\r\n]+)["']?/m);
    if (match) {
      PC_API_TOKEN = match[1];
      console.log(`[Env] Manually recovered token from .env (Length: ${PC_API_TOKEN.length})`);
    }
  }
}

function requireApiToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  if (!PC_API_TOKEN || PC_API_TOKEN === 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET') {
    console.warn('[Auth] WARNING: PC_API_TOKEN not set — all requests allowed (INSECURE)');
    return next();
  }
  
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const token = (typeof authHeader === 'string') ? authHeader.replace('Bearer ', '').trim() : '';
  const expected = PC_API_TOKEN.trim();

  if (token !== expected) {
    console.log(`[Auth] 401 Unauthorized`);
    console.log(`[Auth] Expected: "${expected.substring(0, 4)}...${expected.length}"`);
    console.log(`[Auth] Received: "${token.substring(0, 4)}...${token.length}"`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ===== Browser Automation =====
async function initAutomation() {
  if (context) {
    console.log('[Browser] Shutting down existing context...');
    await context.close().catch(() => {});
  }

  const userDataDir = path.resolve(process.cwd(), 'user_data');
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  console.log(`[Browser] Launching (headless=${settings.headless})...`);

  context = await chromium.launchPersistentContext(userDataDir, {
    headless: settings.headless,
    viewport: { width: 1366, height: 768 },
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const page = context.pages()[0] || await context.newPage();

  if (fs.existsSync('cookies.json')) {
    try {
      const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
      await context.addCookies(cookies);
      console.log('[Browser] Loaded cookies.json');
    } catch (e) {
      console.error('[Browser] Failed to load cookies:', e);
    }
  }

  const flowService = new FlowService(page);
  const apiFlowService = new ApiFlowService(page);
  
  // Start the interceptor before navigation so it applies to the page
  await apiFlowService.injectInterceptor();

  // Navigate to Flow to activate cookies and allow interceptor to work
  console.log('[Browser] Navigating to Google Flow to initialize API context...');
  await flowService.ensureProjectOpen();

  queue = new QueueService(flowService, apiFlowService);
  console.log('[Browser] Automation engine ready (Hybrid API mode enabled).');
}

// ===== Routes =====

// Public health check — used by Cloudflare and frontend to check server status
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    browserReady: !!context,
    queueReady: !!queue,
    version: '2.0',
  });
});

// ── Email ──────────────────────────────────────────
app.post('/api/send-email', requireApiToken, async (req, res) => {
  try {
    const { to, subject, type, data } = req.body as SendEmailOptions & { subject?: string };

    if (!to || !type) {
      return res.status(400).json({ error: 'to and type are required' });
    }

    const result = await emailService.send({ to, subject, type, data: data || {} });
    res.json(result.success ? { success: true } : { success: false, error: result.error });
  } catch (err: any) {
    console.error('[/api/send-email]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Settings ───────────────────────────────────────
app.get('/api/settings', (_req, res) => res.json(settings));

app.post('/api/settings', requireApiToken, async (req, res) => {
  settings = { ...settings, ...req.body };
  await initAutomation();
  res.json({ success: true, settings });
});

// ── Generation Queue ───────────────────────────────
app.post('/api/generate', requireApiToken, async (req, res) => {
  if (!queue) return res.status(503).json({ error: 'Browser engine not ready' });
  try {
    let task = await queue.addTask(req.body);

    if (req.body.waitForCompletion) {
      console.log(`[API] Waiting for task ${task.id} to complete...`);
      // Wait for task
      while (true) {
        const tasks = await queue.getTasks();
        const updatedTask = tasks.find(t => t.id === task.id);
        if (updatedTask && (updatedTask.status === 'COMPLETED' || updatedTask.status === 'FAILED')) {
          task = updatedTask;
          break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }

      if (task.status === 'FAILED') {
        return res.json({ 
          success: false, 
          error: task.error || 'Generation failed',
          task: { id: task.id, status: 'FAILED' }
        });
      }

      // If it's completed, it has a resultUrl from Google Flow
      if (task.resultUrl && flowService) {
        try {
          const base64 = await flowService.getResourceBase64(task.resultUrl);
          if (base64) {
            task.videoBase64 = base64;
          }
        } catch(e) {
          console.error('[API] Failed to get base64 from flowService', e);
        }
      }
    }

    res.json({ success: true, task });
  } catch (err: any) {
    console.error('[/api/generate] Error:', err.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.get('/api/status', async (_req, res) => {
  if (!queue) return res.json({ tasks: [] });
  try {
    res.json({ tasks: await queue.getTasks() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Cookie Management ──────────────────────────────
app.post('/api/auth/cookies', requireApiToken, async (req, res) => {
  if (!context) return res.status(503).json({ error: 'Browser engine not ready' });
  try {
    let cookies = req.body.cookies || req.body;
    if (!Array.isArray(cookies)) throw new Error('Expected an array of cookies');

    const formatted = cookies.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires ?? c.expirationDate,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
      sameSite: c.sameSite
        ? c.sameSite.charAt(0).toUpperCase() + c.sameSite.slice(1).toLowerCase()
        : 'Lax',
    }));

    await context.addCookies(formatted);
    fs.writeFileSync('cookies.json', JSON.stringify(formatted, null, 2));
    res.json({ success: true, count: formatted.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Voice Generation (Edge-TTS) ────────────────────
app.post('/api/generate-voice', requireApiToken, async (req, res) => {
  try {
    const { text, voice = 'en-US-AriaNeural' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }

    const outputDir = path.resolve(process.cwd(), 'output', 'voices');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    
    const fileName = `voice_${Date.now()}.mp3`;
    const outputPath = path.join(outputDir, fileName);
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'generate_voice.py');

    console.log(`[TTS] Generating voice="${voice}" text="${text.substring(0, 40)}..."`);
    
    // Execute python script
    let stdout = '', stderr = '';
    try {
      const result = await execAsync(
        `python "${scriptPath}" --text "${text.replace(/"/g, '\\"').replace(/\n/g, ' ')}" --voice "${voice}" --output "${outputPath}"`
      );
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (execErr: any) {
      stdout = execErr.stdout || '';
      stderr = execErr.stderr || execErr.message;
    }

    console.log(`[TTS] stdout: ${stdout.trim()}`);
    if (stderr) console.error(`[TTS] stderr: ${stderr.trim()}`);

    // Check if file was created successfully
    if (fs.existsSync(outputPath)) {
      const audioBuffer = fs.readFileSync(outputPath);
      const audioBase64 = audioBuffer.toString('base64');
      fs.unlinkSync(outputPath); // Clean up
      console.log(`[TTS] Success! Audio size: ${audioBuffer.length} bytes`);
      res.json({ success: true, audioBase64 });
    } else {
      const errMsg = stderr || stdout || 'Python script did not produce output file';
      console.error('[TTS] Failed - no output file created:', errMsg);
      res.status(500).json({ success: false, error: `TTS failed: ${errMsg}` });
    }
  } catch (err: any) {
    console.error('[/api/generate-voice] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Voices ─────────────────────────────────────────
app.get('/api/voices', (_req, res) => {
  res.json({
    success: true,
    voices: [
      { id: "en-US-AriaNeural", name: "Aria (Female, US)" },
      { id: "en-US-GuyNeural", name: "Guy (Male, US)" },
      { id: "en-GB-SoniaNeural", name: "Sonia (Female, UK)" },
      { id: "en-GB-RyanNeural", name: "Ryan (Male, UK)" },
      { id: "en-AU-NatashaNeural", name: "Natasha (Female, AU)" },
      { id: "en-AU-WilliamNeural", name: "William (Male, AU)" },
      { id: "es-ES-ElviraNeural", name: "Elvira (Female, ES)" },
      { id: "es-ES-AlvaroNeural", name: "Alvaro (Male, ES)" },
      { id: "fr-FR-DeniseNeural", name: "Denise (Female, FR)" },
      { id: "fr-FR-HenriNeural", name: "Henri (Male, FR)" }
    ]
  });
});

// ===== Start =====
app.listen(port, async () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      NanoFlow PC Server  v2.0            ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Local:    http://localhost:${port}`);
  console.log(`  Token:    ${PC_API_TOKEN && PC_API_TOKEN !== 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET' ? '✅ Set' : '⚠️  NOT SET'}`);
  console.log(`  Gmail:    ${process.env.GMAIL_USER ? '✅ ' + process.env.GMAIL_USER : '⚠️  NOT SET'}`);
  console.log('');

  // Initialize Cloudflare Tunnel (auto-registers new URL in Supabase)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey && PC_API_TOKEN) {
    const tunnel = new TunnelService({
      supabaseUrl,
      supabaseAnonKey,
      pcApiToken: PC_API_TOKEN,
      port,
      cloudflaredPath: "F:/Web Development/Nanoo/corrected-project-structure/ts-automation/src/cloudflared.exe",
    });

    const publicUrl = await tunnel.start();
    if (publicUrl) {
      console.log(`  Public:   ${publicUrl}  ← registered in Supabase`);
    } else {
      console.warn('  Public:   ⚠️  Tunnel not active — email features will be unavailable');
      console.warn('            Install cloudflared from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
    }
  } else {
    console.warn('  Tunnel:   ⚠️  SUPABASE_URL/SUPABASE_ANON_KEY/PC_API_TOKEN not set — skipping tunnel registration');
  }

  console.log('');

  // Initialize browser automation
  try {
    await initAutomation();
  } catch (err: any) {
    console.error('[Browser] Failed to initialize:', err.message);
    console.warn('[Browser] Server will continue without browser automation');
  }
});
