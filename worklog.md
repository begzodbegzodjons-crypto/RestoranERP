# OshxonaERP - Worklog

## Task ID: ERP-002 (Update)
**Agent**: Main agent (Super Z)
**Task**: GitHub + Supabase + Vercel deployment uchun moslash + admin panel'ni kengaytirish

## Work Log:
- Tahlil: Foydalanuvchi dasturni GitHub + Supabase + Vercel stack'ida ishlatmoqchi
- Prisma dual-schema yondashuvi:
  - `prisma/schema.prisma` - SQLite (local dev uchun, mavjud)
  - `prisma/schema.production.prisma` - PostgreSQL (Supabase production uchun)
  - Prisma `env()` provider'ni qo'llab-quvvatlamagani uchun ikki fayl yondashuvi tanlandi
- package.json yangilandi:
  - `db:push:prod` - production schema bilan ishlash
  - `db:generate:prod` - production Prisma client generatsiya
  - `vercel-build` - Vercel deployment uchun: prisma generate + db push + next build
- `.env.example` yaratildi - Supabase connection string format bilan
- `.gitignore` yangilandi - .env, db fayllar, test screenshot'lari yuklanmaydi
- `next.config.ts` - Vercel serverless uchun `serverExternalPackages: ["@prisma/client"]` qo'shildi
- `README.md` - to'liq loyiha hujjati
- `DEPLOYMENT.md` - 4 qadamli deployment qo'llanmasi (GitHub → Supabase → Vercel → First run)

### Yangi Admin API'lar:
1. `GET /api/admin/stats` - global admin dashboard statistikasi:
   - Restoranlar: jami/aktiv/sinovda/bloklangan/oylik yangilar
   - Savdo: jami/bugungi/oylik daromad, foyda, buyurtmalar
   - Katalog: jami taomlar, ingredientlar, mijozlar, xodimlar
   - 7-kunlik grafiklar (yangi restoranlar, daromad)
   - Aktivatsiya kodlari statistikasi

2. `GET /api/admin/restaurants/[id]/stats` - bitta restoran to'liq statistikasi:
   - Restoran ma'lumotlari (admin maydonlari bilan)
   - Countlar: taomlar, ingredientlar, mijozlar, xodimlar, stollar, kategoriya, yetkazib beruvchilar
   - Savdo aggregations: jami/bugungi/oylik daromad, foyda, COGS, buyurtmalar
   - Oylik xarajatlar, kirim summasi, sof foyda
   - Ombor qiymati, tugagan mahsulotlar
   - Top 10 mahsulotlar (30 kun)
   - So'nggi 10 savdo
   - 14-kunlik kunlik daromad grafigi
   - To'lov turlari bo'yicha taqsimot

3. `POST /api/admin/restaurants/[id]/block` - restoranni admin bloklash
   - Body: { reason?: string }
   - Barcha sessiyalarni o'chiradi (force logout)
   - AdminLog'ga yoziladi

4. `DELETE /api/admin/restaurants/[id]/block` - blokdan chiqarish
   - Avtomatik yangi holat belgilaydi (aktiv/sinov/blok)

5. `POST /api/admin/restaurants/[id]/activate` - admin tomonidan kodsiz aktivlashtirish
   - Body: { days: number, note?: string }
   - Agar hozir aktiv bo'lsa - kunlar qo'shiladi (extension)
   - Aks holda - yangidan boshlab N kun aktivlashtiriladi
   - AdminLog'ga yoziladi

6. `GET /api/admin/restaurants` (yangilandi) - endi har restoran uchun:
   - stats: products, ingredients, customers, sales, totalRevenue, totalProfit
   - access: to'liq holat (admin blok, daysLeft, message)

### Auth mantiqi yangilandi:
- `getAccessStatus()` funksiyasi endi `blockedByAdmin` maydonini tekshiradi
- Admin bloki eng yuqori ustuvorlikka ega (aktivatsiya/trial'dan ustun)
- BlockedScreen admin sababini ko'rsatadi

### AdminPanel UI to'liq qayta yozildi:
- 3 ta tab: Umumiy / Restoranlar / Aktivatsiya kodlari
- Umumiy tab:
  - 8 ta katta statistika kartalari (restoranlar, daromad)
  - 7-kunlik grafiklar (yangi restoranlar, daromad)
  - Katalog statistikasi
  - Kodlar holati
- Restoranlar tab:
  - Qidiruv (nom/email/telefon)
  - Holat bo'yicha filter (hammasi/aktiv/sinov/blok)
  - Jadval: restoran, holat, taomlar, savdo, daromad, foyda, qolgan kun, boshqaruv
  - Tez amallar: +30k (tez aktivlashtirish), 🚫 (bloklash), 🔓 (blokdan chiqarish)
  - Restoranni bossangiz - to'liq detail modal ochiladi
- Detail modal:
  - Gradient header (restoran nomi, holat, qolgan kun)
  - Admin blok ogohlantirishi (agar bloklangan bo'lsa)
  - 8 ta statistika kartalari (daromad, foyda, savdo, o'rtacha chek va h.k.)
  - 6 ta katalog countlari (taomlar, kategoriya, ombor, mijozlar, xodimlar, stollar)
  - Ombor qiymati va tugagan mahsulotlar soni
  - 14-kunlik daromad grafigi
  - Top 10 mahsulotlar
  - So'nggi 10 savdo
  - Boshqaruv bo'limi:
    - Kodsiz aktivlashtirish formasi (kun + izoh)
    - Bloklash/Blokdan chiqarish tugmasi
    - Admin izohlari (agar bo'lsa)

### Test natijalari (agent-browser):
- ✅ Admin login ishlaydi (Balandtoglar1)
- ✅ Umumiy tab to'liq ko'rinmoqda (statistika, grafiklar)
- ✅ Restoranlar ro'yxati statistika bilan ko'rinmoqda
- ✅ Restoran detali modal to'liq ishlamoqda
- ✅ Bloklash funksiyasi ishlaydi (prompt bilan sabab so'raydi)
- ✅ Bloklangan foydalanuvchi tizimga kirsa - blok ekrani ko'rinadi
- ✅ Kodsiz aktivlashtirish 60 kunga ishladi
- ✅ Aktivlashtirilgan foydalanuvchi dashboard'ga kirdi
- ✅ Qolgan kun to'g'ri yangilandi (60k)
- ✅ Lint: 0 xato
- ✅ Dev log: 0 runtime error

## Stage Summary:
- Loyiha to'liq GitHub + Supabase + Vercel stack'iga moslashtirildi
- Dual Prisma schema (SQLite local + PostgreSQL production)
- Admin panel to'liq kengaytirildi: global stats, per-restaurant stats, block/unblock, manual activation
- Batafsil deployment hujjati (DEPLOYMENT.md) yaratildi
- Production build script (`vercel-build`) qo'shildi
- Auth mantiqi admin blokirovkasini qo'llab-quvvatlaydi
- Barcha yangi funksiyalar browser testlari orqali verified
