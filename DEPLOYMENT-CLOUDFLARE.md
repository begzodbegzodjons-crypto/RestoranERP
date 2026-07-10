# OshxonaERP — Cloudflare Pages + TiDB Cloud Deployment Guide

Bu hujjat RestoranERP loyihasini **Cloudflare Pages** (frontend + API) va **TiDB Cloud** (ma'lumotlar bazasi) da ishga tushirish uchun to'liq ko'rsatmalar.

## 📋 Arxitektura

```
┌─────────────────────────────┐         ┌──────────────────────────┐
│  Cloudflare Pages (Workers) │         │     TiDB Cloud           │
│  ─────────────────────────  │         │  ──────────────────────  │
│  • Next.js 16 (App Router)  │  HTTPS  │  • MySQL-compatible DB   │
│  • 82 API route (serverless)│ ◀─────▶ │  • Serverless driver     │
│  • Static assets (CDN)      │         │  • HTTP fetch (TCP yo'q) │
│  • nodejs_compat flag       │         │                          │
└─────────────────────────────┘         └──────────────────────────┘
```

**Nima uchun TiDB Serverless driver (HTTP)?**
Cloudflare Workers runtime TCP ulanishlarni qo'llab-quvvatlamaydi. TiDB Cloud Serverless driver HTTP fetch API orqali ishlaydi va Cloudflare Workers'ga mos keladi.

---

## 1️⃣ TiDB Cloud sozlash

### 1.1 Hisob yaratish
1. https://tidbcloud.com ga kiring (ro'yxatdan o'ting — bepul tier mavjud)
2. **Clusters** bo'limiga kiring
3. **Create Cluster** → **Serverless** tanlang
4. Cluster nomi: `oshxona-erp` (yoki istalgan)
5. Region: `AWS US East (N. Virginia)` — foydalanuvchilarga eng yaqin
6. **Create** tugmasini bosing

### 1.2 Database yaratish
1. Cluster ochilgandan keyin **SQL Editor** bo'limiga kiring
2. Quyidagi SQL bajaring:
   ```sql
   CREATE DATABASE IF NOT EXISTS oshxona_erp;
   ```
3. **SQL Editor**'da database o'zgartirilganligini tasdiqlang

### 1.3 Connection string olish
1. Cluster → **Connect** tugmasini bosing
2. **Connection type**: `General` tanlang (Prisma uchun)
3. Username va password ko'rsatiladi — **saqlang** (parolni qayta ko'rsatib bo'lmaydi!)
4. Connection string formati:
   ```
   mysql://<prefix>.root:<password>@gateway01.<region>.prod.aws.tidbcloud.com:4000/oshxona_erp?sslaccept=strict
   ```

> **Muhim**: `sslaccept=strict` parametri majburiy — TiDB Serverless TLS talab qiladi.

---

## 2️⃣ Local muhitni sozlash

### 2.1 Repo klonlash va env yaratish
```bash
git clone https://github.com/begzodbegzodjons-crypto/RestoranERP.git
cd RestoranERP
npm install --legacy-peer-deps
cp .env.example .env.local
```

### 2.2 `.env.local` ni to'ldiring
```env
# TiDB Cloud connection (1.3-bosqichdagi string)
DATABASE_URL="mysql://xxxxx.root:PASSWORD@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/oshxona_erp?sslaccept=strict"

# CF Workers runtime uchun (URL bir xil)
TIDB_DATABASE_URL="mysql://xxxxx.root:PASSWORD@gateway01.us-east-1.prod.aws.tidbcloud.com:4000/oshxona_erp?sslaccept=strict"

# Build target
DEPLOY_TARGET="cloudflare"
```

### 2.3 Schema'ni TiDB'ga yuklash
```bash
# Prisma clientni MySQL uchun generate qilish
npm run db:generate:tidb

# Schema'ni TiDB serverga push qilish (jadvallarni yaratadi)
npm run db:push:tidb
```

Bu buyruqlar `prisma/schema.tidb.prisma` dan foydalanadi va TiDB'da barcha 30 ta jadvalni yaratadi.

### 2.4 Build'ni lokal test qilish
```bash
# Cloudflare Worker bundle yaratish
npm run pages:build

# Lokal preview (Cloudflare Workers muhitini simulyatsiya qiladi)
npm run pages:preview
```

---

## 3️⃣ Cloudflare Pages sozlash

### 3.1 Hisob yaratish
1. https://dash.cloudflare.com ga kiring
2. Chap menyudan **Workers & Pages** → **Create** → **Pages** tanlang

### 3.2 GitHub repo ulash (tavsiya etiladi — avtomatik deploy)
1. **Connect to Git** tugmasini bosing
2. GitHub hisobingizni ulang
3. `begzodbegzodjons-crypto/RestoranERP` repo sini tanlang
4. **Begin setup** tugmasini bosing

### 3.3 Build sozlamalari
| Maydon              | Qiymat                              |
|---------------------|-------------------------------------|
| Framework preset    | None (custom)                       |
| Build command       | `npm run pages:build`               |
| Build output dir    | `.open-next`                        |
| Root directory      | `/` (bo'sh qoldiring)               |
| Package manager     | `npm`                               |

> **Eslatma**: `npm install --legacy-peer-deps` ishlatish uchun `CLOUDFLARE_PAGES_LEGACY_PEER_DEPS=1` env qo'shing yoki `package.json`'da `.npmrc` yarating.

### 3.4 Environment variables (Settings → Environment variables)
Quyidagi o'zgaruvchilarni **Secret** sifatida qo'shing (Production + Preview):

| Var nomi            | Qiymat                                                                 |
|---------------------|------------------------------------------------------------------------|
| `DATABASE_URL`      | `mysql://xxxxx.root:PASSWORD@gateway01...tidbcloud.com:4000/oshxona_erp?sslaccept=strict` |
| `TIDB_DATABASE_URL` | (DATABASE_URL bilan bir xil)                                           |
| `DEPLOY_TARGET`     | `cloudflare`                                                           |
| `NODE_VERSION`      | `20`                                                                   |

> ⚠️ **Muhim**: `TIDB_DATABASE_URL` majburiy — buning sizin `db.ts` TiDB adapter ishlatadi.

### 3.5 Deploy
1. **Save and Deploy** tugmasini bosing
2. Build 5-8 daqiqa atrofida davom etadi
3. Tayyor bo'lgach, `https://<project>.pages.dev` manzilida ishlaydi

---

## 4️⃣ Custom domain ulash (ixtiori)

1. Cloudflare Pages → Custom domains → **Set up a custom domain**
2. O'z domeningizni kiriting (masalan: `erp.mening-oshxonam.uz`)
3. DNS sozlamalari avtomatik qo'shiladi (Cloudflare DNS bo'lsa)
4. SSL/TLS avtomatik faollashadi

---

## 5️⃣ Database migration boshqaruvi

Schema o'zgarishi bo'lsa (masalan, yangi maydon qo'shilsa):

```bash
# Lokal: schema.tidb.prisma ni tahrirlang
# Keyin:
npm run db:push:tidb  # O'zgarishlarni TiDB'ga qo'llaydi
```

> **Eslatma**: Production'da `prisma migrate` emas, `prisma db push` ishlatamiz — chunki migrate TCP talab qiladi, push esa faqat schema'ni qo'llaydi.

---

## 6️⃣ Troubleshooting

### ❌ "PrismaClientInitializationError: provider sqlite"
Sabab: `@prisma/client` SQLite uchun generate qilingan.
Yechim:
```bash
npm run db:generate:tidb  # MySQL uchun qayta generate
```

### ❌ "ECONNREFUSED" yoki TCP xatolari
Sabab: Local dev'da SQLite ishlatilyapti, `DATABASE_URL=file:...` ekan.
Yechim: `.env.local`'da TiDB URL'lari to'g'ri o'rnatilganligini tekshiring.

### ❌ Cloudflare build "Could not resolve dependency"
Sabab: peer dependency conflict (Next 16 + eski paketlar).
Yechim: `.npmrc` fayl yarating:
```
legacy-peer-deps=true
```

### ❌ "Driver Adapter is not compatible with provider"
Sabab: Prisma schema'da provider mismatch.
Yechim: `prisma/schema.tidb.prisma`'da `provider = "mysql"` ekanligini tekshiring.

### ❌ API response "Internal Server Error"
Sabab: Ko'pincha env variablelar to'g'ri o'rnatilmagan.
Yechim: Cloudflare dashboard → Settings → Functions → check env vars.

### ❌ Image upload ishlamaydi
Sabab: Cloudflare Workers `sharp` ni qo'llab-quvvatlamaydi.
Yechim: `next.config.ts`'da `images.unoptimized = true` (allaqachon shunday). Rasm base64 sifatida database'da saqlanadi — bu default holat. Agar Supabase Storage ulansa, u ham ishlaydi.

---

## 7️⃣ Monitoring va observability

- **Cloudflare dashboard** → Workers & Pages → loyiha → **Real-time Logs**
- **`wrangler tail`** buyrug'i bilan realtime log'larni ko'rish
- TiDB Cloud → **Monitoring** bo'limi — query performance metrics

---

## 8️⃣ Tez-tez so'raladigan savollar

**S: Nima uchun `@cloudflare/next-on-pages` emas, `@opennextjs/cloudflare`?**
J: Next.js 16'ni faqat OpenNext qo'llab-quvvatlaydi. `next-on-pages` deprecated va Next 15.5.2'gacha ishlaydi.

**S: Nima uchun TiDB (MySQL) emas, Supabase (PostgreSQL)?**
J: Cloudflare Workers TCP yo'qligi uchun Supabase'ning TCP connection ishlamaydi. TiDB Serverless esa HTTP driver orqali ishlaydi va Cloudflare'ga mos. Supabase'ning HTTP adapteri ham bor (`@supabase/postgrest-js`) lekin Prisma uchun emas.

**S: Vercel + Supabase'ga qaytsam bo'ladimi?**
J: Ha, `prisma/schema.production.prisma` (PostgreSQL) saqlangan. `DEPLOY_TARGET=vercel` bilan build qiling — `next.config.ts` avtomatik moslashadi.

**S: Multi-tenant database qanday ishlaydi?**
J: Bitta TiDB cluster, bitta database (`oshxona_erp`). Har bir restoran `Restaurant` jadvalidagi yozuv orqali ajratiladi (`restaurantId` maydoni barcha jadvallarda bor).

---

## 9️⃣ Fayllar ro'yxati (o'zgartirilgan/yaratilgan)

| Fayl                          | Tavsif                                       |
|-------------------------------|----------------------------------------------|
| `prisma/schema.tidb.prisma`   | **YANGI** — MySQL/TiDB uchun Prisma schema  |
| `src/lib/db.ts`               | **O'zgartirilgan** — TiDB serverless adapter |
| `next.config.ts`              | **O'zgartirilgan** — CF Pages moslashuvi    |
| `package.json`                | **O'zgartirilgan** — Yangi dependency + scriptlar |
| `.env.example`                | **O'zgartirilgan** — TiDB env ko'rsatmalari |
| `.gitignore`                  | **O'zgartirilgan** — `.open-next/` qo'shildi |
| `wrangler.jsonc`              | **YANGI** — Cloudflare Workers config        |
| `open-next.config.ts`         | **YANGI** — OpenNext adapter config          |
| `_routes.json`                | **YANGI** — CF Pages routing (static assets) |
| `DEPLOYMENT-CLOUDFLARE.md`    | **YANGI** — Ushbu hujjat                     |
