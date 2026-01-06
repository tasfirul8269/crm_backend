import { Body, Controller, Get, Post, UseGuards, UseInterceptors, UploadedFile, Query, Delete, Patch, Param } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { UploadService } from '../upload/upload.service';
import { RealIp } from '../../common/decorators/real-ip.decorator';

@Controller('users')
export class UsersController {
    constructor(
        private readonly usersService: UsersService,
        private readonly uploadService: UploadService,
    ) { }

    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Permissions('Users')
    @Post('create')
    @UseInterceptors(FileInterceptor('avatar'))
    async create(
        @Body() createUserDto: CreateUserDto,
        @GetUser() user: any,
        @UploadedFile() file?: Express.Multer.File,
        @RealIp() ip?: string,
    ) {
        try {
            console.log('File received:', file ? `Yes - ${file.originalname}` : 'No file');
            console.log('CreateUserDto:', createUserDto);

            let avatarUrl: string | undefined;
            if (file) {
                const uploadedUrl = await this.uploadService.uploadFile(file);
                console.log('Upload result:', uploadedUrl);
                avatarUrl = uploadedUrl || undefined;
            }

            // Ensure permissions is an array (handle multipart/form-data string)
            if (typeof createUserDto.permissions === 'string') {
                try {
                    createUserDto.permissions = JSON.parse(createUserDto.permissions);
                } catch (e) {
                    console.error('Failed to parse permissions:', e);
                    createUserDto.permissions = [];
                }
            }

            const result = await this.usersService.create(createUserDto, avatarUrl, user?.id, ip);
            console.log('User created with avatarUrl:', result.avatarUrl);
            console.log('User created with permissions:', result.permissions);
            return result;
        } catch (error) {
            console.error('Error creating user:', error);
            // Write error to file for debugging
            const fs = require('fs');
            fs.writeFileSync('backend_error.log', `Error: ${JSON.stringify(error, null, 2)}\nStack: ${error.stack}\n`);
            throw error;
        }
    }

    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN, Role.MODERATOR)
    @Permissions('Users')
    @Get()
    findAll(
        @Query('search') search?: string,
        @Query('role') role?: Role | 'All',
    ) {
        return this.usersService.findAll(search, role);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getMe(@GetUser() user: any) {
        return this.usersService.findById(user.id);
    }

    @UseGuards(JwtAuthGuard)
    async updateMenuOrder(
        @GetUser() user: any,
        @Body() body: { menuOrder: string[] },
    ) {
        return this.usersService.updateMenuOrder(user.id, body.menuOrder);
    }

    @UseGuards(JwtAuthGuard)
    @Patch('me/notification-settings')
    @UseInterceptors(FileInterceptor('notificationSound'))
    async updateNotificationSettings(
        @GetUser() user: any,
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let notificationSoundUrl: string | undefined;
        if (file) {
            notificationSoundUrl = await this.uploadService.uploadFile(file) || undefined;
        } else if (body.notificationSoundUrl !== undefined) {
            notificationSoundUrl = body.notificationSoundUrl;
        }

        // Parse numeric/boolean fields from FormData (they come as strings)
        const data: any = {};
        if (body.notificationSoundStart !== undefined) data.notificationSoundStart = parseFloat(body.notificationSoundStart);
        if (body.notificationSoundEnd !== undefined) data.notificationSoundEnd = parseFloat(body.notificationSoundEnd);
        if (body.useCustomNotificationSound !== undefined) {
            data.useCustomNotificationSound = String(body.useCustomNotificationSound) === 'true';
        }

        return this.usersService.updateNotificationSettings(user.id, data, notificationSoundUrl);
    }

    @UseGuards(JwtAuthGuard)
    @Get('me/notification-sounds')
    async getNotificationSounds(@GetUser() user: any) {
        return this.usersService.getNotificationSounds(user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('me/notification-sounds/:id')
    async deleteNotificationSound(@GetUser() user: any, @Param('id') id: string) {
        return this.usersService.deleteNotificationSound(user.id, id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN)
    @Permissions('Users')
    @Delete(':id')
    remove(@Param('id') id: string, @GetUser() user: any, @RealIp() ip?: string) {
        return this.usersService.remove(id, user?.id, ip);
    }

    @UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
    @Roles(Role.ADMIN)
    @Permissions('Users')
    @Patch(':id')
    @UseInterceptors(FileInterceptor('avatar'))
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto,
        @GetUser() user: any,
        @UploadedFile() file?: Express.Multer.File,
        @RealIp() ip?: string,
    ) {
        let avatarUrl: string | undefined;
        if (file) {
            avatarUrl = await this.uploadService.uploadFile(file) || undefined;
        }

        // Ensure permissions is an array (handle multipart/form-data string)
        if (typeof updateUserDto.permissions === 'string') {
            try {
                updateUserDto.permissions = JSON.parse(updateUserDto.permissions);
            } catch (e) {
                console.error('Failed to parse permissions:', e);
                updateUserDto.permissions = [];
            }
        }

        // Handle isActive boolean conversion from string (multipart/form-data)
        if (updateUserDto.isActive !== undefined) {
            // @ts-ignore - handling potential string input from FormData
            if (String(updateUserDto.isActive) === 'true') {
                updateUserDto.isActive = true;
            } else if (String(updateUserDto.isActive) === 'false') {
                updateUserDto.isActive = false;
            }
        }

        return this.usersService.update(id, updateUserDto, avatarUrl, user?.id, ip);
    }
}
