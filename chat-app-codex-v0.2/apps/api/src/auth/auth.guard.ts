import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  user: {
    sub: string;
    username: string;
    displayName: string;
  };
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = req.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token ausente');
    }

    try {
      req.user = this.jwt.verify<{ sub: string; username: string; displayName: string }>(header.slice(7));
      return Boolean(req.user?.sub);
    } catch {
      throw new UnauthorizedException('Token inválido');
    }
  }
}
