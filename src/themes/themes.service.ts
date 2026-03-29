import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ThemesService {
  constructor(private prisma: PrismaService) {}

  /** List all active themes — safe to expose publicly. */
  async findAll() {
    return this.prisma.theme.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        previewImage: true,
        defaultConfig: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Return a single theme by slug (used internally for fallback). */
  async findBySlug(slug: string) {
    const theme = await this.prisma.theme.findUnique({ where: { slug } });
    if (!theme) throw new NotFoundException(`Theme '${slug}' not found`);
    return theme;
  }
}
