import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';
import { IS_PUBLIC_KEY } from './public.Dec';
import { Request } from 'express';
import { jwtConstants } from './jwtConstants';
import { ActivityMiddleware } from './auth.middleware';

@Injectable()
export class AuthGuard implements CanActivate {

  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private userService: UserService
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY,
      [
        context.getHandler(),
        context.getClass(),
      ]
    );
    if (isPublic)
      return true;
    
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token)
      throw new UnauthorizedException('Token não fornecido');
    
    if (ActivityMiddleware.isTokenBlacklisted(token)) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    
    try {
      const payload: { sub: number } = await this.jwtService.verifyAsync(
        token,
        {
          secret: jwtConstants.secret
        }
      );
      request['user'] = this.userService.findUserBy({ id: payload.sub });
    } catch {
      throw new UnauthorizedException("Token inválido");
    }

    return true;
  }

  private extractTokenFromHeader(req: Request): string | undefined {
    const authorizationHeader = req.headers.authorization;
    const [type, token] = authorizationHeader?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined
  }
}