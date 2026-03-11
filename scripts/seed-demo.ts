import { PrismaClient, UserRole, MerchantStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const demoPassword = 'Password123!';
  const hashed = await bcrypt.hash(demoPassword, 10);

  // Superadmin
  const superEmail = 'superadmin@example.com';
  const existingSuper = await prisma.user.findFirst({ where: { email: superEmail } });
  if (!existingSuper) {
    const superUser = await prisma.user.create({
      data: {
        email: superEmail,
        password: hashed,
        role: UserRole.SUPERADMIN,
      },
    });
    console.log('Created Superadmin:', superUser.email);
  } else {
    console.log('Superadmin already exists:', existingSuper.email);
  }

  // Merchant + Store
  const merchantEmail = 'merchant@example.com';
  const merchantStoreName = 'Demo Store';
  const merchantStoreSlug = 'demo-store';

  let merchant = await prisma.user.findFirst({ where: { email: merchantEmail } });
  if (!merchant) {
    merchant = await prisma.user.create({
      data: {
        email: merchantEmail,
        password: hashed,
        role: UserRole.MERCHANT,
      },
    });
    console.log('Created Merchant user:', merchant.email);
  } else {
    console.log('Merchant user exists:', merchant.email);
  }

  const existingMerchant = await prisma.merchant.findUnique({ where: { userId: merchant.id } });
  if (!existingMerchant) {
    const createdMerchant = await prisma.merchant.create({
      data: {
        userId: merchant.id,
        fullName: 'Demo Merchant',
        phone: '+10000000000',
        storeName: merchantStoreName,
        storeSlug: merchantStoreSlug,
        category: 'demo',
        country: 'DemoLand',
        city: 'DemoCity',
        description: 'Demo merchant account',
        status: MerchantStatus.ACTIVE,
      },
    });

    // create store linked to merchant
    await prisma.store.create({
      data: {
        merchantId: createdMerchant.id,
        slug: merchantStoreSlug,
        name: merchantStoreName,
      },
    });

    console.log('Created Merchant record and Store:', merchantStoreSlug);
  } else {
    console.log('Merchant record exists for user:', merchant.email);
  }

  // Customer linked to the merchant's store
  const customerEmail = 'customer@example.com';
  let customer = await prisma.user.findFirst({ where: { email: customerEmail } });
  if (!customer) {
    customer = await prisma.user.create({
      data: {
        email: customerEmail,
        password: hashed,
        role: UserRole.CUSTOMER,
      },
    });
    console.log('Created Customer user:', customer.email);
  } else {
    console.log('Customer user exists:', customer.email);
  }

  const store = await prisma.store.findUnique({ where: { slug: merchantStoreSlug } });
  if (!store) {
    console.warn('Store not found; skipping customer linking');
  } else {
    const existingCustomerLink = await prisma.customer.findFirst({ where: { userId: customer.id, storeId: store.id } });
    if (!existingCustomerLink) {
      await prisma.customer.create({
        data: {
          userId: customer.id,
          storeId: store.id,
          fullName: 'Demo Customer',
          phone: '+10000000001',
        },
      });
      console.log('Linked Customer to store:', store.slug);
    } else {
      console.log('Customer already linked to store:', store.slug);
    }
  }

  console.log('\nDemo credentials (use only for testing)');
  console.log('Superadmin ->', superEmail, '/', demoPassword);
  console.log('Merchant    ->', merchantEmail, '/', demoPassword, ' storeSlug:', merchantStoreSlug);
  console.log('Customer    ->', customerEmail, '/', demoPassword, ' storeSlug:', merchantStoreSlug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
