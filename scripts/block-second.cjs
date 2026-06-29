const { PrismaClient } = require('@prisma/client')
const db = new PrismaClient()
async function main() {
  const r = await db.restaurant.findFirst({ where: { email: 'test2@example.com' } })
  if (!r) { console.log('Not found'); return }
  const past = new Date(); past.setDate(past.getDate() - 1)
  await db.restaurant.update({ where: { id: r.id }, data: { trialEnd: past, status: 'blocked' } })
  console.log('Blocked')
}
main().then(() => process.exit(0))
