import { Module } from '@nestjs/common';
import { SyncSchedulerService } from './sync-scheduler.service';
import { PropertiesModule } from '../properties/properties.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';

@Module({
    imports: [PropertiesModule, IntegrationsModule, PrismaModule, AgentsModule],
    providers: [SyncSchedulerService],
    exports: [SyncSchedulerService],
})
export class SchedulerModule { }
