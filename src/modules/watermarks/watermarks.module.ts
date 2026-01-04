import { Module } from '@nestjs/common';
import { WatermarksController } from './watermarks.controller';
import { WatermarksService } from './watermarks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadModule } from '../upload/upload.module';

@Module({
    imports: [UploadModule],
    controllers: [WatermarksController],
    providers: [WatermarksService, PrismaService],
    exports: [WatermarksService],
})
export class WatermarksModule { }
