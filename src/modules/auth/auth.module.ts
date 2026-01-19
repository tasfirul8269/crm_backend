import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';

import { EmailModule } from '../../providers/email/email.module';

@Module({
  imports: [UsersModule, JwtModule.register({}), EmailModule],
  controllers: [AuthController],
  providers: [JwtStrategy, RefreshStrategy],
  exports: [],
})
export class AuthModule { }
