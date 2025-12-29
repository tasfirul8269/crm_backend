import { Controller, Get, Post, Body, Param, Delete, UseInterceptors, UploadedFiles, Patch, Query, UseGuards, Ip } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UploadService } from '../upload/upload.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('properties')
export class PropertiesController {
    constructor(
        private readonly propertiesService: PropertiesService,
        private readonly uploadService: UploadService,
    ) { }

    @Get('aggregates')
    getAggregates() {
        return this.propertiesService.getAggregates();
    }

    @Get('stats')
    async getDashboardStats() {
        return this.propertiesService.getDashboardStats();
    }

    @Get('revenue-tendency')
    async getRevenueTendency() {
        return this.propertiesService.getRevenueTendency();
    }

    @Get('category-tendency')
    async getCategoryTendency() {
        return this.propertiesService.getCategoryTendency();
    }

    @Get('top-locations')
    async getTopLocations(@Query('viewBy') viewBy: 'listing' | 'impression' | 'leads') {
        return this.propertiesService.getTopLocations(viewBy);
    }


    @Get('pf-locations')
    async searchPfLocations(@Query('search') search: string) {
        return this.propertiesService.searchPfLocations(search);
    }

    @Get()
    findAll(
        @Query() query: any,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('purpose') purpose?: string,
        @Query('location') location?: string,
        @Query('reference') reference?: string,
        @Query('permitNumber') permitNumber?: string,
        @Query('minPrice') minPrice?: string,
        @Query('maxPrice') maxPrice?: string,
        @Query('minArea') minArea?: string,
        @Query('maxArea') maxArea?: string,
        @Query('sortBy') sortBy?: 'date' | 'price' | 'name',
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ) {
        // Helper to extract array from query which might be key or key[]
        const getArrayParam = (key: string): string[] | undefined => {
            const val = query[key] || query[`${key}[]`];
            if (!val) return undefined;
            return Array.isArray(val) ? val : [val];
        };

        let agentIds = getArrayParam('agentIds');

        // If query.agentIds is a string (not an array and not using []), handle it
        if (!agentIds && query.agentIds) {
            agentIds = typeof query.agentIds === 'string' ? [query.agentIds] : query.agentIds;
        }
        const propertyTypes = getArrayParam('propertyTypes');

        return this.propertiesService.findAll({
            status,
            search,
            agentIds,
            category,
            purpose,
            location,
            reference,
            propertyTypes,
            permitNumber,
            minPrice: minPrice ? Number(minPrice) : undefined,
            maxPrice: maxPrice ? Number(maxPrice) : undefined,
            minArea: minArea ? Number(minArea) : undefined,
            maxArea: maxArea ? Number(maxArea) : undefined,
            sortBy,
            sortOrder,
            page: query.page ? Number(query.page) : undefined,
            limit: query.limit ? Number(query.limit) : undefined,
        });
    }



    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.propertiesService.findOne(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'coverPhoto', maxCount: 1 },
        { name: 'mediaImages', maxCount: 30 },
        { name: 'nocDocument', maxCount: 1 },
        { name: 'passportCopy', maxCount: 1 },
        { name: 'emiratesIdScan', maxCount: 1 },
        { name: 'titleDeed', maxCount: 1 },
    ]))
    async create(
        @Body() createPropertyDto: CreatePropertyDto,
        @UploadedFiles() files: {
            coverPhoto?: Express.Multer.File[];
            mediaImages?: Express.Multer.File[];
            nocDocument?: Express.Multer.File[];
            passportCopy?: Express.Multer.File[];
            emiratesIdScan?: Express.Multer.File[];
            titleDeed?: Express.Multer.File[];
        },
        @GetUser() user: any,
        @Ip() ip: string,
    ) {
        const fileUrls: {
            coverPhoto?: string;
            mediaImages?: string[];
            nocDocument?: string;
            passportCopy?: string;
            emiratesIdScan?: string;
            titleDeed?: string;
        } = {};

        // Upload cover photo
        if (files.coverPhoto?.[0]) {
            const result = await this.uploadService.uploadFile(files.coverPhoto[0]);
            if (result) fileUrls.coverPhoto = result;
        }

        // Upload media images
        if (files.mediaImages?.length) {
            const results = await Promise.all(
                files.mediaImages.map(file => this.uploadService.uploadFile(file))
            );
            fileUrls.mediaImages = results.filter((url): url is string => url !== null);
        }

        // Upload NOC document
        if (files.nocDocument?.[0]) {
            const result = await this.uploadService.uploadFile(files.nocDocument[0]);
            if (result) fileUrls.nocDocument = result;
        }

        // Upload Passport Copy
        if (files.passportCopy?.[0]) {
            const result = await this.uploadService.uploadFile(files.passportCopy[0]);
            if (result) fileUrls.passportCopy = result;
        }

        // Upload Emirates ID
        if (files.emiratesIdScan?.[0]) {
            const result = await this.uploadService.uploadFile(files.emiratesIdScan[0]);
            if (result) fileUrls.emiratesIdScan = result;
        }

        // Upload Title Deed
        if (files.titleDeed?.[0]) {
            const result = await this.uploadService.uploadFile(files.titleDeed[0]);
            if (result) fileUrls.titleDeed = result;
        }

        return this.propertiesService.createWithFiles(createPropertyDto, fileUrls, user?.id, ip);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'coverPhoto', maxCount: 1 },
        { name: 'mediaImages', maxCount: 30 },
        { name: 'nocDocument', maxCount: 1 },
        { name: 'passportCopy', maxCount: 1 },
        { name: 'emiratesIdScan', maxCount: 1 },
        { name: 'titleDeed', maxCount: 1 },
    ]))
    async update(
        @Param('id') id: string,
        @Body() updatePropertyDto: UpdatePropertyDto,
        @UploadedFiles() files: {
            coverPhoto?: Express.Multer.File[];
            mediaImages?: Express.Multer.File[];
            nocDocument?: Express.Multer.File[];
            passportCopy?: Express.Multer.File[];
            emiratesIdScan?: Express.Multer.File[];
            titleDeed?: Express.Multer.File[];
        },
        @GetUser() user: any,
        @Ip() ip: string,
    ) {
        const fileUrls: {
            coverPhoto?: string;
            mediaImages?: string[];
            nocDocument?: string;
            passportCopy?: string;
            emiratesIdScan?: string;
            titleDeed?: string;
        } = {};

        // Upload files if present
        if (files.coverPhoto?.[0]) {
            const result = await this.uploadService.uploadFile(files.coverPhoto[0]);
            if (result) fileUrls.coverPhoto = result;
        }

        if (files.mediaImages?.length) {
            const results = await Promise.all(
                files.mediaImages.map(file => this.uploadService.uploadFile(file))
            );
            fileUrls.mediaImages = results.filter((url): url is string => url !== null);
        }

        if (files.nocDocument?.[0]) {
            const result = await this.uploadService.uploadFile(files.nocDocument[0]);
            if (result) fileUrls.nocDocument = result;
        }

        if (files.passportCopy?.[0]) {
            const result = await this.uploadService.uploadFile(files.passportCopy[0]);
            if (result) fileUrls.passportCopy = result;
        }

        if (files.emiratesIdScan?.[0]) {
            const result = await this.uploadService.uploadFile(files.emiratesIdScan[0]);
            if (result) fileUrls.emiratesIdScan = result;
        }

        if (files.titleDeed?.[0]) {
            const result = await this.uploadService.uploadFile(files.titleDeed[0]);
            if (result) fileUrls.titleDeed = result;
        }

        return this.propertiesService.updateWithFiles(id, updatePropertyDto, fileUrls, user?.id, ip);
    }

    @Patch(':id/status')
    @UseGuards(JwtAuthGuard)
    updateStatus(
        @Param('id') id: string,
        @Body('status') status: 'AVAILABLE' | 'SOLD' | 'RENTED',
        @GetUser() user: any,
        @Ip() ip: string
    ) {
        return this.propertiesService.updateStatus(id, status, user?.id, ip);
    }

    @Patch(':id/toggle-active')
    @UseGuards(JwtAuthGuard)
    toggleActive(
        @Param('id') id: string,
        @Body('isActive') isActive: boolean,
        @GetUser() user: any,
        @Ip() ip: string
    ) {
        return this.propertiesService.toggleActive(id, isActive, user?.id, ip);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    delete(@Param('id') id: string, @GetUser() user: any, @Ip() ip: string) {
        return this.propertiesService.delete(id, user?.id, ip);
    }

    // ============ PROPERTY FINDER SYNC ============

    @Post('sync-to-pf')
    syncFromPropertyFinder(@GetUser() user?: any, @Ip() ip?: string) {
        return this.propertiesService.syncFromPropertyFinder(user?.id, ip);
    }

    @Post(':id/sync-to-pf')
    syncToPropertyFinder(@Param('id') id: string) {
        return this.propertiesService.syncToPropertyFinder(id);
    }

    @Post(':id/publish-to-pf')
    publishToPropertyFinder(@Param('id') id: string) {
        return this.propertiesService.publishToPropertyFinder(id);
    }

    @Post(':id/unpublish-from-pf')
    unpublishFromPropertyFinder(@Param('id') id: string) {
        return this.propertiesService.unpublishFromPropertyFinder(id);
    }

    @Post(':id/sync-from-pf-listing')
    syncPropertyDetailsFromPf(@Param('id') id: string) {
        return this.propertiesService.syncPropertyDetailsFromPf(id);
    }

    @Get(':id/pf-listing')
    getPropertyFinderListing(@Param('id') id: string) {
        return this.propertiesService.getPropertyFinderListing(id);
    }


    @Get(':id/pf-stats')
    getPropertyFinderStats(@Param('id') id: string) {
        return this.propertiesService.getPropertyFinderStats(id);
    }

    @Post('batch-sync-locations')
    batchSyncLocationPaths() {
        return this.propertiesService.batchSyncLocationPaths();
    }

    @Post('fetch-missing-location-paths')
    fetchMissingLocationPaths() {
        return this.propertiesService.fetchMissingLocationPaths();
    }

}
