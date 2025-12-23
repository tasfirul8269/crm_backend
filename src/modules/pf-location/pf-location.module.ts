import { Module } from '@nestjs/common';
import { PfLocationService } from './pf-location.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PropertyFinderModule } from '../property-finder/property-finder.module';

@Module({
    imports: [PrismaModule, PropertyFinderModule],
    providers: [PfLocationService],
    exports: [PfLocationService],
})
export class PfLocationModule { }
