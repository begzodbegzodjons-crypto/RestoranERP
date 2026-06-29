# 🚀 OshxonaERP Deployment Guide

Professional Restaurant ERP/CRM/POS — **GitHub + Supabase + Vercel** deployment qo'llanmasi

---

## 📋 Talab qilingan hisoblar

1. **GitHub** - kod saqlash uchun (https://github.com)
2. **Supabase** - PostgreSQL database uchun (https://supabase.com - BEPUL)
3. **Vercel** - hosting va deployment uchun (https://vercel.com - BEPUL)

---

## 1️⃣ QADAM: GitHub ga kod yuklash

```bash
# Loyiha papkasida:
git init
git add .
git commit -m "Initial commit: OshxonaERP"
git branch -M main
git remote add origin https://github.com/USERNAME/oshxona-erp.git
git push -u origin main
```

**Muhim fayllar GitHub'ga yuklanadi:**
- ✅ `prisma/schema.prisma` (SQLite - local dev uchun)
- ✅ `prisma/schema.production.prisma` (PostgreSQL - production uchun)
- ✅ `.env.example` (environment variable namuna)
- ✅ Barcha `src/` kodi

**Yuklanmaydigan fayllar (.gitignore):**
- ❌ `.env` (maxfiy parollar)
- ❌ `db/custom.db` (local database)
- ❌ `node_modules/`

---

## 2️⃣ QADAM: Supabase database yaratish

1. **https://supabase.com** ga kiring (GitHub orqali)
2. **"New Project"** tugmasini bosing
3. Ma'lumotlarni to'ldiring:
   - **Name**: `oshxona-erp` (yoki istalgan)
   - **Database Password**: kuchli parol o'ylab toping va **saqlang** (keyin kerak bo'ladi)
   - **Region**: eng yaqin region (masalan: Frankfurt, Singapore)
4. **"Create new project"** - 2-3 daqiqa kutish
5. Project yaratilgandan so'ng:
   - **Settings** → **Database**
   - **Connection string** bo'limiga o'ting
   - **"Connection pooling"** URL'ini nusxalang (port 6543)
   - Format: `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`

**Muhim:** Vercel serverless uchun **pooler URL** (port 6543) ishlating. To'g'ridan-to'g'ri URL (port 5432) ishlamaydi!

---

## 3️⃣ QADAM: Vercel ga deploy qilish

1. **https://vercel.com** ga kiring (GitHub orqali)
2. **"Add New"** → **"Project"**
3. GitHub repository'ni tanlang (`oshxona-erp`)
4. **Settings** bo'limida:
   - **Framework Preset**: Next.js (avtomatik)
   - **Build Command**: `bun run vercel-build` (yoki `npm run vercel-build`)
   - **Output Directory**: `.next` (avtomatik)
5. **Environment Variables** qo'shing (CRITICAL):

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
   | `DATABASE_PROVIDER` | `postgresql` |

   **Eslatma:** Supabase'dan olingan connection string'da `[PASSWORD]` o'rniga o'zingiz o'ylab topgan parolni qo'ying.

6. **"Deploy"** tugmasini bosing
7. 2-5 daqiqa kutish - deployment tugagandan so'ng URL olasiz:
   `https://oshxona-erp.vercel.app`

---

## 4️⃣ QADAM: Birinchi marta ishga tushirish

Deployment tugagach, Vercel build log'ida quyidagilarni ko'rasiz:
- ✅ `prisma generate` - Prisma client yaratildi
- ✅ `prisma db push` - Supabase'da barcha jadvallar yaratildi
- ✅ `next build` - Next.js build muvaffaqiyatli

Endi sayt tayyor:

### 🔐 Admin panelga kirish:
- URL: `https://oshxona-erp.vercel.app/?adminkod`
- Maxfiy kalit: `Balandtoglar1`

Admin panelda:
1. Aktivatsiya kodlari generatsiya qiling (masalan: 10 dona, 30 kunlik)
2. Restoranlar ro'yxatini ko'ring (kim aktiv, kim bloklangan)
3. Har bir restoran uchun to'liq statistika (taomlar, savdo, daromad)
4. Restoranni bloklash/unblock qilish
5. Restorni kodsiz N kunga aktivlashtirish

### 🏪 Restoran sifatida ro'yxatdan o'tish:
- URL: `https://oshxona-erp.vercel.app/`
- "Ro'yxatdan o'tish" tugmasini bosing
- Restoran ma'lumotlarini kiriting
- 10 kunlik bepul sinov boshlanadi
- Sinov tugagach, @norinkomp telegram orqali aktivatsiya kodi oling

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

Local muhitda ishlash uchun SQLite ishlatamiz (Postgres o'rnatish shart emas):

```bash
# 1. Dependencies o'rnatish
bun install  # yoki npm install

# 2. .env fayl yaratish (avtomatik)
# .env faylida:
# DATABASE_URL=file:./db/custom.db

# 3. Database yaratish
bun run db:push

# 4. Dev server ishga tushirish
bun run dev
```

Local: http://localhost:3000

---

## 🔒 Maxfiylilik (Security)

- `.env` fayl **HECH QACHON** GitHub'ga yuklanmaydi (.gitignore)
- Vercel environment variables shifrlangan holatda saqlanadi
- Supabase password faqat sizda
- Admin parol `Balandtoglar1` - **production'da o'zgartiring!** (src/app/api/admin/login/route.ts faylida)

---

## 📊 Production'da monitoring

### Vercel dashboard:
- **Logs** - har bir API so'rov log'lari
- **Analytics** - traffic, performance
- **Deployments** - har bir deploy tarixi

### Supabase dashboard:
- **Table Editor** - database'ni ko'rish
- **SQL Editor** - SQL so'rovlari
- **Logs** - database log'lari

---

## ❓ Muammolar yuzaga kelsa

### "Database connection error"
- Supabase project pauze bo'lgan bo'lishi mumkin (1 hafta faol emas)
- Connection string to'g'riligini tekshiring

### "Prisma client not generated"
- Vercel build log'ini ko'ring
- `vercel-build` script to'g'ri ishlayotganini tekshiring

### "Activation code not working"
- Admin panelga kirib kod generatsiya qiling
- Kod 8 xonali raqam bo'lishi kerak
- Har kod 1 marta ishlatiladi

### Admin parolni o'zgartirish
- `src/app/api/admin/login/route.ts` faylida `ADMIN_PASSWORD = 'Balandtoglar1'` qatorini o'zgartiring
- GitHub'ga push qiling - Vercel avtomatik yangilanadi

---

## 📞 Yordam

- **Telegram**: @norinkomp
- **GitHub Issues**: repository'da issue oching

---

## 🎯 Xulosa

Deployment tugagach:
1. ✅ Sayt `https://your-project.vercel.app/` da ishlaydi
2. ✅ Supabase PostgreSQL database ishlayapti
3. ✅ Admin panel `/?adminkod` orqali kiriladi
4. ✅ Restoranlar ro'yxatdan o'tishi mumkin
5. ✅ 10 kunlik trial → aktivatsiya kodi → 30 kun to'liq ish
6. ✅ Siz admin panelda barcha restoranlarni boshqarasiz

**Omadsizlik tilaymiz! 🚀**
