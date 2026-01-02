import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { TenancyContractService } from './tenancy-contract.service';
import { CreateTenancyContractDto } from './dto/create-tenancy-contract.dto';

@Controller('tenancy-contracts')
export class TenancyContractController {
    constructor(private readonly tenancyContractService: TenancyContractService) { }

    @Post()
    create(@Body() createDto: CreateTenancyContractDto) {
        return this.tenancyContractService.create(createDto);
    }
}
