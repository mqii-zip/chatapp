import { Injectable } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

interface SocketUser {
  sub: string;
  username: string;
  displayName: string;
}

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly chat: ChatService,
  ) {}

  async handleConnection(socket: Socket) {
    const token = this.extractToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const user = this.jwt.verify<SocketUser>(token);
      if (!user?.sub) throw new Error('invalid token');
      socket.data.user = user;
      socket.join(`user:${user.sub}`);
      await this.prisma.user.update({ where: { id: user.sub }, data: { lastSeen: new Date() } });
      this.server.emit('presence:update', { userId: user.sub, online: true });
    } catch {
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user?.sub) return;

    await this.prisma.user.update({ where: { id: user.sub }, data: { lastSeen: new Date() } }).catch(() => undefined);
    this.server.emit('presence:update', { userId: user.sub, online: false, lastSeen: new Date().toISOString() });
  }

  @SubscribeMessage('join_conversation')
  async join(@MessageBody() conversationId: string, @ConnectedSocket() socket: Socket) {
    const user = socket.data.user as SocketUser | undefined;
    if (!user?.sub || !(await this.chat.isMember(user.sub, conversationId))) return { ok: false };
    socket.join(`conversation:${conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  async typingStart(@MessageBody() body: { conversationId: string }, @ConnectedSocket() socket: Socket) {
    const conversationId = body?.conversationId;
    const user = socket.data.user as SocketUser | undefined;
    if (!user?.sub || !(await this.chat.isMember(user.sub, conversationId))) return;
    socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId: user.sub });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(@MessageBody() body: { conversationId: string }, @ConnectedSocket() socket: Socket) {
    const conversationId = body?.conversationId;
    const user = socket.data.user as SocketUser | undefined;
    if (!user?.sub || !(await this.chat.isMember(user.sub, conversationId))) return;
    socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId: user.sub });
  }

  emitMessage(conversationId: string, message: unknown) {
    this.server.to(`conversation:${conversationId}`).emit('message:new', message);
  }

  private extractToken(socket: Socket) {
    const authToken = socket.handshake.auth?.token;
    if (typeof authToken === 'string') return authToken;

    const header = socket.handshake.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    return undefined;
  }
}
