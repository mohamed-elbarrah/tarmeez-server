const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.store.findFirst({ select: { id: true } })
  .then(r => { console.log('storeId:', r ? r.id : 'none'); return p.$disconnect(); })
  .catch(e => { console.log('err', e.message); return p.$disconnect(); });
