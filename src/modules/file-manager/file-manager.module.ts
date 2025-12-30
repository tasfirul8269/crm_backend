import { Module, Global } from '@nestjs/common';
import { FileManagerController } from './file-manager.controller';
import { FileManagerService } from './file-manager.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Global() // Make global so we don't have to import it everywhere individually if we use it a lot
@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [FileManagerController],
    providers: [FileManagerService],
    exports: [FileManagerService],
})
export class FileManagerModule { }
