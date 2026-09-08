import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, AuthenticatedRequest } from '../auth/auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService, private readonly gateway: ChatGateway) {}

  @Get('conversations')
  list(@Req() req: AuthenticatedRequest) {
    return this.chat.list(req.user.sub);
  }

  @Post('conversations/private/:otherUserId')
  createPrivate(@Req() req: AuthenticatedRequest, @Param('otherUserId') otherUserId: string) {
    return this.chat.privateConversation(req.user.sub, otherUserId);
  }

  @Get('conversations/:id/messages')
  messages(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.chat.messages(req.user.sub, id);
  }

  @Post('conversations/:id/messages')
  async send(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const message = await this.chat.send(req.user.sub, id, dto.content);
    this.gateway.emitMessage(id, message);
    return message;
  }
}
