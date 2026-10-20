# NanoFlow - AI Video Generation & Automated Pipeline Studio 🎬🤖

NanoFlow is a full-stack, enterprise-grade AI video generation and automation platform connecting modern frontends with headless workflow engines.

---

## 🌟 Key Features

- **Intuitive Studio UI**: Built with React, TypeScript, Vite, Tailwind CSS, and Radix UI / Lucide icons.
- **Workflow Automation Architecture**: Background automation workers with resilient queuing, recovery routines, and task dispatching.
- **Real-time Pipeline Monitoring**: Live progress tracking, render previews, and generation metrics.
- **Multi-Cloud Ready**: Deploys seamlessly to Vercel, Netlify, or custom self-hosted Node.js servers.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Radix UI, TanStack Query
- **Automation Engine**: TypeScript, Node.js worker pipeline
- **Build & Dev Tooling**: Vite, Vitest, PostCSS
- **Deployments**: Configured with `vercel.json` and `netlify.toml`

---

## 🚀 Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/oyan2010/nanoflow-studio.git
   cd nanoflow-studio
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Fill in your configuration details.

4. **Start the Frontend Studio**:
   ```bash
   npm run dev
   ```

5. **Start Automation Server** (Optional):
   ```bash
   cd ts-automation
   npm install
   npm start
   ```
