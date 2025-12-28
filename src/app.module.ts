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
import { PropertyFinderModule } from './modules/property-finder/property-finder.module';
import { PropertyFinderLeadsModule } from './modules/property-finder-leads/property-finder-leads.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { ActivityModule } from './modules/activity/activity.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

import { UploadModule } from './modules/upload/upload.module';
import { DraftsModule } from './modules/properties/drafts/drafts.module';
import { NocModule } from './modules/noc/noc.module';
import { AiModule } from './modules/ai/ai.module';


@Module({
  imports: [
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
    PropertyFinderModule,
    PropertyFinderLeadsModule,
    IntegrationsModule,
    ActivityModule,
    SchedulerModule,
    UploadModule,
    DraftsModule,
    NocModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
