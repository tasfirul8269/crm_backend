import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';

import { EmailModule } from '../../providers/email/email.module';

import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [UsersModule, JwtModule.register({}), EmailModule, PrismaModule],
  controllers: [AuthController],
  providers: [JwtStrategy, RefreshStrategy],
  exports: [],
})
export class AuthModule { }
