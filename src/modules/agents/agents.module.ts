import { Module } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { PortalsModule } from '../portals/portals.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
    imports: [PrismaModule, UploadModule, PortalsModule, ActivityModule],
    controllers: [AgentsController],
    providers: [AgentsService],
    exports: [AgentsService],
})
export class AgentsModule { }
