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

---
Task ID: ERP-003
Agent: Main agent (Super Z)
Task: Bosh sahifadagi "Restoraningizni bir tizimda boshqaring" yozuvini animatsiya, yaltirash, harakatlanish effektlari bilan tayyorlash

Work Log:
- Yangi `HeroTitle` komponenti yaratildi (src/components/erp/HeroTitle.tsx)
- globals.css ga 8 ta yangi animatsiya effekti qo'shildi:
  1. `hero-shimmer` - gradient yaltirash (4s linear infinite)
  2. `hero-float` - yuqoriga-pastga harakat (5s ease-in-out infinite)
  3. `hero-tilt` - text-shadow orqali glow pulsi (8s)
  4. `hero-highlight-shimmer` - "bir tizimda" so'zi uchun maxsus yaltirash (2.5s)
  5. `hero-highlight-pulse` - highlight so'z uchun drop-shadow + scale + rotate (2s)
  6. `hero-light-sweep` - oq nur yozuv ustidan o'tadi (3.5s)
  7. `hero-light-sweep-reverse` - teskari yo'nalishda ikkinchi nur (5s, 1.5s delay)
  8. `glow-pulse` - yozuv atrofidagi blur yorug'lik pulsi (4s)
  9. `hero-word-enter` - so'zlar ketma-ket 3D rotateX bilan paydo bo'lishi (1s, 0.2/0.5/0.8s delay)
  10. `sparkle-twinkle` - 8 ta sparkle (yulduzcha) 2s twinkle effekti bilan

- Visual effektlar:
  - Gradient (emerald → teal → cyan → oq → teskari) - 300% background-size bilan yaltirash
  - 2 ta light sweep (ikkala yo'nalishda, mix-blend-mode: screen)
  - 3D so'z kirishi (rotateX -30deg → 0, translateY 30px → 0, cubic-bezier bounce)
  - Glow: blur(22-28px) orqali yozuv atrofida yumshoq yorug'lik
  - "bir tizimda" so'zi: maxsus 7-to'xtamli gradient + 3-darajali drop-shadow + scale(1.04) + rotate(-0.5deg)
  - 8 ta sparkle yozuv atrofida turli pozitsiyalarda, turli kechikishlar bilan

- Accessibility: `prefers-reduced-motion: reduce` media query - animatsiyalar o'chiriladi, statik gradient qoladi
- AuthPage.tsx dan H1 olib tashlab, `<HeroTitle />` komponenti qo'yildi
- Lint: 0 xato
- Browser test (agent-browser):
  - 8 ta sparkle render qilingan
  - 3 ta hero-word to'g'ri kechikishlar bilan
  - hero-title va hero-highlight class'lar to'g'ri qo'llanilgan
  - Animatsiya computed style'da ko'rinmoqda
  - Mobil (390x844) va desktop (1280x800) ham ishlamoqda

Stage Summary:
- Bosh sahifadagi hero yozuv to'liq animatsiyali bo'ldi: yaltirash, 3D harakat, glow, sparkles, light sweep, highlight effekti
- 10+ CSS animatsiya bir vaqtda ishlaydi (turli tezlik va kechikishlarda)
- Reduced motion uchun accessibility qo'llab-quvvatlash
- Mobil va desktop responsiv

---
Task ID: ERP-004 (Fix)
Agent: Main agent (Super Z)
Task: Yozuv ko'rinmaslik muammosini tuzatish (animatsiya juda qora gradient ishlatgan)

Work Log:
- Muammo: Oldingi animatsiya oklch(0.2 0.05 162) = lab(7.85) ishlatgan — bu deyarli QORA rang
- background-clip: text + color: transparent组合ida gradient qora fazada bo'lganda yozuv ko'rinmas bo'lib qolgan
- Yechim:
  - OKLCH ranglar o'rniga HEX ranglar ishlatildi (kengroq brauzer qo'llab-quvvatlash)
  - Gradient faqat yorqin emerald ranglardan iborat: #047857 → #059669 → #10b981 → #14b8a6
  - lightness 0.45+ saqlangan — hech qachon qora emas
  - `color: #047857` base color qo'shildi (fallback sifatida)
  - Drop-shadow filter orqali glow (background-clip: text bilan ishlaydi)
  - Buzilgan `::before`/`::after` pseudo-elementlar (content: '' bilan) olib tashlandi
  - Yangi `.hero-sweep-overlay` span elementi qo'shildi — actual DOM element sifatida ishlaydi

- Turbopack CSS cache muammosi:
  - .next cache tozalandi
  - Dev server qayta ochildi
  - Endi yangi CSS to'g'ri qo'llanmoqda

