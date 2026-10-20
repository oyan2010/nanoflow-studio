import { spawn, spawnSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';

/**
 * Cloudflare Tunnel Service
 * 
 * Starts `cloudflared tunnel --url http://localhost:PORT` as a subprocess,
 * captures the public HTTPS URL from its output, then registers that URL
 * into Supabase via the register-server edge function.
 * 
 * The URL changes every time cloudflared restarts — this handles it automatically.
 */
export class TunnelService {
  private process: ChildProcess | null = null;
  private publicUrl: string | null = null;
  private supabaseUrl: string;
  private supabaseAnonKey: string;
  private pcApiToken: string;
  private port: number;
  private cloudflaredPath: string | null = null;

  constructor(options: {
    supabaseUrl: string;
    supabaseAnonKey: string;
    pcApiToken: string;
    port: number;
    cloudflaredPath?: string;
  }) {
    this.supabaseUrl = options.supabaseUrl;
    this.supabaseAnonKey = options.supabaseAnonKey;
    this.pcApiToken = options.pcApiToken;
    this.port = options.port;
    this.cloudflaredPath = options.cloudflaredPath ?? "F:/Web Development/Nanoo/corrected-project-structure/ts-automation/src/cloudflared.exe";
  }

  /**
   * Start cloudflared tunnel and register URL with Supabase
   */
  async start(): Promise<string | null> {
    console.log('[Tunnel] Starting Cloudflare tunnel...');

    const executable = this.resolveCloudflaredBinary();
    if (!executable) {
      console.warn('[Tunnel] cloudflared not found or not accessible.');
      console.warn('[Tunnel] Set CLOUDFLARED_PATH to the full path of cloudflared.exe or add it to PATH.');
      console.warn('[Tunnel] Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
      return null;
    }

    console.log(`[Tunnel] Using cloudflared executable: ${executable}`);

    return new Promise((resolve) => {
      this.process = spawn(executable, [
        'tunnel',
        '--url', `http://localhost:${this.port}`,
        '--no-autoupdate',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });

      let resolved = false;
      const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;
      const timeout = setTimeout(() => {
        if (!resolved) {
          console.warn('[Tunnel] Could not detect public URL within 30s — running without tunnel');
          resolved = true;
          resolve(null);
        }
      }, 30000);

      const onData = async (data: Buffer) => {
        const text = data.toString();
        const match = text.match(urlPattern);
        if (match && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          this.publicUrl = match[0];
          console.log(`[Tunnel] Public URL: ${this.publicUrl}`);
          await this.registerWithSupabase(this.publicUrl);
          resolve(this.publicUrl);
        }
      };

      this.process.stdout?.on('data', onData);
      this.process.stderr?.on('data', onData); // cloudflared logs URL to stderr

      this.process.on('exit', (code) => {
        console.warn(`[Tunnel] cloudflared exited with code ${code}`);
        this.publicUrl = null;
        this.process = null;
      });

      this.process.on('error', (err) => {
        if (!resolved) {
          console.warn('[Tunnel] cloudflared not found or failed to start:', err.message);
          console.warn('[Tunnel] Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
          resolved = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });
    });
  }

  /**
   * Register the public URL with Supabase so edge functions can find it
   */
  private resolveCloudflaredBinary(): string | null {
    const explicitPath = this.cloudflaredPath?.trim();

    if (explicitPath) {
      if (fs.existsSync(explicitPath)) {
        return explicitPath;
      }
      const resolvedCandidate = path.resolve(explicitPath);
      if (fs.existsSync(resolvedCandidate)) {
        return resolvedCandidate;
      }
    }

    const envPath = process.env.CLOUDFLARED_PATH ?? process.env.CLOUDFLARED;
    if (envPath && fs.existsSync(envPath)) {
      return envPath;
    }

    const found = this.which('cloudflared') || (process.platform === 'win32' && this.which('cloudflared.exe'));
    if (found) {
      return found;
    }

    if (process.platform === 'win32') {
      const candidates = [
        path.join(process.env.PROGRAMFILES ?? '', 'Cloudflare', 'cloudflared.exe'),
        path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Cloudflare', 'cloudflared.exe'),
        path.join(process.env.LOCALAPPDATA ?? '', 'cloudflared.exe'),
        path.join(process.env.USERPROFILE ?? '', 'cloudflared.exe'),
        path.join(process.cwd(), 'cloudflared.exe'),
      ];

      for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return null;
  }

  private which(command: string): string | null {
    try {
      const provider = process.platform === 'win32' ? 'where' : 'which';
      const result = spawnSync(provider, [command], { encoding: 'utf-8' });
      if (result.status === 0 && result.stdout) {
        const firstLine = result.stdout.split(/\r?\n/)[0].trim();
        if (firstLine) {
          return firstLine;
        }
      }
    } catch {
      // ignore lookup failures
    }
    return null;
  }

  private async registerWithSupabase(url: string): Promise<void> {
    const edgeFnUrl = `${this.supabaseUrl}/functions/v1/register-server`;

    try {
      const res = await fetch(edgeFnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.pcApiToken}`,
          'apikey': this.supabaseAnonKey,
        },
        body: JSON.stringify({ url }),
      });

      if (res.ok) {
        console.log('[Tunnel] URL registered in Supabase successfully');
      } else {
        const text = await res.text().catch(() => '');
        console.error('[Tunnel] Registration failed:', res.status, text);
      }
    } catch (err: any) {
      console.error('[Tunnel] Could not reach Supabase to register URL:', err.message);
    }
  }

  /**
   * Stop the tunnel subprocess
   */
  stop(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
      this.publicUrl = null;
    }
  }

  getPublicUrl(): string | null {
    return this.publicUrl;
  }
}
