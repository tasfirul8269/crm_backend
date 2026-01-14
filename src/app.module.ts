import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { DevelopersModule } from './modules/developers/developers.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OffPlanPropertiesModule } from './modules/off-plan-properties/off-plan-properties.module';
import { AmenitiesModule } from './modules/amenities/amenities.module';
import { PropertiesModule } from './modules/properties/properties.module';
import { ConfigModule } from '@nestjs/config';
import { LeadsModule } from './modules/leads/leads.module';

import { PropertyFinderLeadsModule } from './modules/property-finder-leads/property-finder-leads.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ActivityModule } from './modules/activity/activity.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

import { UploadModule } from './modules/upload/upload.module';
import { DraftsModule } from './modules/properties/drafts/drafts.module';
import { NocModule } from './modules/noc/noc.module';
import { AiModule } from './modules/ai/ai.module';
import { FileManagerModule } from './modules/file-manager/file-manager.module';
import { PasswordsModule } from './modules/passwords/passwords.module';
import { TenancyContractModule } from './modules/tenancy-contract/tenancy-contract.module';
import { WatermarksModule } from './modules/watermarks/watermarks.module';
import { AgentPasswordsModule } from './modules/agent-passwords/agent-passwords.module';
import { FrooxiAuthModule } from '@frooxi-labs/authentication';
import { UsersService } from './modules/users/users.service';
import { PortalsModule } from './modules/portals/portals.module';


@Module({
  imports: [
    // Frooxi Labs Authentication Engine
    FrooxiAuthModule.register({
      jwtSecret: process.env.JWT_SECRET || 'secretKey',
      jwtRefreshSecret: process.env.JWT_REFRESH_TOKEN_KEY || 'refreshSecretKey',
      accessTokenExpiresIn: '1d',
      refreshTokenExpiresIn: '7d',
      otpExpiresInMinutes: 5,
      maxOtpAttempts: 5,
      lockoutDurationMinutes: 15,
      passwordMinLength: 8
    }, UsersService, [PrismaModule, UploadModule, ActivityModule, FileManagerModule]),

    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
    DevelopersModule,
    AgentsModule,
    OffPlanPropertiesModule,
    AmenitiesModule,
    PropertiesModule,
    LeadsModule,
    PrismaModule,

    PropertyFinderLeadsModule,
    IntegrationsModule,
    ActivityModule,
    SchedulerModule,
    UploadModule,
    DraftsModule,
    NocModule,
    AiModule,
    FileManagerModule,
    PasswordsModule,
    AgentPasswordsModule,
    TenancyContractModule,
    WatermarksModule,
    PortalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
