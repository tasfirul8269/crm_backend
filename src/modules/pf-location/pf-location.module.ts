import { Module } from '@nestjs/common';
import { PfLocationService } from './pf-location.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PortalsModule } from '../portals/portals.module';

@Module({
    imports: [PrismaModule, PortalsModule],
    providers: [PfLocationService],
    exports: [PfLocationService],
})
export class PfLocationModule { }
