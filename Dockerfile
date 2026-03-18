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

# تثبيت openssl ضروري جداً لتشغيل Prisma في بيئة الإنتاج
RUN apk add --no-cache openssl

ENV NODE_ENV=production

# نسخ الملفات الضرورية فقط
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./

EXPOSE 8000

# التعديل الجوهري هنا: تشغيل الملف مباشرة بالامتداد .js
# تأكد إذا كان ملف main.js موجود داخل dist مباشرة أو داخل dist/src
CMD ["node", "dist/src/main.js"]