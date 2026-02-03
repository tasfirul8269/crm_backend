import { Body, Controller, Get, Post, UseGuards, UseInterceptors, UploadedFiles, Query, Delete, Patch, Param } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AgentsService } from './agents.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { RealIp } from '../../common/decorators/real-ip.decorator';

@Controller('agents')
export class AgentsController {
    constructor(
        private readonly agentsService: AgentsService,
        private readonly uploadService: UploadService,
    ) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post('sync')
    @Post('sync')
    syncFromPropertyFinder(@GetUser() user?: any, @RealIp() ip?: string) {
        return this.agentsService.syncFromPropertyFinder(user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post()
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'photo', maxCount: 1 },
        { name: 'vcard', maxCount: 1 },
    ]))
    async create(
        @Body() createAgentDto: CreateAgentDto,
        @UploadedFiles() files?: { photo?: Express.Multer.File[], vcard?: Express.Multer.File[], licenseDocument?: Express.Multer.File[] },
        @GetUser() user?: any,
        @RealIp() ip?: string,
    ) {
        let photoUrl: string | undefined;
        let vcardUrl: string | undefined;

        if (files?.photo?.[0]) {
            photoUrl = await this.uploadService.uploadFile(files.photo[0]) || undefined;
        }

        if (files?.vcard?.[0]) {
            vcardUrl = await this.uploadService.uploadFile(files.vcard[0]) || undefined;
        }

        // Parse arrays if sent as string
        if (typeof createAgentDto.languages === 'string') {
            try {
                createAgentDto.languages = JSON.parse(createAgentDto.languages as any);
            } catch (e) {
                const languagesStr = createAgentDto.languages as any;
                if (languagesStr && languagesStr.trim()) {
                    createAgentDto.languages = languagesStr.split(',').map((lang: string) => lang.trim()).filter((lang: string) => lang);
                } else {
                    createAgentDto.languages = [];
                }
            }
        }

        if (typeof createAgentDto.areasExpertIn === 'string') {
            try {
                createAgentDto.areasExpertIn = JSON.parse(createAgentDto.areasExpertIn as any);
            } catch (e) {
                const areasStr = createAgentDto.areasExpertIn as any;
                if (areasStr && areasStr.trim()) {
                    createAgentDto.areasExpertIn = areasStr.split(',').map((area: string) => area.trim()).filter((area: string) => area);
                } else {
                    createAgentDto.areasExpertIn = [];
                }
            }
        }

        let licenseDocumentUrl: string | undefined;

        if (files?.licenseDocument?.[0]) {
            licenseDocumentUrl = await this.uploadService.uploadFile(files.licenseDocument[0]) || undefined;
        }

        return this.agentsService.create(createAgentDto, photoUrl, vcardUrl, licenseDocumentUrl, user?.id, ip);
    }


    // Get top agents by sold/rented properties for dashboard
    @UseGuards(JwtAuthGuard)
    @Get('top')
    getTopAgents(@Query('limit') limit?: string) {
        return this.agentsService.getTopAgents(limit ? parseInt(limit, 10) : 10);
    }

    // Public endpoint - no auth required for agent search by area
    @Get('by-area')
    findByArea(@Query('area') area: string) {
        return this.agentsService.findByArea(area);
    }

    // Public endpoint for Login Autocomplete
    @Get('search')
    searchAgents(@Query('query') query: string) {
        // Basic optimization: don't even hit DB if query is short
        if (!query || query.length < 3) return [];
        return this.agentsService.searchPublic(query);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Get()
    findAll(@Query('search') search?: string, @Query('isActive') isActive?: string) {
        const activeBool = isActive !== undefined ? isActive === 'true' : undefined;
        return this.agentsService.findAll(search, activeBool);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.agentsService.findOne(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'photo', maxCount: 1 },
        { name: 'vcard', maxCount: 1 },
        { name: 'licenseDocument', maxCount: 1 },
    ]))
    async update(
        @Param('id') id: string,
        @Body() updateAgentDto: UpdateAgentDto,
        @UploadedFiles() files?: { photo?: Express.Multer.File[], vcard?: Express.Multer.File[], licenseDocument?: Express.Multer.File[] },
        @GetUser() user?: any,
        @RealIp() ip?: string,
    ) {
        let photoUrl: string | undefined;
        let vcardUrl: string | undefined;

        if (files?.photo?.[0]) {
            photoUrl = await this.uploadService.uploadFile(files.photo[0]) || undefined;
        }

        if (files?.vcard?.[0]) {
            vcardUrl = await this.uploadService.uploadFile(files.vcard[0]) || undefined;
        }

        // Parse arrays if sent as string
        if (typeof updateAgentDto.languages === 'string') {
            try {
                updateAgentDto.languages = JSON.parse(updateAgentDto.languages as any);
            } catch (e) {
                const languagesStr = updateAgentDto.languages as any;
                if (languagesStr && languagesStr.trim()) {
                    updateAgentDto.languages = languagesStr.split(',').map((lang: string) => lang.trim()).filter((lang: string) => lang);
                } else {
                    updateAgentDto.languages = [];
                }
            }
        }

        if (typeof updateAgentDto.areasExpertIn === 'string') {
            try {
                updateAgentDto.areasExpertIn = JSON.parse(updateAgentDto.areasExpertIn as any);
            } catch (e) {
                const areasStr = updateAgentDto.areasExpertIn as any;
                if (areasStr && areasStr.trim()) {
                    updateAgentDto.areasExpertIn = areasStr.split(',').map((area: string) => area.trim()).filter((area: string) => area);
                } else {
                    updateAgentDto.areasExpertIn = [];
                }
            }
        }

        // Handle isActive boolean conversion
        if (updateAgentDto.isActive !== undefined) {
            // @ts-ignore
            if (String(updateAgentDto.isActive) === 'true') {
                updateAgentDto.isActive = true;
            } else if (String(updateAgentDto.isActive) === 'false') {
                updateAgentDto.isActive = false;
            }
        }

        let licenseDocumentUrl: string | undefined;

        if (files?.licenseDocument?.[0]) {
            licenseDocumentUrl = await this.uploadService.uploadFile(files.licenseDocument[0]) || undefined;
        }

        return this.agentsService.update(id, updateAgentDto, photoUrl, vcardUrl, licenseDocumentUrl, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Delete(':id')
    remove(@Param('id') id: string, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.agentsService.remove(id, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/activate')
    activate(@Param('id') id: string, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.agentsService.activate(id, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Patch(':id/deactivate')
    deactivate(@Param('id') id: string, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.agentsService.deactivate(id, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @Post(':id/submit-verification')
    submitForVerification(@Param('id') id: string, @GetUser() user?: any, @RealIp() ip?: string) {
        return this.agentsService.submitForVerification(id, user?.id, ip);
    }
}
