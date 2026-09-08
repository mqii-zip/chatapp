import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const username = dto.username.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new ConflictException('Username já existe');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({ data: { username, displayName: dto.displayName.trim(), passwordHash } });
    return this.issueToken(user.id, user.username, user.displayName);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Usuário ou senha inválidos');
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeen: new Date() } });
    return this.issueToken(user.id, user.username, user.displayName);
  }

  private issueToken(id: string, username: string, displayName: string) {
    const accessToken = this.jwt.sign({ sub: id, username, displayName });
    return { accessToken, user: { id, username, displayName } };
  }
}
