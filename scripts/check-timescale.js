const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.$queryRawUnsafe("SELECT name, default_version FROM pg_available_extensions WHERE name = 'timescaledb'")
  .then(r => {
    if (r.length === 0) {
      console.log('TIMESCALEDB_NOT_AVAILABLE');
    } else {
      console.log('TIMESCALEDB_AVAILABLE:', JSON.stringify(r));
    }
    return prisma.$disconnect();
  })
  .catch(e => {
    console.error('DB_ERROR:', e.message);
    return prisma.$disconnect();
  });
