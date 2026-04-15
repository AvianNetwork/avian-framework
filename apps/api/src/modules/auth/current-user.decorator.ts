import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): { address: string; userId: string } => {
    const request = ctx.switchToHttp().getRequest<{ user: { address: string; userId: string } }>();
    return request.user;
  }
);
