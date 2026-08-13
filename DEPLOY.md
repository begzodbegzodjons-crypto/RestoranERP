# Restoran POS V2 — Deployment Guide

## Architecture
- **Frontend**: Next.js 16 (App Router) — deploy to Cloudflare Pages or Vercel
- **Backend**: Express.js + TypeScript — deploy to Render/Railway/Fly.io/VPS
- **Database**: TiDB Cloud (MySQL-compatible, already running)
- **Print Server**: Node.js mini-service (runs on POS computer)

## Step 1: GitHub Push
```bash
cd /home/z/my-project
git init
git add .
git commit -m "Restoran POS V2 — Production Ready"
git remote add origin https://github.com/YOUR_USERNAME/restoran-pos-v2.git
git push -u origin main
```

## Step 2: Backend Deploy (Render.com)
1. Go to render.com → New → Web Service
2. Connect GitHub repo
3. Settings:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && node dist/index.js`
   - Environment Variables:
     - DB_HOST=gateway01.eu-central-1.prod.aws.tidbcloud.com
     - DB_PORT=4000
     - DB_USER=3YTK6Em4WhtFiqF.root
     - DB_PASSWORD=ovAH3n3bu2YabeK0
     - DB_DATABASE=oshxona_erp_v2
     - JWT_SECRET=your-strong-secret-here
     - NODE_ENV=production
     - CORS_ORIGIN=https://your-app.onrender.com
4. Deploy

## Step 3: Frontend Deploy (Cloudflare Pages / Vercel)
1. Go to pages.cloudflare.com or vercel.com
2. Import GitHub repo
3. Settings:
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Environment Variables:
     - NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
4. Deploy

## Step 4: Print Server (POS Computer)
```bash
cd mini-services/print-server
npm install
node index.js
```

## Database
Already running on TiDB Cloud:
- Host: gateway01.eu-central-1.prod.aws.tidbcloud.com:4000
- Database: oshxona_erp_v2
- 35 tables, 9 views, 142 indexes, 59 FKs

## Test Credentials
- Admin: +998901234567 / PIN 1234
- Cashier: +998901111222 / PIN 1234
- Waiter: +998903333444 / PIN 1234
