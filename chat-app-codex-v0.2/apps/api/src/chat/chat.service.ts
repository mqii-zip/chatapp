import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const publicUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  lastSeen: true,
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async privateConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) throw new BadRequestException('Você não pode conversar consigo mesmo');

    const otherUser = await this.prisma.user.findUnique({ where: { id: otherUserId }, select: { id: true } });
    if (!otherUser) throw new NotFoundException('Usuário não encontrado');

    const privateKey = [userId, otherUserId].sort().join(':');
    const existing = await this.prisma.conversation.findUnique({
      where: { privateKey },
      include: { members: { include: { user: { select: publicUserSelect } } } },
    });
    if (existing) return existing;

    try {
      return await this.prisma.conversation.create({
        data: {
          type: 'PRIVATE',
          privateKey,
          members: { create: [{ userId }, { userId: otherUserId }] },
        },
        include: { members: { include: { user: { select: publicUserSelect } } } },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        const createdByRace = await this.prisma.conversation.findUnique({
          where: { privateKey },
          include: { members: { include: { user: { select: publicUserSelect } } } },
        });
        if (createdByRace) return createdByRace;
      }
      throw error;
    }
  }

  async list(userId: string) {
    return this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: publicUserSelect } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async isMember(userId: string, conversationId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
      select: { conversationId: true },
    });
    return Boolean(member);
  }

  async messages(userId: string, conversationId: string) {
    if (!(await this.isMember(userId, conversationId))) {
      throw new NotFoundException('Conversa não encontrada');
    }

    return this.prisma.message.findMany({
      where: { conversationId },
      include: { sender: { select: publicUserSelect } },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async send(userId: string, conversationId: string, content: string) {
    if (!(await this.isMember(userId, conversationId))) {
      throw new NotFoundException('Conversa não encontrada');
    }

    const normalized = content.trim();
    if (!normalized) throw new BadRequestException('A mensagem não pode estar vazia');
    if (normalized.length > 4000) throw new BadRequestException('A mensagem é muito longa');

    return this.prisma.message.create({
      data: { conversationId, senderId: userId, content: normalized },
      include: { sender: { select: publicUserSelect } },
    });
  }
}
