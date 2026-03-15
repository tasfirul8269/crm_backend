import { Body, Controller, Get, Post, UseGuards, UseInterceptors, UploadedFiles, Query, Delete, Patch, Param } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { DevelopersService } from './developers.service';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RealIp } from '../../common/decorators/real-ip.decorator';

@Controller('developers')
export class DevelopersController {
    constructor(
        private readonly developersService: DevelopersService,
        private readonly uploadService: UploadService,
    ) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'salesManagerPhoto', maxCount: 1 },
    ]))
    async create(
        @Body() createDeveloperDto: CreateDeveloperDto,
        @UploadedFiles() files?: { logo?: Express.Multer.File[], salesManagerPhoto?: Express.Multer.File[] },
        @GetUser() user?: any,
        @RealIp() ip?: string,
    ) {
        let logoUrl: string | undefined;
        let salesManagerPhotoUrl: string | undefined;

        if (files?.logo?.[0]) {
            logoUrl = await this.uploadService.uploadFile(files.logo[0]) || undefined;
        }

        if (files?.salesManagerPhoto?.[0]) {
            salesManagerPhotoUrl = await this.uploadService.uploadFile(files.salesManagerPhoto[0]) || undefined;
        }

        // Parse languages if sent as string
        if (typeof createDeveloperDto.languages === 'string') {
            try {
                // Try JSON parse first
                createDeveloperDto.languages = JSON.parse(createDeveloperDto.languages as any);
            } catch (e) {
                // If not JSON, split by comma
                const languagesStr = createDeveloperDto.languages as any;
                if (languagesStr && languagesStr.trim()) {
                    createDeveloperDto.languages = languagesStr.split(',').map((lang: string) => lang.trim()).filter((lang: string) => lang);
                } else {
                    createDeveloperDto.languages = [];
                }
            }
        }

        return this.developersService.create(createDeveloperDto, logoUrl, salesManagerPhotoUrl, user?.id, ip);
    }

    @Get('public')
    findAllPublic() {
        return this.developersService.findAllPublic();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Get()
    findAll(@Query('search') search?: string) {
        return this.developersService.findAll(search);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.developersService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'salesManagerPhoto', maxCount: 1 },
    ]))
    async update(
        @Param('id') id: string,
        @Body() updateDeveloperDto: UpdateDeveloperDto,
        @UploadedFiles() files?: { logo?: Express.Multer.File[], salesManagerPhoto?: Express.Multer.File[] },
        @GetUser() user?: any,
        @RealIp() ip?: string,
    ) {
        let logoUrl: string | undefined;
        let salesManagerPhotoUrl: string | undefined;

        if (files?.logo?.[0]) {
            logoUrl = await this.uploadService.uploadFile(files.logo[0]) || undefined;
        }

        if (files?.salesManagerPhoto?.[0]) {
            salesManagerPhotoUrl = await this.uploadService.uploadFile(files.salesManagerPhoto[0]) || undefined;
        }

        // Parse languages if sent as string
        if (typeof updateDeveloperDto.languages === 'string') {
            try {
                // Try JSON parse first
                updateDeveloperDto.languages = JSON.parse(updateDeveloperDto.languages as any);
            } catch (e) {
                // If not JSON, split by comma
                const languagesStr = updateDeveloperDto.languages as any;
                if (languagesStr && languagesStr.trim()) {
                    updateDeveloperDto.languages = languagesStr.split(',').map((lang: string) => lang.trim()).filter((lang: string) => lang);
                } else {
                    updateDeveloperDto.languages = [];
                }
            }
        }

        // Handle isActive boolean conversion
        if (updateDeveloperDto.isActive !== undefined) {
            // @ts-ignore
            if (String(updateDeveloperDto.isActive) === 'true') {
                updateDeveloperDto.isActive = true;
            } else if (String(updateDeveloperDto.isActive) === 'false') {
                updateDeveloperDto.isActive = false;
            }
        }

        return this.developersService.update(id, updateDeveloperDto, logoUrl, salesManagerPhotoUrl, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    remove(@Param('id') id: string, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.developersService.remove(id, user?.id, ip);
    }
}