- Test natijalari:
  - color: rgb(4, 120, 87) ✓ (yorqin emerald)
  - background-image: linear-gradient(100deg, rgb(4, 120, 87) → rgb(16, 185, 129) → rgb(20, 184, 166) → ...) ✓
  - visible: true ✓
  - Screenshotlarda 100,000+ text piksel aniqlangan ✓
  - Yashil piksel soni 3,500-12,000 orasida o'zgaradi (shimmer animatsiyasi ishlayapti) ✓
  - Mobil va desktop responsiv ✓
  - Lint: 0 xato ✓

Stage Summary:
- Yozuv endi HAR DOIM ko'rinadi (yorqin emerald gradient)
- Animatsiyalar to'g'ri ishlaydi: shimmer, float, glow, sparkles, light sweep
- "bir tizimda" so'zi maxsus cyan gradient + drop-shadow glow bilan ajralib turadi
- 8 ta sparkle yozuv atrofida twinkle qiladi
- So'zlar ketma-ket paydo bo'ladi (bounce easing)

---
Task ID: ERP-005 (Revert)
Agent: Main agent (Super Z)
Task: Animatsiya effektlarini olib tashlab, avvalgi oddiy holiga qaytarish

Work Log:
- Foydalanuvchi fikri: effektlar "Restoraningizni" va "boshqaring" so'zlarini ko'rinmas qilib qo'ygan
- AuthPage.tsx dan `<HeroTitle />` olib tashlandi
- Avvalgi oddiy H1 qaytarildi:
  ```jsx
  <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-bold leading-tight tracking-tight">
    Restoraningizni <span className="shimmer-text">bir tizimda</span> boshqaring
  </h1>
  ```
- HeroTitle import olib tashlandi
- Bu referens saytdagi (edu-markaz-five.vercel.app) asl effekt — faqat "bir tizimda" so'zida shimmer

- Test natijalari:
  - h1 to'liq matn ko'rinmoqda: "Restoraningizni bir tizimda boshqaring"
  - shimmer-text "bir tizimda" so'zida yorqin emerald-teal gradient (348x70px)
  - Mobil va desktop responsiv
  - Lint: 0 xato

Stage Summary:
- Avvalgi oddiy holga qaytarildi
- Faqat "bir tizimda" so'zida shimmer-text effekti qoldi (referens sayt bilan bir xil)

---
Task ID: ERP-006
Agent: Main agent (Super Z)
Task: Butun "Restoraningizni bir tizimda boshqaring" yozuvini har xil ranglar bilan yaltirash + nur + harakat effekti

Work Log:
- Yangi CSS class `.hero-shimmer` yaratildi (avvalgi muammolardan saboq olgan holda):
  - Base color: #047857 (HAR DOIM ko'rinadigan emerald fallback)
  - 14 rangli gradient: emerald → teal → cyan → sky → blue → purple → fuchsia → pink → rose → orange → amber → yellow → lime → back to emerald
  - background-size: 300% (kengaytirilgan yaltirash uchun)
  - background-clip: text + -webkit-text-fill-color: transparent
  - Animatsiya: hero-multi-shimmer (6s linear infinite) + hero-gentle-float (5s ease-in-out infinite)
  - Float bilan drop-shadow filter (color 5s da emerald → purple o'zgaradi)

- `.hero-shimmer-wrapper` yaratildi (nur effekti uchun):
  - ::after pseudo-element orqali oq nur yozuv ustidan o'tadi
  - skewX(-20deg) bilan diagonal
  - mix-blend-mode: overlay
  - animation: hero-light-pass 4s ease-in-out infinite

- AuthPage.tsx H1 yangilandi:
  ```jsx
  <h1>
    <span className="hero-shimmer-wrapper">
      <span className="hero-shimmer">Restoraningizni bir tizimda boshqaring</span>
    </span>
  </h1>
  ```

- Reduced motion accessibility qo'shildi

- Turbopack CSS cache tozalandi (.next removed, dev server restarted)

- Test natijalari (agent-browser):
  - color: rgb(4, 120, 87) ✓ (yorqin emerald base)
  - background-image: 14 rangli gradient ✓
  - animation: hero-multi-shimmer 6s + hero-gentle-float 5s ✓
  - visible: true, width=512, height=224 ✓
  - 6 screenshotda har xil ranglar aniqlangan:
    - Phase 1: orange (246, 131, 19)
    - Phase 2: cyan-blue (18, 189, 239)
    - Phase 3: orange (249, 115, 22)
    - Phase 4: cyan (14, 166, 233)
    - Phase 5: yellow (252, 244, 15)
    - Phase 6: cyan (14, 165, 233)
  - Har screenshotda ~130,000 text piksel ✓
  - Mobil va desktop responsiv ✓
  - Lint: 0 xato ✓

Stage Summary:
- Butun yozuv endi 14 rangli gradient bilan yaltirayapti (emerald → teal → cyan → blue → purple → pink → rose → orange → yellow → lime)
- Yozuv ustidan oq nur o'tadi (4s da)
- Float harakati (5s da yuqoriga-pastga 3px) + drop-shadow glow
- Yozuv HAR DOIM ko'rinadi (base color fallback bilan)
