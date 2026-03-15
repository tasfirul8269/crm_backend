import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RealIp } from '../../common/decorators/real-ip.decorator';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private readonly leadsService: LeadsService) { }

    @Post()
    create(@Body() createLeadDto: CreateLeadDto, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.leadsService.create(createLeadDto, user?.id, ip);
    }

    @Get('stats')
    getStats(@Query('source') source?: string) {
        return this.leadsService.getStats(source);
    }

    @Get('source-stats')
    getLeadSourceStats() {
        return this.leadsService.getLeadSourceStats();
    }


    @Get()
    findAll(@GetUser() user?: any) {
        return this.leadsService.findAll(user?.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.leadsService.findOne(id);
    }

    @Patch(':id/responsible')
    updateResponsible(
        @Param('id') id: string,
        @Body('agentId') agentId: string,
        @GetUser() user?: any,
        @RealIp() ip?: string
    ) {
        return this.leadsService.updateResponsible(id, agentId, user?.id, ip);
    }
}

