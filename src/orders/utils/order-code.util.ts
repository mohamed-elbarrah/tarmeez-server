import { PrismaClient } from '@prisma/client'

function generateOrderCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function generateUniqueOrderCode(prisma: PrismaClient): Promise<string> {
  let code: string = ''
  let exists = true
  while (exists) {
    code = generateOrderCode()
    const order = await prisma.order.findUnique({ where: { orderCode: code } as any })
    exists = !!order
  }
  return code
}
