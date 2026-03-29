-- Add description column to Theme
ALTER TABLE "Theme" ADD COLUMN "description" TEXT;

-- Rename "modern" theme to "charity"
UPDATE "Theme"
SET slug        = 'charity',
    name        = 'قالب الجمعيات الخيرية',
    description = 'قالب احترافي مخصص للمؤسسات الخيرية والوقفية لإدارة التبرعات والمشاريع.'
WHERE slug = 'modern';

-- Set description for default theme
UPDATE "Theme"
SET description = 'القالب الأساسي لجميع أنواع المتاجر الإلكترونية.'
WHERE slug = 'default';

-- Sync activityType for stores currently using the charity theme
UPDATE "Store"
SET "activityType" = 'CHARITY'
WHERE "themeId" IN (SELECT id FROM "Theme" WHERE slug = 'charity');
