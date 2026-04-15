import { Module, Global } from '@nestjs/common';
import { getPrismaClient } from '@avian-framework/database';

export const PRISMA = 'PRISMA';

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => getPrismaClient(),
    },
  ],
  exports: [PRISMA],
})
export class DatabaseModule {}
