// Recipe & inventory calculation helpers
import { db } from '@/lib/db'

// Recalculate product cost from its recipe
export async function recalcProductCost(restaurantId: string, productId: string): Promise<number> {
  const recipes = await db.recipe.findMany({
    where: { restaurantId, productId },
    include: { ingredient: true }
  })

  let totalCost = 0
  for (const r of recipes) {
    // cost = quantity (in recipe unit) * ingredient unitPrice (per ingredient's unit)
    // For simplicity, we assume recipe.unit == ingredient.unit (both in kg or both in gr)
    // If different, we should convert. For now we use direct multiplication.
    const recipeCost = r.quantity * r.ingredient.unitPrice
    totalCost += recipeCost

    // Update recipe cost cache
    await db.recipe.update({
      where: { id: r.id },
      data: { cost: recipeCost }
    })
  }

  // Update product cost
  await db.product.update({
    where: { id: productId },
    data: { cost: totalCost }
  })

  return totalCost
}

// Reduce inventory when a sale is made (per recipe)
export async function consumeInventoryForSale(
  restaurantId: string,
  productId: string,
  quantity: number
): Promise<number> {
  const recipes = await db.recipe.findMany({
    where: { restaurantId, productId },
    include: { ingredient: true }
  })

  let totalCost = 0

  for (const r of recipes) {
    const consumeQty = r.quantity * quantity
    const ingredient = r.ingredient

    // Reduce stock
    const newStock = Math.max(0, ingredient.stock - consumeQty)
    await db.ingredient.update({
      where: { id: ingredient.id },
      data: { stock: newStock }
    })

    // Log inventory movement
    await db.inventoryItem.create({
      data: {
        restaurantId,
        ingredientId: ingredient.id,
        type: 'out',
        quantity: consumeQty,
        unitPrice: ingredient.unitPrice,
        reason: 'sale',
        refType: 'Sale',
      }
    })

    totalCost += consumeQty * ingredient.unitPrice
  }

  return totalCost
}

// Add inventory when purchase is made
export async function addInventoryFromPurchase(
  restaurantId: string,
  ingredientId: string,
  quantity: number,
  unitPrice: number
) {
  const ingredient = await db.ingredient.findFirst({
    where: { id: ingredientId, restaurantId }
  })
  if (!ingredient) throw new Error('Ingredient not found')

  // Update stock and weighted average unit price
  const totalValue = (ingredient.stock * ingredient.unitPrice) + (quantity * unitPrice)
  const newStock = ingredient.stock + quantity
  const newUnitPrice = newStock > 0 ? totalValue / newStock : unitPrice

  await db.ingredient.update({
    where: { id: ingredientId },
    data: {
      stock: newStock,
      unitPrice: newUnitPrice
    }
  })

  await db.inventoryItem.create({
    data: {
      restaurantId,
      ingredientId,
      type: 'in',
      quantity,
      unitPrice,
      reason: 'purchase',
      refType: 'Purchase',
    }
  })
}

// Generate invoice number
export function generateInvoiceNo(prefix = 'INV'): string {
  const date = new Date()
  const ymd = date.getFullYear().toString() +
    (date.getMonth() + 1).toString().padStart(2, '0') +
    date.getDate().toString().padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${ymd}-${rand}`
}
