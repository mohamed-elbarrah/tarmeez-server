const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Find the customer "محمد" in the store
  const customer = await p.customer.findFirst({
    where: { fullName: 'محمد' },
    include: { user: { select: { email: true } } },
  });
  if (!customer) {
    console.log('Customer not found');
    return;
  }
  console.log(`Found customer: ${customer.fullName} (${customer.id}), store: ${customer.storeId}`);

  // Link all unlinked orders in the same store to this customer
  const result = await p.order.updateMany({
    where: { customerId: null, storeId: customer.storeId },
    data: { customerId: customer.id },
  });

  console.log(`Linked ${result.count} orders to customer ${customer.fullName}`);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
