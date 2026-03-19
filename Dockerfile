# المرحلة 1: البناء
FROM node:20-alpine AS builder
WORKDIR /app
# تثبيت openssl لعمل Prisma
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY prisma ./prisma/
# توليد الـ Client للقاعدتين (الأساسية والإحصائيات)
RUN npx prisma generate
RUN npx prisma generate --schema=prisma/analytics.prisma
COPY . .
RUN npm run build

# المرحلة 2: التشغيل
FROM node:20-alpine
WORKDIR /app

# openssl ضروري لـ Prisma — wget للـ healthcheck
RUN apk add --no-cache openssl wget

ENV NODE_ENV=production

# نسخ الملفات الضرورية فقط
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

# إنشاء مجلد الملفات المرفوعة
RUN mkdir -p uploads

EXPOSE 8000

# 1. تطبيق أي migrations معلّقة (آمن إذا لا يوجد تغيير)
# 2. تشغيل السيرفر
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]