import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'

// GET /api/admin/restaurants/[id]/activity - restoran faolligi tahlili
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const restaurant = await db.restaurant.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, phone: true, address: true,
        status: true, createdAt: true, trialEnd: true, activatedAt: true, activationEnd: true,
        blockedByAdmin: true,
      }
    })
    if (!restaurant) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 })

    const now = new Date()
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [productsCount, salesCount30, salesCount7, lastSale, customersCount, ordersCount, purchasesCount, imagesCount] = await Promise.all([
      db.product.count({ where: { restaurantId: id } }),
      db.sale.count({ where: { restaurantId: id, createdAt: { gte: last30Days } } }),
      db.sale.count({ where: { restaurantId: id, createdAt: { gte: last7Days } } }),
      db.sale.findFirst({ where: { restaurantId: id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      db.customer.count({ where: { restaurantId: id } }),
      db.order.count({ where: { restaurantId: id } }),
      db.purchase.count({ where: { restaurantId: id } }),
      db.product.count({ where: { restaurantId: id, imageUrl: { not: null } } }),
    ])

    // Last activity date
    const lastActivity = lastSale?.createdAt || restaurant.createdAt
    const daysSinceActive = Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))

    // Status: active | idle | inactive
    let activityStatus = 'active'
    if (daysSinceActive > 30) activityStatus = 'inactive'
    else if (daysSinceActive > 7) activityStatus = 'idle'

    // Storage size estimate (base64 images)
    const productsWithImages = await db.product.findMany({
      where: { restaurantId: id, imageUrl: { not: null } },
      select: { imageUrl: true }
    })
    let storageBytes = 0
    for (const p of productsWithImages) {
      if (p.imageUrl && p.imageUrl.startsWith('data:')) {
        const base64 = p.imageUrl.split(',')[1] || ''
        storageBytes += Math.ceil(base64.length * 0.75)
      }
    }

    return NextResponse.json({
      restaurant,
      activity: {
        status: activityStatus,
        daysSinceActive,
        lastActivity,
        salesCount30,
        salesCount7,
        productsCount,
        customersCount,
        ordersCount,
        purchasesCount,
        imagesCount,
        storageBytes,
        storageMB: (storageBytes / 1024 / 1024).toFixed(2)
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// DELETE /api/admin/restaurants/[id]/delete - restorni tagi bilan o'chirish
// Barcha bog'liq ma'lumotlar cascade orqali o'chiriladi
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const { id } = await params
    const restaurant = await db.restaurant.findUnique({ where: { id } })
    if (!restaurant) return NextResponse.json({ error: 'Restoran topilmadi' }, { status: 404 })

    // Count what will be deleted
    const counts = {
      products: await db.product.count({ where: { restaurantId: id } }),
      sales: await db.sale.count({ where: { restaurantId: id } }),
      orders: await db.order.count({ where: { restaurantId: id } }),
      customers: await db.customer.count({ where: { restaurantId: id } }),
      staff: await db.staff.count({ where: { restaurantId: id } }),
      ingredients: await db.ingredient.count({ where: { restaurantId: id } }),
      expenses: await db.expense.count({ where: { restaurantId: id } }),
      purchases: await db.purchase.count({ where: { restaurantId: id } }),
      tables: await db.restaurantTable.count({ where: { restaurantId: id } }),
      rooms: await db.room.count({ where: { restaurantId: id } }),
    }

    // Delete all sessions first (force logout)
    await db.session.deleteMany({ where: { restaurantId: id } })
    await db.staffSession.deleteMany({
      where: { staff: { restaurantId: id } }
    })

    // Delete restaurant (cascade will delete everything else)
    await db.restaurant.delete({ where: { id } })

    await db.adminLog.create({
      data: {
        action: 'delete_restaurant',
        detail: `Deleted ${restaurant.name} (${restaurant.email}) with ${Object.values(counts).reduce((a, b) => a + b, 0)} records`
      }
    })

    return NextResponse.json({
      success: true,
      message: `${restaurant.name} tagi bilan o'chirildi`,
      deletedCounts: counts
    })
  } catch (e: any) {
    console.error('Delete restaurant error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
