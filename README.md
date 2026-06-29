# 🍽️ OshxonaERP — Restoran Boshqaruv Tizimi

Professional **ERP + CRM + POS** dasturi oshxona va restoranlar uchun. Zamonaviy dizayn, avtomatlashtirilgan hisob-kitob va to'liq boshqaruv tizimi.

![Tech Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Prisma](https://img.shields.io/badge/Prisma-PostgreSQL-green) ![Tailwind](https://img.shields.io/badge/Tailwind-4-cyan)

## ✨ Asosiy funksiyalar

### 🏪 Restoran egasi uchun:
- **POS Kassa** — mahsulot tanlash, savatcha, to'lov (naqd/karta/o'tkazma)
- **Taomlar & Retsept** — har bir taom uchun retsept, avtomatik tannarx hisoblash
- **Ombor boshqaruvi** — ingredientlar, avtomatik kamayish va ogohlantirish
- **Kirim (purchase)** — xomashyo sotib olish, avtomatik omborga qo'shish
- **Savdo tarixi** — cheklar, foyda hisobi
- **CRM** — mijozlar bazasi
- **Xodimlar, Stollar, Yetkazib beruvchilar**
- **Hisobotlar** — kunlik/oylik, kategoriya va mahsulot bo'yicha
- **Dashboard** — real-time statistika

### 🔐 Sayt egasi (Admin) uchun:
- **Maxfiy admin panel**: `/?adminkod` + parol `Balandtoglar1`
- **Restoranlar boshqaruvi**:
  - Barcha restoranlar ro'yxati (statistika bilan)
  - Har bir restoran uchun to'liq hisobot (taomlar soni, savdo, daromad, foyda)
  - Restoranni bloklash / blokdan chiqarish
  - **Kodsiz N kunga aktivlashtirish** (admin tomonidan)
- **Aktivatsiya kodlari generatsiya** — 1-50 dona, 30 kunlik
- **Global dashboard** — barcha restoranlar bo'yicha umumiy statistika

### 💰 Biznes mantiq (avtomatlashtirilgan):
- **Retsept → Tannarx**: ingredientlar miqdori × narx = avtomatik tannarx
- **Savdo → Ombor**: har savdoda retsept bo'yicha ingredientlar avtomatik kamayadi
- **Kirim → Ombor**: weighted average narx bilan stock yangilanadi
- **Foyda hisobi**: har savdoda COGS va sof foyda avtomatik

### 🔑 Sinov va Aktivatsiya tizimi:
- Ro'yxatdan o'tgan foydalanuvchi **10 kun bepul sinov** oladi
- Sinov tugagach dastur **blok holatga** o'tadi
- Foydalanuvchi **@norinkomp** telegram orqali aktivatsiya kodi oladi
- Kod: **8 xonali raqam**, **1 marta ishlatiladi**, **30 kun amal qiladi**
- Boshqa akkauntga ishlamaydi

## 🚀 Texnologiya stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **Backend**: Next.js API Routes (serverless)
- **Database**: PostgreSQL (Supabase) | SQLite (local dev)
- **ORM**: Prisma 6
- **Auth**: PBKDF2 password hashing, session cookies
- **Deployment**: Vercel + Supabase + GitHub

## 📦 Deployment

Batafsil yo'riqnoma: **[DEPLOYMENT.md](./DEPLOYMENT.md)**

Tez boshlash:
1. GitHub'ga kod yuklang
2. Supabase'da PostgreSQL project yarating
3. Vercel'ga import qiling, environment variables qo'shing:
   - `DATABASE_URL` = Supabase pooler connection string
   - `DATABASE_PROVIDER` = `postgresql`
4. Deploy tugagach, sayt tayyor!

## 🛠️ Local Development

```bash
bun install          # yoki npm install
bun run db:push      # SQLite database yaratish
bun run dev          # http://localhost:3000
```

## 📁 Loyiha tuzilishi

```
├── prisma/
│   ├── schema.prisma              # SQLite (local dev)
│   └── schema.production.prisma   # PostgreSQL (Vercel/Supabase)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Main app (auth/dashboard/admin router)
│   │   ├── api/
│   │   │   ├── auth/              # register, login, me, logout
│   │   │   ├── activation/        # activate code
│   │   │   ├── admin/             # admin panel APIs
│   │   │   │   ├── login/
│   │   │   │   ├── codes/         # generate, list codes
│   │   │   │   ├── restaurants/   # list, stats, block, activate
│   │   │   │   └── stats/         # global dashboard
│   │   │   ├── dashboard/         # restaurant dashboard
│   │   │   ├── products/          # + recipes
│   │   │   ├── ingredients/       # inventory
│   │   │   ├── purchases/         # kirim
│   │   │   ├── sales/             # POS + history
│   │   │   ├── customers/         # CRM
│   │   │   ├── staff/, tables/, suppliers/, expenses/
│   │   │   ├── categories/
│   │   │   ├── inventory/         # movement history
│   │   │   └── reports/           # detailed reports
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── erp/                   # Restaurant UI
│   │   │   ├── AuthPage.tsx
│   │   │   ├── BlockedScreen.tsx
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── DashboardView.tsx
│   │   │   ├── POSView.tsx
│   │   │   ├── ProductsView.tsx
│   │   │   ├── IngredientsView.tsx
│   │   │   ├── PurchasesView.tsx
│   │   │   ├── SalesView.tsx
│   │   │   ├── ReportsView.tsx
│   │   │   ├── SettingsView.tsx
│   │   │   └── CrudViews.tsx      # customers, staff, tables, etc.
│   │   └── admin/
│   │       └── AdminPanel.tsx     # Full admin with stats
│   └── lib/
│       ├── db.ts                  # Prisma client
│       ├── auth.ts                # Auth + access status
│       ├── business.ts            # Recipe cost, inventory, sales logic
│       └── admin-auth.ts          # Admin session helper
├── package.json
├── DEPLOYMENT.md
└── .env.example
```

## 🔒 Security

- `.env` fayl GitHub'ga yuklanmaydi
- Parollar PBKDF2 bilan shifrlangan (100000 iterations, SHA-512)
- Session cookies httpOnly
- Multi-tenant: har restoran faqat o'z ma'lumotlarini ko'radi
- Admin parol production'da o'zgartirilsin!

## 📞 Aloqa

- **Telegram**: @norinkomp
- **Litsenziya**: MIT

---

**Made with ❤️ for Uzbekistan restaurants**
