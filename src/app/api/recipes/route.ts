import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'
import { recalcProductCost } from '@/lib/business'

// GET /api/recipes?productId=xxx - mahsulot retsepti
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const productId = searchParams.get('productId')

    const items = await db.recipe.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(productId ? { productId } : {})
      },
      include: { ingredient: true, product: true },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST /api/recipes - retseptga ingredient qo'shish yoki yangilash
// Body: { productId, ingredientId, quantity, unit }
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { productId, ingredientId, quantity, unit } = body

    if (!productId || !ingredientId || !quantity) {
      return NextResponse.json({ error: 'Mahsulot, ingredient va miqdor majburiy' }, { status: 400 })
    }

    // Verify ownership
    const product = await db.product.findFirst({
      where: { id: productId, restaurantId: restaurant.id }
    })
    if (!product) return NextResponse.json({ error: 'Mahsulot topilmadi' }, { status: 404 })

    const ingredient = await db.ingredient.findFirst({
      where: { id: ingredientId, restaurantId: restaurant.id }
    })
    if (!ingredient) return NextResponse.json({ error: 'Ingredient topilmadi' }, { status: 404 })

    // Upsert recipe (unique on productId+ingredientId)
    const cost = parseFloat(quantity) * ingredient.unitPrice
    const recipe = await db.recipe.upsert({
      where: {
        productId_ingredientId: { productId, ingredientId }
      },
      update: {
        quantity: parseFloat(quantity),
        unit: unit || ingredient.unit,
        cost
      },
      create: {
        restaurantId: restaurant.id,
        productId,
        ingredientId,
        quantity: parseFloat(quantity),
        unit: unit || ingredient.unit,
        cost
      }
    })

    // Recalculate product total cost
    await recalcProductCost(restaurant.id, productId)

    const updatedProduct = await db.product.findUnique({ where: { id: productId } })

    return NextResponse.json({ item: recipe, product: updatedProduct })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
