import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  lastSeen: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  search(query: string, currentUserId: string) {
    const normalized = query.replace(/^@/, '').trim();
    if (!normalized) return [];

    return this.prisma.user.findMany({
      where: {
        id: { not: currentUserId },
        username: { contains: normalized.toLowerCase(), mode: 'insensitive' },
      },
      select: publicUserSelect,
      take: 20,
      orderBy: { username: 'asc' },
    });
  }
}
