// Script to set restaurant's trialEnd to past to test blocked state
const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()

async function main() {
  // Set first restaurant's trialEnd to past
  const r = await db.restaurant.findFirst()
  if (!r) {
    console.log('No restaurants found')
    return
  }
  const pastDate = new Date()
  pastDate.setDate(pastDate.getDate() - 1) // yesterday
  await db.restaurant.update({
    where: { id: r.id },
    data: { trialEnd: pastDate, status: 'blocked' }
  })
  console.log(`Set trialEnd to past for restaurant: ${r.name} (${r.email})`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
