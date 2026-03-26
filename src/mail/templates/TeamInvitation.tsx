import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
  Tailwind,
} from '@react-email/components';
import * as React from 'react';

interface TeamInvitationEmailProps {
  merchantName: string;
  storeName: string;
  invitationUrl: string;
  role: string;
}

const roleLabel: Record<string, string> = {
  ADMIN: 'مدير',
  EDITOR: 'محرر',
  MARKETER: 'مسوّق',
  OWNER: 'مالك',
};

export function TeamInvitationEmail({
  merchantName,
  storeName,
  invitationUrl,
  role,
}: TeamInvitationEmailProps) {
  const arabicRole = roleLabel[role] ?? role;

  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>
        {merchantName} يدعوك للانضمام إلى فريق متجر {storeName}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto my-10 max-w-[560px] rounded-2xl bg-white shadow-sm">
            {/* ── Header ── */}
            <Section className="rounded-t-2xl bg-[#2563eb] px-10 py-8 text-center">
              <Heading className="m-0 text-2xl font-bold tracking-wide text-white">
                ترميز
              </Heading>
              <Text className="m-0 mt-1 text-sm text-blue-200">
                منصة بناء المتاجر الإلكترونية
              </Text>
            </Section>

            {/* ── Body ── */}
            <Section className="px-10 py-8">
              <Heading
                as="h2"
                className="mb-4 text-xl font-semibold text-gray-800"
              >
                دعوة للانضمام إلى فريق العمل
              </Heading>

              <Text className="text-base leading-7 text-gray-600">مرحباً،</Text>

              <Text className="text-base leading-7 text-gray-600">
                لقد دعاك{' '}
                <strong className="text-gray-900">{merchantName}</strong>{' '}
                للانضمام لفريق عمل متجر{' '}
                <strong className="text-gray-900">{storeName}</strong> بصلاحية{' '}
                <strong className="text-[#2563eb]">{arabicRole}</strong>.
              </Text>

              <Text className="text-base leading-7 text-gray-600">
                انقر على الزر أدناه لقبول الدعوة والبدء في العمل مع الفريق.
              </Text>

              <Section className="mt-8 text-center">
                <Button
                  href={invitationUrl}
                  className="rounded-lg bg-[#2563eb] px-8 py-3 text-base font-semibold text-white no-underline"
                >
                  قبول الدعوة
                </Button>
              </Section>

              <Hr className="my-8 border-gray-200" />

              <Text className="text-xs leading-5 text-gray-400">
                إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني
                بأمان. تنتهي صلاحية هذه الدعوة خلال 48 ساعة.
              </Text>

              <Text className="text-xs leading-5 text-gray-400">
                أو انسخ الرابط التالي في متصفحك:
                <br />
                <span className="break-all text-[#2563eb]">
                  {invitationUrl}
                </span>
              </Text>
            </Section>

            {/* ── Footer ── */}
            <Section className="rounded-b-2xl bg-gray-50 px-10 py-5 text-center">
              <Text className="m-0 text-xs text-gray-400">
                © {new Date().getFullYear()} ترميز — جميع الحقوق محفوظة
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default TeamInvitationEmail;
