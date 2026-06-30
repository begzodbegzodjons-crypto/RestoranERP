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

---
Task ID: ERP-007 (Verification)
Agent: Main agent (Super Z)
Task: Admin panelida restoranlarni bloklash va aktivlashtirish funksiyasini tekshirish (dizaynga tegmasdan)

Work Log:
- Tekshirildi: Admin panelida bloklash va aktivlashtirish funksiyalari allaqachon mavjud ekan
- Dizaynga HECH NARSA o'zgartirilmadi (foydalanuvchi talabi)

### Mavjud funksiyalar (hammasi ishlaydi):

#### 1. Restoranlar ro'yxatida (jadval):
- `+30k` tugmasi — 1 bosishda 30 kunga aktivlashtirish (tez amal)
- `🚫` tugmasi — bloklash (prompt bilan sabab so'raydi)
- `🔓` tugmasi — blokdan chiqarish (faqat bloklangan restoranlar uchun)

#### 2. Restoran detali modalida (⚙️ Boshqaruv bo'limi):
- `Aktivlashtirish formasi` — to'liq forma:
  - Kun soni (1-3650, default 30)
  - Izoh maydoni (ixtiyoriy)
  - "✓ N kunga aktivlashtirish" tugmasi
- `🚫 Bloklash` tugmasi — sabab bilan bloklash
- `🔓 Blokdan chiqarish` tugmasi (bloklangan restoranlar uchun)

### API endpointlar (hammasi ishlaydi):
- `POST /api/admin/restaurants/[id]/block` — bloklash (sabab bilan, sessiyalar o'chiriladi)
- `DELETE /api/admin/restaurants/[id]/block` — blokdan chiqarish
- `POST /api/admin/restaurants/[id]/activate` — kodsiz N kunga aktivlashtirish (extension bilan)
- `GET /api/admin/restaurants/[id]/stats` — to'liq statistika
- `GET /api/admin/restaurants` — barcha restoranlar statistika bilan

### Test natijalari (browser orqali verified):
- ✅ Anor restorani bloklandi: ⏱ Sinov → 🚫 Admin blok
- ✅ Blokdan chiqarildi: 🚫 Admin blok → ⏱ Sinov
- ✅ 60 kunga aktivlashtirildi: ⏱ Sinov → ✓ Aktiv (60k qoldi)
- ✅ Aktivatsiya sanasi: 28/08/2026 (to'g'ri hisoblandi)
- ✅ Detail modal to'liq ishlamoqda (statistika + boshqaruv)
- ✅ Aktivlashtirish formasi ishlamoqda (kun + izoh)
- ✅ Lint: 0 xato

Stage Summary:
- Dizaynga HECH NARSA o'zgartirilmadi
- Bloklash funksiyasi ishlaydi (sabab bilan, force logout bilan)
- Aktivlashtirish funksiyasi ishlaydi (N kunga, extension bilan)
- Blokdan chiqarish funksiyasi ishlaydi
- Barcha funksiyalar ro'yxatda va detail modalda mavjud

---
Task ID: ERP-008
Agent: Main agent (Super Z)
Task: Staff (ofitsiant/kassir) POS tizimi - PIN login, buyurtma yuborish, to'lov qabul qilish, chek chop etish, ofitsiant xizmati %

Work Log:
- Prisma schema yangilandi:
  - Restaurant: serviceChargePercent Float @default(0.0) - ofitsiant xizmati foizi
  - Staff: pin String? (4-6 raqamli PIN) + passwordHash String?
  - Yangi model: StaffSession (staff uchun alohida session)
  - Yangi model: Order (ofitsiant yuboradi, kassir yopadi)
  - Yangi model: OrderItem (buyurtma elementlari)
  - RestaurantTable: orders relation qo'shildi
  - Product: orderItems relation qo'shildi
  - Production schema (PostgreSQL) ham yangilandi
  - Prisma client regenerate qilindi

- Yangi lib/staff-auth.ts:
  - generateStaffToken, createStaffSession, getCurrentStaff, deleteStaffSession

- Yangi API endpointlar (8 ta):
  1. POST /api/staff/login - PIN bilan kirish
  2. GET/POST /api/staff/me - joriy staff va logout
  3. GET/POST /api/staff/orders - buyurtma ro'yxati va yangi buyurtma yuborish
  4. GET/DELETE /api/staff/orders/[id] - bitta buyurtma va bekor qilish
  5. POST /api/staff/orders/[id]/pay - kassir to'lov qabul qiladi (Sale yaratadi, inventory consume, chek tayyor)
  6. GET /api/staff/tables - stollar + openOrder bilan
  7. GET /api/staff/products - mahsulotlar POS uchun
  8. GET/PUT /api/staff/settings - service charge foizini sozlash

- Staff API (CRUD) yangilandi:
  - POST /api/staff - PIN qo'shish (ofitsiant/kassir uchun majburiy, unique)
  - PUT /api/staff/[id] - PIN yangilash

- Yangi UI komponentlar:
  1. StaffMode.tsx - asosiy staff POS tizimi:
     - StaffLogin: PIN kiritish ekrani (number pad, 4-6 raqam)
     - WaiterView: stol tanlash → menyu → savatcha → buyurtma yuborish
     - CashierView: band stollar ko'rinishi → to'lov modal → chek
     - ReceiptModal: chek chop etish (window.print orqali)

  2. DashboardLayout.tsx ga "👤 Xodim kirishi (POS)" tugmasi qo'shildi
  3. SettingsView ga "💼 Ofitsiant xizmati foizi" sozlamasi qo'shildi
  4. StaffView (CrudViews) ga PIN maydoni qo'shildi

- Avtomatik hisob-kitob:
  - Ofitsiant buyurtma yuborganda: subtotal + serviceCharge% avtomatik hisoblanadi
  - Kassir to'lov qabul qilganda: Sale yozuvi yaratiladi, inventory consume qilinadi, stol free bo'ladi
  - Sale da: waiter, cashier, sana, soat, paymentMethod - hammasi saqlanadi
  - Chek: restoran nomi, chek #, stol, sana, ofitsiant, kassir, mahsulotlar, summa, xizmat foizi

- Chek formati (80mm termal printer uchun):
  - Restoran nomi (katta)
  - Stol, sana, chek #
  - Ofitsiant, Kassir
  - Mahsulotlar ro'yxati (nomi, miqdor, narx, summa)
  - Oraliq, xizmat foizi, chegirma, jami
  - To'lov turi va summasi
  - "Rahmat! Yana keling!"

- Test natijalari (API + browser):
  1. ✅ Ofitsiant PIN 1234 bilan kirdi (Akmal Ofitsiant)
  2. ✅ Stol tanlab, 4× Manti buyurtma yubordi (100,000 + 10% = 110,000 UZS)
  3. ✅ Stol "occupied" holatga o'tdi
  4. ✅ Kassir PIN 5678 bilan kirdi (Bekzod Kassir)
  5. ✅ Band stol ko'rindi (ofitsiant, vaqt, summa bilan)
  6. ✅ To'lov qabul qilindi - chek INV-20260629-3924
  7. ✅ Sale ERP tarixiga yozildi (110,000 UZS, foyda 82,400 UZS)
  8. ✅ Stol yana "free" bo'ldi
  9. ✅ Chek chop etish tugmasi ishlamoqda (window.print)
  10. ✅ Ofitsiant xizmati 10% avtomatik qo'shildi
  11. ✅ Lint: 0 xato

Stage Summary:
- To'liq POS tizimi yaratildi:
  - Ofitsiant PIN bilan kirib, stol tanlab, menyudan taom tanlab, buyurtma yuboradi
  - Kassir PIN bilan kirib, band stollarni ko'rib, to'lov qabul qiladi
  - Chek printerda chop etiladi (ofitsiant, kassir, taomlar, summa bilan)
  - Ofitsiant xizmati % sozlamalardan avtomatik to'lovga qo'shiladi
  - Hammasi ERP sales tarixiga yoziladi (sana, soat, ofitsiant, kassir)

---
Task ID: ERP-009
Agent: Main agent (Super Z)
Task: Professional ERP darajaga ko'tarish - 8 ta yangi modul qo'shish (mavjud funksiyalarni yo'qotmasdan)

Work Log:
- Mavjud funksiyalar SAQLANDI - hech narsa o'zgartirilmadi
- Prisma schema'ga 5 ta yangi model qo'shildi:
  1. Shift - kassir smenasi (open/close, opening/closing cash, Z-otchet)
  2. Reservation - stol rezervatsiyasi (status: pending/confirmed/seated/cancelled/no_show)
  3. Coupon - chegirma kuponlari (percent/fixed, maxUses, validUntil)
  4. CustomerDebt - mijoz qarzlari (amount, paidAmount, remaining, status)
  5. Notification - bildirishnomalar (type, audience, isRead)

- Restaurant modeliga qo'shildi:
  - vatRate Float (QQS solig'i %)
  - telegramBotToken, telegramChatId (Telegram bot uchun)

- Customer modeliga qo'shildi:
  - loyaltyPoints Int (loyalty dasturi ballari)
  - birthday DateTime

- Order modeliga qo'shildi:
  - kitchenStatus (new/cooking/ready/served) - KDS uchun
  - kitchenStartedAt, kitchenReadyAt - vaqt kuzatuvi
  - shiftId - smenaga bog'lash

- Yangi API endpointlar (15+ ta):
  - /api/shifts (GET, POST) - smena ro'yxati va ochish
  - /api/shifts/current (GET) - joriy smena + live totals
  - /api/shifts/close (POST) - smena yopish + Z-otchet
  - /api/reservations (GET, POST) + /api/reservations/[id] (PUT, DELETE)
  - /api/coupons (GET, POST) + /api/coupons/[id] (PUT, DELETE)
  - /api/coupons/[id]/validate (POST) - kupon validatsiyasi
  - /api/customer-debts (GET, POST) + /api/customer-debts/[id] (PUT, DELETE)
  - /api/customer-debts/[id]/pay (POST) - qarz to'lash
  - /api/kitchen/orders (GET) - oshpaz uchun buyurtmalar
  - /api/kitchen/orders/[id] (PUT) - kitchen status o'zgartirish
  - /api/export/sales, /api/export/products, /api/export/customals - CSV eksport
  - /api/notifications (GET) + /api/notifications/[id]/read (POST)
  - /api/audit-logs (GET) - admin harakatlar tarixi

- staff/settings API yangilandi: vatRate, telegramBotToken, telegramChatId qo'shildi

- Yangi UI komponentlar:
  1. ShiftsView - smena ochish/yopish + Z-otchet modal (kassir summasi, farq, ortiqcha/yo'qotish)
  2. KitchenDisplayView - oshpaz ekrani (kartochkalar, auto-refresh 10s, status tugmalari)
  3. ExportView - eksport markazi (3 ta: sales, products, customers CSV)
  4. NotificationsView - bildirishnomalar (filter, mark read, type-based colors)
  5. ReservationsView, CouponsView, DebtsView (CrudViews.tsx ga qo'shildi)

- DashboardLayout yangilandi:
  - 22 ta modul (avval 14 ta edi)
  - Yangi sidebar bo'limlari: Marketing (Kuponlar, Rezervatsiyalar)
  - Boshqaruv'ga: Smenalar, Oshpaz ekrani, Eksport qo'shildi
  - Asosiy'ga: Bildirishnomalar qo'shildi

- SettingsView yangilandi:
  - 🏛️ QQS solig'i foizi sozlamasi
  - 📱 Telegram bot integratsiyasi (Bot Token + Chat ID)

- Test natijalari (API + browser verified):
  ✅ Smena ochish: 50,000 UZS boshlang'ich
  ✅ Smena yopish: 55,000 haqiqiy, farq +5,000 (ortiqcha)
  ✅ Z-otchet to'liq ma'lumot bilan
  ✅ KDS workflow: new → cooking (kitchenStartedAt) → ready (kitchenReadyAt)
  ✅ Kupon validatsiyasi: 100,000 + 25% = 25,000 chegirma
  ✅ Qarz yaratish: 150,000 UZS
  ✅ Qarz to'lash: 50,000 → status partial, qolgan 100,000
  ✅ Export sales CSV (UTF-8 BOM bilan - Excel da o'zbek harflari to'g'ri)
  ✅ Export products CSV
  ✅ Notifications: 4 ta (debt, kitchen_ready, reservation)
  ✅ Barcha 22 ta modul sidebar'da ko'rinmoqda
  ✅ Lint: 0 xato

Stage Summary:
- Mavjud funksiyalar yo'qotilmadi
- 8 ta yangi professional modul qo'shildi
- 22 ta modul bilan to'liq enterprise ERP
- 15+ yangi API endpoint
- 5 ta yangi Prisma model
- Production schema (PostgreSQL) ham yangilandi

---
Task ID: ERP-010
Agent: Main agent (Super Z)
Task: Xonalar (Rooms) modulini qo'shish - Zal, VIP, Tashqi bo'yicha stollarni guruhlash

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- Prisma schema'ga yangi model qo'shildi:
  - Room: id, restaurantId, name, description, color, sortOrder, isActive
  - RestaurantTable ga roomId qo'shildi (ixtiyoriy, xonaga bog'lanish)
  - Restaurant ga rooms relation qo'shildi
  - Production schema (PostgreSQL) ham yangilandi

- Yangi API endpointlar:
  - GET /api/rooms - xonalar ro'yxati (stollar soni bilan)
  - POST /api/rooms - yangi xona yaratish
  - PUT /api/rooms/[id] - xona yangilash
  - DELETE /api/rooms/[id] - xona o'chirish (stollarni avtomatik xonasiz qiladi)
  - GET /api/tables (yangilandi) - room ma'lumoti bilan
  - POST /api/tables (yangilandi) - roomId qo'shish
  - PUT /api/tables/[id] (yangilandi) - roomId yangilash
  - GET /api/staff/tables (yangilandi) - room bilan + rooms ro'yxati

- Yangi UI:
  1. RoomsView (CrudViews ga qo'shildi) - xonalar CRUD:
     - Nomi, tavsif, rang (7 ta: emerald, blue, purple, amber, rose, cyan, slate)
     - Tartib raqami, faol/nofaol
     - Stollar soni ko'rinadi
     - Rangli dot indicator
  
  2. TablesViewWithRooms (CrudViews ga qo'shildi) - stollar bilan:
     - Room filter tugmalari (Hammasi, Asosiy zal, VIP xona, ...)
     - Har stol uchun xona nomi va rangi ko'rinadi
     - Yangi stol qo'shganda xona tanlash mumkin
  
  3. DashboardLayout yangilandi:
     - Boshqaruv bo'limiga "🏠 Xonalar (Zal/VIP)" qo'shildi
     - Stollar moduli endi TablesViewWithRooms ishlatadi
  
  4. StaffMode (WaiterView + CashierView) yangilandi:
     - Room filter tugmalari (🏠 Hammasi, xonalar...)
     - Har stol kartochkasida xona nomi va rangi
     - Ofitsiant faqat bir xonaning stollarini ko'radi (filter orqali)
     - Kassir ham xona bo'yicha filterlay oladi

- Tailwind config'ga safelist qo'shildi - dinamik bg-${color}-500 class'lari ishlashi uchun

- Test natijalari (API + browser verified):
  ✅ Asosiy zal (emerald) yaratildi - 3 ta stol
  ✅ VIP xona (purple) yaratildi - 2 ta stol
  ✅ Stol 1, 2, 3 → Asosiy zal ga bog'landi
  ✅ VIP-1 (8 kishi), VIP-2 (10 kishi) → VIP xona ga bog'landi
  ✅ RoomsView da xonalar ko'rinmoqda (rang, stollar soni)
  ✅ TablesView da har stol uchun xona nomi ko'rinmoqda
  ✅ Waiter panelida room filter ishlamoqda (Hammasi / Asosiy zal / VIP xona)
  ✅ VIP filter faqat VIP stollari ko'rsatmoqda
  ✅ Cashier panelida ham room filter
  ✅ Lint: 0 xato

Stage Summary:
- Mavjud funksiyalar yo'qotilmadi
- Yangi Room modeli va 4 ta API endpoint qo'shildi
- 3 ta UI yangilandi (RoomsView, TablesViewWithRooms, StaffMode)
- Restoran endi xonalarga ega: Zal, VIP, Tashqi terassa, ...
- Har xonada o'z stollari, ofitsiant va kassir xona bo'yicha filterlay oladi

---
Task ID: ERP-011
Agent: Main agent (Super Z)
Task: Biznes analitikasi (BI) + Tashqi integratsiyalar (1C, Maps)

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- 7 ta yangi API endpoint yaratildi:

### Biznes analitikasi (5 ta):
1. GET /api/analytics/hourly - soatlik savdo grafigi
   - 24 soatlik grid, eng band soatlar (TOP 3)
   - Kun davomida tahlil: Ertalab/Tushdan keyin/Kechqurun/Tunda
   - Avtomatik peak hour aniqlash

2. GET /api/analytics/profitable-dishes - eng foydali taomlar
   - Top profitable (foyda bo'yicha)
   - Top margin (marja % bo'yicha)
   - Top selling (sotilgan miqdor bo'yicha)
   - Least profitable (eng kam foydali - ogohlantirish)

3. GET /api/analytics/customer-behavior - mijoz xatti-harakatlari
   - Returning customers (2+ buyurtma)
   - Retention rate (%)
   - VIP mijozlar (500,000+ sarflagan)
   - Churn risk (30+ kun kelmagan)
   - O'rtacha buyurtmalar orasi (kunlarda)
   - Frequency distribution (1 marta, 2-3, 4-10, 10+)
   - Top spenders (TOP 10)

4. GET /api/analytics/forecast - oylik trend va prognoz (OTS)
   - 6 oylik tarixiy ma'lumot
   - OTS (Oddiy Trend Satri) - linear regression
   - Keyingi 3 oy prognoz
   - Trend direction: growing/declining/stable
   - Oylik o'sish sur'ati (%)
   - Mavsumiylik tahlili (Qish/Bahor/Yoz/Kuz)

5. GET /api/analytics/ab-tests - narx A/B test (avtomatik)
   - Mahsulot narxi o'zgartirilgan sanani topib
   - 14 kun oldin vs 14 kun keyin savdoni solishtiradi
   - Narx o'zgarishi %, miqdor o'zgarishi %, daromad o'zgarishi %
   - Talab elastikligi (elasticity)
   - Avtomatik tavsiyalar (success/danger/warning/neutral)

### Tashqi integratsiyalar (2 ta):
6. GET /api/integrations/1c-export - 1C Buxgalteriya uchun XML eksport
   - CommerceML 2.0 formatida (1C da import qilinadi)
   - Rus tilidagi teglar (KommercheskayaInformatsiya, Dokument, Tovary)
   - Savdo hujjatlari (chek raqami, sana, summa, QQS)
   - Xarajatlar (kategoriya, summa)
   - Xaridlar (yetkazib beruvchi, ingredientlar)
   - Avtomatik QQS hisoblash (vatRate dan)

7. POST /api/integrations/maps - Yandex/Google Maps integratsiyasi
   - Restoran manzili -> mijoz manzili marshrut
   - Yandex Maps URL + embed
   - Google Maps URL + embed
   - To'g'ridan-to'g'ri app da ochish linklari

- Yangi UI komponentlar:
  1. AnalyticsView.tsx - BI dashboard (5 tab bilan):
     - HourlyAnalytics: 24 soatlik grafik, kun qismlari, TOP 3 band soatlar
     - ProfitableDishes: 4 ro'yxat (foyda, marja, sotuv, kam foydali)
     - CustomerBehavior: retention, VIP, churn, frequency, top spenders
     - ForecastAnalytics: trend banner, OTS grafik, o'sish sur'ati, mavsumiylik
     - ABTestsAnalytics: narx o'zgartirish natijalari, tavsiyalar
  
  2. IntegrationsView.tsx - integratsiyalar markazi:
     - 1C Buxgalteriya eksport (sana oralig'i tanlash, XML yuklab olish)
     - Yandex/Google Maps (mijoz manzili -> xarita + marshrut)
     - Tezkor linklar (Telegram bot, 1C dokumentatsiyasi)
     - Maps modal: iframe preview, app da ochish tugmalari

- DashboardLayout yangilandi:
  - Asosiy bo'limiga "📈 Biznes analitikasi" qo'shildi
  - Boshqaruv'ga "🔌 Integratsiyalar" qo'shildi
  - Endi jami 24 ta modul (avval 22 ta edi)

- Test natijalari (API + browser verified):
  ✅ Hourly: totalSales=320,000, peakHour=10:00
  ✅ Profitable: Manti 82.4% marja, 247,200 foyda
  ✅ Forecast: trend=growing, nextMonth=213,333 UZS, bestSeason=Bahor
  ✅ AB-tests: 0 results (narx o'zgartirilmagan)
  ✅ 1C export: Rus tilidagi XML (CommerceML 2.0)
  ✅ Maps: Yandex + Google URL va embed'lar
  ✅ AnalyticsView 5 tab ishlamoqda
  ✅ IntegrationsView 1C + Maps ishlamoqda
  ✅ Maps modal: manzil kiritib xarita yaratildi
  ✅ Lint: 0 xato

Stage Summary:
- Mavjud 22 ta modul yo'qotilmadi
- 2 ta yangi modul qo'shildi (Biznes analitikasi, Integratsiyalar)
- 7 ta yangi API endpoint
- Avtomatik tahlil: soatlik, foyda, mijozlar, prognoz, A/B test
- Tashqi integratsiyalar: 1C Buxgalteriya (XML), Yandex/Google Maps
- Endi jami 24 ta professional modul

---
Task ID: ERP-012
Agent: Main agent (Super Z)
Task: Professional Menyu bo'limi - kartochkali ko'rinish + rasm yuklash (jpg)

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- Yangi API: /api/upload/product-image
  - Sharp bilan rasmni 800x800 px ga resize (cover, center)
  - JPEG quality 85 ga compress
  - Base64 data URL sifatida qaytarish (local + Vercel da ishlaydi)
  - Maks 10MB, faqat image/ type

- Yangi UI: MenuView.tsx - professional menyu boshqaruvi
  - Kategoriya boshqaruvi (qo'shish/tahrirlash/o'chirish)
  - Kategoriya filter tabs (har birida taomlar soni)
  - Qidiruv funksiyasi
  - Kartochkali grid (2-6 columns responsiv)
  - Har kartochkada:
    - Rasm (aspect-square, object-cover) - to'liq moslashgan
    - Kategoriya badge (yuqori chap)
    - Mavjud emas badge (agar isAvailable=false)
    - Hover da edit/delete tugmalari (yuqori o'ng)
    - Taom nomi, narxi, tannarx, foyda
  - Taom qo'shish formasi:
    - Rasm yuklash (clickable area, JPG/PNG/WebP)
    - Rasm preview (32x32 with upload/remove)
    - Avtomatik resize (800x800, JPEG 85)
    - Taom nomi, tavsif, kategoriya, narx, birlik
    - Mavjudlik checkbox
  - Kategoriya formasi (nomi, tavsif)

- DashboardLayout yangilandi:
  - "📋 Menyu (rasmli)" moduli qo'shildi (Mahsulotlar bo'limida)
  - Endi jami 25 ta modul

- WaiterView (StaffMode) yangilandi:
  - Taom kartochkalarida rasm ko'rinadi (aspect-square)
  - Rasm bo'lmagan taomlar uchun 🍽️ emoji
  - Grid 2-4 columns (responsiv)

- POSView yangilandi:
  - Taom kartochkalarida rasm ko'rinadi (aspect-square)
  - Rasm + nom + narx + tannarx

- Yangi API: /api/categories/[id] (PUT, DELETE) - kategoriya tahrirlash/o'chirish

- Test natijalari (API + browser verified):
  ✅ Rasm yuklash: 200x200 PNG → 800x800 JPEG base64 (623 chars)
  ✅ Palov rasmi bilan yaratildi
  ✅ Shashlik "Issiq taomlar" kategoriyasiga qo'shildi
  ✅ MenuView: 6 ta taom kartochkada ko'rinmoqda
  ✅ MenuView: kategoriya filter (Hammasi 6, Issiq taomlar 1)
  ✅ POS: 2 ta rasmli taom ko'rinmoqda
  ✅ WaiterView: 2 ta rasmli taom ko'rinmoqda
  ✅ Lint: 0 xato

Stage Summary:
- Mavjud 24 ta modul yo'qotilmadi
- 1 ta yangi modul (Menyu) + rasm yuklash funksiyasi
- Endi jami 25 ta professional modul
- Menyu, POS, va Ofitsiant panelida taom rasmlari ko'rinadi

---
Task ID: ERP-013
Agent: Main agent (Super Z)
Task: 100% ma'lumot Supabase cloud'ida saqlanishi - local saqlash yo'q

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- Tekshirildi: src/app/api/ da hech qanday local file write yo'q
- @supabase/supabase-js o'rnatildi

- Yangi: src/lib/supabase-storage.ts - Supabase Storage helper:
  - getSupabase() - Supabase client (env yo'q bo'lsa null)
  - isSupabaseStorageEnabled() - Supabase Storage yoqilganmi
  - uploadToSupabaseStorage(buffer, fileName) - rasm yuklash
  - deleteFromSupabaseStorage(fileName) - rasm o'chirish

- /api/upload/product-image yangilandi:
  - PRODUCTION: Supabase Storage'ga yuklash → public URL qaytaradi
  - LOCAL DEV: base64 data URL (Supabase env yo'q bo'lsa fallback)
  - Avtomatik: env bor → Supabase, env yo'q → base64
  - Sharp bilan 800x800 px resize, JPEG 85% compress

- .env va .env.example yangilandi:
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_BUCKET_NAME
  - Production'da Supabase Storage ishlatish uchun yo'riqnoma

- next.config.ts yangilandi:
  - serverExternalPackages: sharp qo'shildi
  - images.remotePatterns: Supabase Storage URL'lari uchun
  - bodySizeLimit: 10mb (rasm yuklash uchun)

- DEPLOYMENT.md to'liq yangilandi:
  - Supabase Storage bucket yaratish yo'riqnomasi
  - Vercel environment variables (DATABASE_URL + SUPABASE_*)
  - "Ma'lumotlar qayerda saqlanadi?" bo'limi
  - Ofitsiant va kassa alohida kompyuterda ishlashi tushuntirildi

- Production schema (PostgreSQL) local schema (SQLite) bilan sinxronlandi

- Test natijalari:
  ✅ Lint: 0 xato
  ✅ Local file write yo'q (src/app/api/ da fs.writeFileSync yo'q)
  ✅ Supabase Storage integratsiyasi tayyor
  ✅ Base64 fallback ishlaydi (local dev)
  ✅ next.config.ts Vercel uchun mos

Stage Summary:
- 100% ma'lumot Supabase cloud'ida saqlanadi
- Local hech narsa saqlanmaydi
- Rasmlar: Supabase Storage (production) / base64 (local dev fallback)
- Database: Supabase PostgreSQL (production) / SQLite (local dev)
- Ofitsiant va kassa alohida kompyuterda ishlay oladi (har ikkala Vercel+Supabase'ga ulanadi)
- 25 ta modul yo'qotilmadi

---
Task ID: ERP-014
Agent: Main agent (Super Z)
Task: Printer routing tizimi - avtomatik print job yaratish (shashlik/oshpaz/bar printerlar)

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- Prisma schema'ga 2 ta yangi model qo'shildi:
  1. PrinterStation: id, restaurantId, name, description, sortOrder, isActive
  2. PrintJob: id, restaurantId, orderId, printerStationId, status (pending/printed/failed), content (JSON)
  - Category ga printerStationId qo'shildi (kategoriya printerga bog'lanadi)
  - Restaurant va Order ga printJobs relation qo'shildi
  - Production schema (PostgreSQL) ham yangilandi

- Yangi API endpointlar:
  1. GET/POST /api/printers - printer stansiyalari CRUD
  2. PUT/DELETE /api/printers/[id] - printer tahrirlash/o'chirish
  3. GET /api/print-jobs - print navbati (printer bo'yicha guruhlangan)
  4. POST /api/print-jobs/[id]/printed - print job ni "chop etilgan" deb belgilash
  5. /api/categories yangilandi - printerStationId bilan (GET, POST, PUT)

- staff/orders POST yangilandi - AVTOMATIK PRINT JOB YARATISH:
  - Ofitsiant buyurtma bosganda, har taom kategoriyasining printer stansiyasiga qarab
  - Avtomatik print job yaratiladi (har printer uchun alohida)
  - Misol: 4 shashlik (Grill → Shashlik printer) + 2 cola (Ichimliklar → Bar printer)
    → 2 ta print job: 1 ta Shashlik printerga, 1 ta Bar printerga

- Yangi UI komponentlar:
  1. PrintersView.tsx - printer stansiyalari sozlamalari:
     - Printer qo'shish/tahrirlash/o'chirish (Shashlik, Oshpaz, Bar, Kassa)
     - Kategoriya → printer bog'lash jadvali (dropdown bilan)
     - Har printer uchun kategoriya va print job soni
     - Info banner (qanday ishlashi tushuntirilgan)
  
  2. PrintQueueView.tsx - kassir uchun print navbati:
     - Har 5 soniyada avtomatik yangilanadi
     - Printer bo'yicha guruhlangan (har printer alohida kartochka)
     - Har kartochkada: printer nomi, kutilayotgan job soni
     - "Hammasini chop etish" tugmasi (ketma-ket print)
     - Har job uchun: stol raqami, ofitsiant, order #, vaqt, taomlar ro'yxati
     - "Chop etish" va "Tayyor" tugmalari
     - 80mm termal chek formati (window.print)

- DashboardLayout yangilandi:
  - Boshqaruv bo'limiga "🖨️ Print navbati" va "⚙️ Printer sozlamalari" qo'shildi
  - Endi jami 27 ta modul (avval 25 ta edi)

- Test natijalari (API + browser verified):
  ✅ 3 ta printer stansiyasi yaratildi: Shashlik, Oshpaz, Bar
  ✅ Grill kategoriya → Shashlik printer ga bog'landi
  ✅ Ichimliklar kategoriya → Bar printer ga bog'landi
  ✅ Ofitsiant 4 shashlik + 2 cola buyurtma bosdi
  ✅ Avtomatik 2 ta print job yaratildi:
    - Shashlik printer: 4x Tovuq shashlik
    - Bar printer: 2x Coca Cola
  ✅ PrintQueueView: printer bo'yicha guruhlangan, 5s auto-refresh
  ✅ PrintersView: kategoriya-printer bog'lash ishlamoqda
  ✅ Lint: 0 xato

Stage Summary:
- Mavjud 25 ta modul yo'qotilmadi
- 2 ta yangi modul (Print navbati + Printer sozlamalari)
- Avtomatik print routing: ofitsiant buyurtma → avtomatik print job har printerga
- Kassir print queue'da har bir printer uchun cheklarni bosib chiqaradi
- Hammasi kassa kompyuterida (printerlar kassaga ulangan)
- Endi jami 27 ta professional modul

---
Task ID: ERP-015
Agent: Main agent (Super Z)
Task: Avtomatik print - ofitsiant buyurtma bosganda, kassir aralashmasdan avtomatik print

Work Log:
- Mavjud funksiyalar yo'qotilmadi
- Prisma schema yangilandi:
  - PrinterStation ga: autoPrint Boolean (default true), printerIp String?
  - PrintJob ga: autoPrintReady Boolean (default false) - avtomatik print uchun flag

- Yangi API: /api/print-jobs/auto
  - autoPrintReady=true va status=pending bo'lgan joblarni qaytaradi
  - AutoPrintMonitor komponenti har 2s chaqiradi

- staff/orders POST yangilandi:
  - Print job yaratganda autoPrintReady=station.autoPrint qiladi
  - Agar printerda autoPrint yoqilgan bo'lsa, job avtomatik print uchun tayyor

- Yangi UI: AutoPrintMonitor.tsx - avtomatik print monitoring
  - Har 2 soniyada /api/print-jobs/auto ni tekshiradi
  - Yangi job bo'lsa, hidden iframe yaratadi
  - Iframe ga chek content yoziladi (80mm format)
  - iframe.contentWindow.print() avtomatik chaqiriladi
  - Print dialog ochiladi - printer tanlanadi
  - Print tugagach job "printed" deb belgilanadi
  - Dublicat oldini olish: printingJobs Set
  - UI: pastki o'ng burchakda status indikator (yashil nuqta)
  - Print paytida: yuqori o'ng burchakda notification (printer nomi, stol)

- PrintersView yangilandi:
  - Printer formaga autoPrint toggle qo'shildi (⚡ Avtomatik print)
  - Printer IP maydoni qo'shildi (kelajak uchun)
  - Printer kartochkasida "⚡ Avto-print" yoki "Qo'lda" badge

- DashboardLayout yangilandi:
  - AutoPrintMonitor har sahifada ishlaydi (staffmode bundan tashqari)
  - Background da ishlaydi - foydalanuvchi ko'rmaydi

- Test natijalari:
  ✅ 3 ta printerda autoPrint=True (Shashlik, Oshpaz, Bar)
  ✅ Ofitsiant 3 shashlik + 2 cola buyurtma bosdi
  ✅ 2 ta print job autoPrintReady=true bilan yaratildi
  ✅ /api/print-jobs/auto: 2 ta job qaytardi
  ✅ AutoPrintMonitor browser'da render qilingan (yashil nuqta indikator)
  ✅ Lint: 0 xato

Stage Summary:
- Kassir aralashmaydi - ofitsiant buyurtma bosganda avtomatik print
- Har 2 soniyada tekshiriladi, yangi job bo'lsa darhol print
- Brauzer print dialogi avtomatik ochiladi (har printer uchun alohida)
- Sozlamalarda har printer uchun autoPrint yoqib/o'chiriladi
- Mavjud 27 ta modul yo'qotilmadi

---
Task ID: ERP-016
Agent: Main agent (Super Z)
Task: Printer sozlamalarini kengaytirish - tartibni o'zgartirish, qayta bog'lash

Work Log:
- Mavjud funksiyalar yo'qotilmadi

- Yangi API: POST /api/printers/[id]/reorder
  - direction: 'up' | 'down'
  - sortOrder'larni almashtiradi
  - Chegaralar tekshiriladi (birinchi/past)

- PrintersView to'liq qayta yozildi (kengaytirildi):
  1. ↑↓ TUGMALARI - har printer kartochkasida yuqori/pastga ko'chirish
  2. RAQAMLI TARTIB - har printer yonida tartib raqami (1, 2, 3...)
  3. HAR PRINTER KARTOCHKASIDA:
     - Qora header (slate-800): nom, tartib raqami, ↑↓ tugmalar
     - Avto/Qo'lda badge (⚡ Avto yoki Qo'lda)
     - "⚡ Avto yoqilgan/o'chiq" tugma (bir bosishda toggle)
     - "✏️ Tahrirlash" va "🗑️ O'chirish" tugmalari
     - 📎 Bog'langan kategoriyalar ro'yxati (kartochkalar ko'rinishida)
     - Har bog'langan kategoriyada 🔄 ko'chirish tugmasi
  
  4. KATEGORIYA BOG'LASH JADVALI:
     - Kategoriya nomi, taomlar soni
     - Joriy printer (badge bilan)
     - Dropdown dan o'zgartirish (tez)
     - "🔄 Ko'chirish" tugmasi (modal ochiladi)
  
  5. REASSIGN MODAL:
     - "Bu kategoriyadagi taomlar qaysi printerga yuborilsin?"
     - Hamma printerlar ro'yxati (kartochka ko'rinishida)
     - 🚫 Printerga bog'lamaslik varianti
     - Har variantda printer nomi, tavsif, ⚡ Avto badge
     - Joriy printer belgilangan (emerald border)
  
  6. OGOHLANTIRISH:
     - Bog'lanmagan kategoriyalar uchun sariq banner
     - "Bu kategoriyalardagi taomlar uchun chek chiqmaydi"

- Test natijalari:
  ✅ Reorder API: Shashlik printer down → 2-o'ringa ko'chdi
  ✅ Reorder API: Shashlik printer up → 1-o'ringa qaytdi
  ✅ 3 ta printer to'g'ri tartibda ko'rinmoqda
  ✅ Kategoriyalar: Grill → Shashlik printer, Ichimliklar → Bar printer
  ✅ Issiq taomlar → printer yo'q (ogohlantirish ko'rinadi)
  ✅ Lint: 0 xato

Stage Summary:
- Printerlarni ↑↓ tugmalari bilan tartiblash
- Kategoriyalarni istalgan printerga qayta bog'lash (dropdown yoki modal)
- Noto'g'ri bog'langan kategoriyani oson o'zgartirish
- Har printer kartochkasida bog'langan kategoriyalar ko'rinadi
- Bog'lanmagan kategoriyalar uchun ogohlantirish
- Avtomatik print ni bir bosishda yoqib/o'chirish
