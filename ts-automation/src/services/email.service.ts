import nodemailer from 'nodemailer';

// Email templates
const templates = {
  otp: (data: { otp: string; expiresIn: string; emailType?: string }) => ({
    subject: 'Your NanoFlow Verification Code',
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0b; color: #fafafa; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(139,92,246,0.3); }
    .logo { font-size: 28px; font-weight: 800; color: #a855f7; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 700; margin: 24px 0 8px; }
    .subtitle { color: #a1a1aa; font-size: 14px; margin-bottom: 32px; }
    .otp-box { background: rgba(139,92,246,0.12); border: 2px dashed rgba(139,92,246,0.4); border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0; }
    .otp-code { font-size: 44px; font-weight: 800; letter-spacing: 12px; color: #a855f7; font-family: monospace; }
    .expires { font-size: 13px; color: #71717a; margin-top: 10px; }
    .warning { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 10px; padding: 14px; font-size: 13px; color: #ca8a04; margin-top: 24px; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #52525b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">✨ NanoFlow</div>
      <div class="title">Verify Your Email</div>
      <div class="subtitle">Enter this code on the website to verify your email address.</div>
      <div class="otp-box">
        <div class="otp-code">${data.otp}</div>
        <div class="expires">⏰ Expires in ${data.expiresIn}</div>
      </div>
      <div class="warning">
        🔒 Never share this code with anyone. NanoFlow staff will never ask for this code.
      </div>
    </div>
    <div class="footer">NanoFlow AI • This is an automated email, please do not reply.</div>
  </div>
</body>
</html>`,
  }),

  approval: (data: { plan: string; email: string }) => ({
    subject: `Your NanoFlow ${data.plan} Plan is Now Active!`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0b; color: #fafafa; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(139,92,246,0.3); }
    .logo { font-size: 28px; font-weight: 800; color: #a855f7; margin-bottom: 8px; }
    .checkmark { font-size: 56px; text-align: center; margin: 24px 0; }
    .title { font-size: 24px; font-weight: 700; text-align: center; margin-bottom: 8px; }
    .subtitle { color: #a1a1aa; font-size: 15px; text-align: center; margin-bottom: 32px; }
    .plan-badge { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: #fff; padding: 8px 20px; border-radius: 20px; font-weight: 700; font-size: 16px; }
    .plan-box { text-align: center; margin: 24px 0; }
    .details { background: rgba(139,92,246,0.08); border-radius: 12px; padding: 20px; margin-top: 24px; font-size: 14px; color: #a1a1aa; line-height: 1.7; }
    .cta { display: block; text-align: center; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 16px; margin-top: 28px; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #52525b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">✨ NanoFlow</div>
      <div class="checkmark">🎉</div>
      <div class="title">Payment Approved!</div>
      <div class="subtitle">Your account is now active. Welcome to NanoFlow!</div>
      <div class="plan-box">
        <span class="plan-badge">${data.plan} Plan</span>
      </div>
      <div class="details">
        <strong>Email:</strong> ${data.email}<br>
        You can now log in with your email and the password you chose during registration.
      </div>
      <a href="https://onanoflow.com/auth" class="cta">Login to NanoFlow →</a>
    </div>
    <div class="footer">NanoFlow AI • This is an automated email, please do not reply.</div>
  </div>
</body>
</html>`,
  }),

  admin_payment_notification: (data: {
    email: string;
    plan: string;
    transaction_id: string;
    whatsapp_number: string;
  }) => ({
    subject: `🔔 New Payment Request: ${data.plan}`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0b; color: #fafafa; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 40px auto; padding: 0 20px; }
    .card { background: linear-gradient(135deg, #1a1a2e 0%, #16162a 100%); border-radius: 20px; padding: 40px; border: 1px solid rgba(139,92,246,0.3); }
    .logo { font-size: 28px; font-weight: 800; color: #a855f7; margin-bottom: 8px; }
    .title { font-size: 22px; font-weight: 700; margin: 24px 0 8px; }
    .row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 14px; }
    .row:last-child { border-bottom: none; }
    .label { color: #71717a; }
    .value { font-weight: 600; color: #fafafa; text-align: right; max-width: 60%; word-break: break-all; }
    .badge { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #a855f7); color: #fff; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .details { background: rgba(139,92,246,0.08); border-radius: 12px; padding: 20px; margin-top: 24px; }
    .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #52525b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="logo">✨ NanoFlow Admin</div>
      <div class="title">New Payment Request</div>
      <div class="details">
        <div class="row"><span class="label">Email</span><span class="value">${data.email}</span></div>
        <div class="row"><span class="label">Plan</span><span class="value"><span class="badge">${data.plan}</span></span></div>
        <div class="row"><span class="label">Transaction ID</span><span class="value">${data.transaction_id}</span></div>
        <div class="row"><span class="label">WhatsApp</span><span class="value">${data.whatsapp_number}</span></div>
      </div>
      <p style="color:#a1a1aa;font-size:13px;margin-top:20px;">Login to your admin panel to review the receipt and approve/reject.</p>
    </div>
    <div class="footer">NanoFlow AI • Admin Notification</div>
  </div>
</body>
</html>`,
  }),
};

export type EmailType = keyof typeof templates;

export interface SendEmailOptions {
  to: string;
  subject?: string; // override template subject
  type: EmailType;
  data: Record<string, any>;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
      });
      console.log('[EmailService] Gmail transporter initialized for:', user);
    } else {
      console.warn('[EmailService] GMAIL_USER/GMAIL_APP_PASSWORD not set — emails will be logged only');
    }
  }

  async send(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
    const templateFn = templates[options.type] as ((data: any) => { subject: string; html: string }) | undefined;
    if (!templateFn) {
      return { success: false, error: `Unknown email type: ${options.type}` };
    }

    const { subject, html } = templateFn(options.data);
    const finalSubject = options.subject || subject;

    if (!this.transporter) {
      console.log(`[EmailService] DEV — Would send to: ${options.to}`);
      console.log(`[EmailService] Subject: ${finalSubject}`);
      return { success: true };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"NanoFlow AI" <${process.env.GMAIL_USER}>`,
        to: options.to,
        subject: finalSubject,
        html,
      });
      console.log('[EmailService] Email sent:', info.messageId, '→', options.to);
      return { success: true };
    } catch (error: any) {
      console.error('[EmailService] Send failed:', error.message);
      return { success: false, error: error.message };
    }
  }
}
