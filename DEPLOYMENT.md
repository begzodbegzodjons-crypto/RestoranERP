# 🚀 OshxonaERP Deployment Guide

Professional Restaurant ERP/CRM/POS — **GitHub + Supabase + Vercel** deployment qo'llanmasi

---

## 📋 Talab qilingan hisoblar

1. **GitHub** - kod saqlash uchun (https://github.com)
2. **Supabase** - PostgreSQL database + Storage (rasmlar) uchun (https://supabase.com - BEPUL)
3. **Vercel** - hosting va deployment uchun (https://vercel.com - BEPUL)

---

## 1️⃣ QADAM: GitHub ga kod yuklash

```bash
git init
git add .
git commit -m "Initial commit: OshxonaERP"
git branch -M main
git remote add origin https://github.com/USERNAME/oshxona-erp.git
git push -u origin main
```

---

## 2️⃣ QADAM: Supabase database + storage yaratish

1. **https://supabase.com** ga kiring (GitHub orqali)
2. **"New Project"** tugmasini bosing
3. Ma'lumotlarni to'ldiring:
   - **Name**: `oshxona-erp`
   - **Database Password**: kuchli parol o'ylab toping va **saqlang**
   - **Region**: eng yaqin region (masalan: Frankfurt, Singapore)
4. **"Create new project"** - 2-3 daqiqa kutish

### Database connection string olish:
1. Project yaratilgandan so'ng: **Settings** → **Database**
2. **Connection string** bo'limiga o'ting
3. **"Connection pooling"** URL'ini nusxalang (port 6543)
4. Format: `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`

### Supabase Storage bucket yaratish (rasmlar uchun):
1. Supabase dashboard → **Storage** bo'limi
2. **"New bucket"** tugmasini bosing
3. Bucket ma'lumotlari:
   - **Name**: `product-images`
   - **Public bucket**: ✅ (yoqilgan - rasmlar public URL orqali ko'rinadi)
4. **"Create bucket"** tugmasini bosing

### Supabase API kalitlarini olish:
1. **Settings** → **API** bo'limiga o'ting
2. Quyidagilarni nusxalang:
   - **Project URL**: `https://[project-ref].supabase.co`
   - **service_role key**: `eyJhbGciOi...` (MAXFIY - hech kimga bermang!)

---

## 3️⃣ QADAM: Vercel ga deploy qilish

1. **https://vercel.com** ga kiring (GitHub orqali)
2. **"Add New"** → **"Project"**
3. GitHub repository'ni tanlang (`oshxona-erp`)
4. **Settings** bo'limida:
   - **Framework Preset**: Next.js (avtomatik)
   - **Build Command**: `bun run vercel-build` (yoki `npm run vercel-build`)
   - **Output Directory**: `.next` (avtomatik)
5. **Environment Variables** qo'shing (MUHIM!):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `SUPABASE_URL` | `https://[project-ref].supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (service_role key) |
   | `SUPABASE_BUCKET_NAME` | `product-images` |

6. **"Deploy"** tugmasini bosing
7. 2-5 daqiqa kutish - deployment tugagandan so'ng URL olasiz

---

## 4️⃣ QADAM: Birinchi marta ishga tushirish

Deployment tugagach, Vercel build log'ida quyidagilarni ko'rasiz:
- ✅ `prisma generate` - Prisma client yaratildi
- ✅ `prisma db push` - Supabase'da barcha jadvallar yaratildi
- ✅ `next build` - Next.js build muvaffaqiyatli

### 🔐 Admin panelga kirish:
- URL: `https://your-project.vercel.app/?adminkod`
- Maxfiy kalit: `Balandtoglar1`

### 🏪 Restoran sifatida ro'yxatdan o'tish:
- URL: `https://your-project.vercel.app/`
- "Ro'yxatdan o'tish" tugmasini bosing
- 10 kunlik bepul sinov boshlanadi

---

## 📦 Ma'lumotlar qayerda saqlanadi?

### 100% Supabase cloud'ida — local saqlanmaydi!

| Ma'lumot turi | Qayerda saqlanadi |
|---------------|-------------------|
| **Database** (restoranlar, taomlar, savdo, xodimlar, ...) | Supabase PostgreSQL |
| **Taom rasmlari** | Supabase Storage (cloud) |
| **Foydalanuvchi sessiyalari** | Supabase PostgreSQL (Session table) |
| **Boshqa fayllar** | Local saqlanmaydi |

### Rasmlar qanday ishlaydi?
- **Production (Vercel + Supabase)**: Rasmlar Supabase Storage'ga yuklanadi
  - URL format: `https://[project-ref].supabase.co/storage/v1/object/public/product-images/product-xxx.jpg`
  - Avtomatik 800×800 px resize, JPEG 85% compress
- **Local dev (Supabase yo'q)**: Rasmlar base64 sifatida DB'da saqlanadi
  - Avtomatik fallback ishlaydi

### Ofitsiant va kassa alohida kompyuterda:
- Ofitsiant kompyuteri → brauzer → Vercel → Supabase
- Kassa kompyuteri → brauzer → Vercel → Supabase
- Ma'lumotlar real vaqtda sinxronlanadi (har ikkala kompyuter Supabase'ga ulanadi)
- Local hech narsa saqlanmaydi — 100% cloud

---

## 🔄 Keyingi yangilanishlar (Update)

GitHub'ga kod push qilish kifoya - Vercel avtomatik rebuild qiladi:

```bash
git add .
git commit -m "Update: new feature"
git push
```

---

## 🛠️ Local Development (qisqacha)

Local muhitda ishlash uchun SQLite ishlatamiz (Supabase o'rnatish shart emas):

```bash
bun install          # yoki npm install
bun run db:push      # SQLite database yaratish
bun run dev          # http://localhost:3000
```

Local'da rasmlar base64 sifatida DB'da saqlanadi (Supabase Storage yo'qligi uchun).

---

## 🔒 Maxfiylilik (Security)

- `.env` fayl **HECH QACHON** GitHub'ga yuklanmaydi (.gitignore)
- Vercel environment variables shifrlangan holatda saqlanadi
- Supabase service_role key faqat server'da ishlatiladi (client'ga yuborilmaydi)
- Admin parol `Balandtoglar1` - **production'da o'zgartiring!**

---

## ❓ Muammolar yechimi

### "Database connection error"
- Supabase project pauze bo'lgan bo'lishi mumkin (1 hafta faol emas)
- Connection string to'g'riligini tekshiring (port 6543 pooler)

### "Rasm yuklanmayapti"
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME` to'g'ri sozlanganini tekshiring
- Supabase Storage'da `product-images` bucket yaratilganini tekshiring
- Bucket **Public** bo'lishi kerak

### "Prisma client not generated"
- Vercel build log'ini ko'ring
- `vercel-build` script to'g'ri ishlayotganini tekshiring

---

## 📞 Yordam

- **Telegram**: @norinkomp
- **GitHub Issues**: repository'da issue oching

---

**Omadsizlik tilaymiz! 🚀**
