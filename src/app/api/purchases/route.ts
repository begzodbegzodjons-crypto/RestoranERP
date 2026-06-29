import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { addInventoryFromPurchase, generateInvoiceNo } from '@/lib/business'

// GET /api/purchases - kirim (xomashyo sotib olish) ro'yxati
export async function GET() {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const items = await db.purchase.findMany({
      where: { restaurantId: restaurant.id },
      include: {
        supplier: true,
        items: { include: { ingredient: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 200
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/purchases - yangi kirim yozish (avtomatik omborga qo'shadi)
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { supplierId, items, notes } = body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Kamida bitta ingredient kerak' }, { status: 400 })
    }

    let totalAmount = 0
    for (const it of items) {
      if (!it.ingredientId || !it.quantity || !it.unitPrice) {
        return NextResponse.json({ error: 'Har bir elementda ingredient, miqdor va narx kerak' }, { status: 400 })
      }
      totalAmount += parseFloat(it.quantity) * parseFloat(it.unitPrice)
    }

    const purchase = await db.purchase.create({
      data: {
        restaurantId: restaurant.id,
        supplierId: supplierId || null,
        invoiceNo: generateInvoiceNo('PUR'),
        totalAmount,
        paidAmount: totalAmount,
        status: 'paid',
        notes: notes || null,
        items: {
          create: items.map((it: any) => ({
            ingredientId: it.ingredientId,
            quantity: parseFloat(it.quantity),
            unit: it.unit || '',
            unitPrice: parseFloat(it.unitPrice),
            total: parseFloat(it.quantity) * parseFloat(it.unitPrice)
          }))
        }
      },
      include: { items: true }
    })

    // Add to inventory for each item
    for (const it of purchase.items) {
      await addInventoryFromPurchase(restaurant.id, it.ingredientId, it.quantity, it.unitPrice)
    }

    return NextResponse.json({ item: purchase })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
