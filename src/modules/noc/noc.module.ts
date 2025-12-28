import { Module } from '@nestjs/common';
import { NocController } from './noc.controller';
import { NocService } from './noc.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [NocController],
    providers: [NocService],
    exports: [NocService],
})
export class NocModule { }
