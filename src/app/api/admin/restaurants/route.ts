import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { getAccessStatus } from '@/lib/auth'

// GET /api/admin/restaurants - barcha restoranlar ro'yxati statistika bilan
export async function GET() {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })
    }

    const restaurants = await db.restaurant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        status: true,
        trialStart: true,
        trialEnd: true,
        activatedAt: true,
        activationEnd: true,
        activationCode: true,
        blockedByAdmin: true,
        blockedReason: true,
        blockedAt: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Get aggregated stats per restaurant in parallel
    const restaurantIds = restaurants.map(r => r.id)

    const [products, sales, customers, ingredients] = await Promise.all([
      db.product.groupBy({
        by: ['restaurantId'],
        where: { restaurantId: { in: restaurantIds } },
        _count: { _all: true }
      }),
      db.sale.groupBy({
        by: ['restaurantId'],
        where: { restaurantId: { in: restaurantIds }, status: 'completed' },
        _count: { _all: true },
        _sum: { total: true, profit: true }
      }),
      db.customer.groupBy({
        by: ['restaurantId'],
        where: { restaurantId: { in: restaurantIds } },
        _count: { _all: true }
      }),
      db.ingredient.groupBy({
        by: ['restaurantId'],
        where: { restaurantId: { in: restaurantIds } },
        _count: { _all: true }
      })
    ])

    const productsMap = new Map(products.map(p => [p.restaurantId, p._count._all]))
    const salesMap = new Map(sales.map(s => [s.restaurantId, {
      count: s._count._all,
      total: s._sum.total || 0,
      profit: s._sum.profit || 0
    }]))
    const customersMap = new Map(customers.map(c => [c.restaurantId, c._count._all]))
    const ingredientsMap = new Map(ingredients.map(i => [i.restaurantId, i._count._all]))

    return NextResponse.json({
      restaurants: restaurants.map(r => {
        const access = getAccessStatus(r)
        const saleStats = salesMap.get(r.id) || { count: 0, total: 0, profit: 0 }
        return {
          ...r,
          access,
          stats: {
            products: productsMap.get(r.id) || 0,
            ingredients: ingredientsMap.get(r.id) || 0,
            customers: customersMap.get(r.id) || 0,
            sales: saleStats.count,
            totalRevenue: saleStats.total,
            totalProfit: saleStats.profit
          }
        }
      })
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
