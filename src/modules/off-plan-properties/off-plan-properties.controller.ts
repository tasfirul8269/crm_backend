import { Body, Controller, Get, Post, UseGuards, Query, Delete, Patch, Param, Ip } from '@nestjs/common';
import { OffPlanPropertiesService } from './off-plan-properties.service';
import { CreateOffPlanPropertyDto } from './dto/create-off-plan-property.dto';
import { UpdateOffPlanPropertyDto } from './dto/update-off-plan-property.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('off-plan-properties')
export class OffPlanPropertiesController {
    constructor(private readonly offPlanPropertiesService: OffPlanPropertiesService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    create(@Body() createOffPlanPropertyDto: CreateOffPlanPropertyDto, @GetUser() user?: any, @Ip() ip?: string) {
        return this.offPlanPropertiesService.create(createOffPlanPropertyDto, user?.id, ip);
    }

    @Get()
    findAll(
        @Query() query: any,
        @Query('search') search?: string,
        @Query('developerId') developerId?: string,
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
        @Query('minArea') minArea?: string,
        @Query('maxArea') maxArea?: string,
        @Query('status') status?: string,
        @Query('reference') reference?: string,
        @Query('location') location?: string,
        @Query('permitNumber') permitNumber?: string,
        @Query('sortBy') sortBy?: 'date' | 'price' | 'name',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ) {
        // Helper to extract array from query which might be key or key[]
        const getArrayParam = (key: string): string[] | undefined => {
            const val = query[key] || query[`${key}[]`];
            if (!val) return undefined;
            return Array.isArray(val) ? val : [val];
        };

        const areaExpertIds = getArrayParam('areaExpertIds');
        const projectExpertIds = getArrayParam('projectExpertIds');
        const propertyType = getArrayParam('propertyType');

        return this.offPlanPropertiesService.findAll({
            search,
            developerId,
            areaExpertIds,
            projectExpertIds,
            propertyType,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minArea: minArea ? Number(minArea) : undefined,
            maxArea: maxArea ? Number(maxArea) : undefined,
            status,
            reference,
            location,
            permitNumber,
            sortBy,
            sortOrder,
        });
    }

    @Get('aggregates')
    getAggregates() {
        return this.offPlanPropertiesService.getAggregates();
    }

    @Get('top-locations')
    getTopLocations(@Query('limit') limit?: string) {
        return this.offPlanPropertiesService.getTopLocations(limit ? Number(limit) : 4);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.offPlanPropertiesService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() updateOffPlanPropertyDto: UpdateOffPlanPropertyDto,
        @GetUser() user?: any,
        @Ip() ip?: string,
    ) {
        return this.offPlanPropertiesService.update(id, updateOffPlanPropertyDto, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    remove(@Param('id') id: string, @GetUser() user?: any, @Ip() ip?: string) {
        return this.offPlanPropertiesService.remove(id, user?.id, ip);
    }
}
