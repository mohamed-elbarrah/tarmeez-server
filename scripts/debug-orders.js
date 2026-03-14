const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const orders = await p.order.findMany({
    select: { id: true, orderCode: true, customerId: true, customerName: true, customerEmail: true, storeId: true, status: true }
  });
  console.log('ALL ORDERS:', JSON.stringify(orders, null, 2));

  const customers = await p.customer.findMany({
    select: { id: true, userId: true, storeId: true, fullName: true },
    include: { user: { select: { email: true } } }
  });
  console.log('ALL CUSTOMERS:', JSON.stringify(customers, null, 2));

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
