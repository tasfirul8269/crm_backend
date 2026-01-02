import { Module } from '@nestjs/common';
import { TenancyContractService } from './tenancy-contract.service';
import { TenancyContractController } from './tenancy-contract.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
    imports: [PrismaModule, UploadModule],
    controllers: [TenancyContractController],
    providers: [TenancyContractService],
})
export class TenancyContractModule { }
