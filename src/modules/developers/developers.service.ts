import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDeveloperDto } from './dto/create-developer.dto';
import { UpdateDeveloperDto } from './dto/update-developer.dto';
import { UploadService } from '../upload/upload.service';
import { ActivityService } from '../activity/activity.service';
import { FileManagerService } from '../file-manager/file-manager.service';

@Injectable()
export class DevelopersService {
    constructor(
        private prisma: PrismaService,
        private uploadService: UploadService,
        private activityService: ActivityService,
        private fileManagerService: FileManagerService,
    ) { }

    async create(createDeveloperDto: CreateDeveloperDto, logoUrl?: string, salesManagerPhotoUrl?: string, userId?: string, ipAddress?: string, location?: string) {
        try {
            const developer = await this.prisma.developer.create({
                data: {
                    ...createDeveloperDto,
                    logoUrl,
                    salesManagerPhotoUrl,
                    languages: createDeveloperDto.languages || [],
                },
            });

            if (userId) {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Created Developer: ${developer.name}`,
                    ipAddress,
                    location,
                });
            }

            // Create File Manager Folder
            this.fileManagerService.createDeveloperFolder(developer, logoUrl, salesManagerPhotoUrl).catch(e => {
                console.error('Failed to create developer file folder', e);
            });

            return developer;
        } catch (error) {
            if (error.code === 'P2002') {
                throw new ConflictException('Developer with this email already exists');
            }
            throw error;
        }
    }

    async findAll(search?: string) {
        const where: any = {
            isActive: true,
        };

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.developer.findMany({
            where,
            include: {
                _count: {
                    select: { properties: true },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async findOne(id: string) {
        const developer = await this.prisma.developer.findUnique({
            where: { id },
            include: {
                properties: true,
            },
        });

        if (!developer) {
            throw new NotFoundException('Developer not found');
        }

        return developer;
    }

    async update(id: string, updateDeveloperDto: UpdateDeveloperDto, logoUrl?: string, salesManagerPhotoUrl?: string, userId?: string, ipAddress?: string, location?: string) {
        const developer = await this.prisma.developer.findUnique({ where: { id } });

        if (!developer) {
            throw new NotFoundException('Developer not found');
        }

        // Delete old files if new ones are uploaded
        if (logoUrl && developer.logoUrl) {
            await this.uploadService.deleteFile(developer.logoUrl);
        }

        if (salesManagerPhotoUrl && developer.salesManagerPhotoUrl) {
            await this.uploadService.deleteFile(developer.salesManagerPhotoUrl);
        }

        const data: any = { ...updateDeveloperDto };
        if (logoUrl) data.logoUrl = logoUrl;
        if (salesManagerPhotoUrl) data.salesManagerPhotoUrl = salesManagerPhotoUrl;

        const updatedDeveloper = await this.prisma.developer.update({
            where: { id },
            data,
        });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Updated Developer: ${updatedDeveloper.name}`,
                ipAddress,
                location,
            });
        }

        return updatedDeveloper;
    }

    async remove(id: string, userId?: string, ipAddress?: string, location?: string) {
        const developer = await this.prisma.developer.findUnique({ where: { id } });

        if (!developer) {
            throw new NotFoundException('Developer not found');
        }

        // Delete files from S3
        if (developer.logoUrl) {
            await this.uploadService.deleteFile(developer.logoUrl);
        }

        if (developer.salesManagerPhotoUrl) {
            await this.uploadService.deleteFile(developer.salesManagerPhotoUrl);
        }

        const deleted = await this.prisma.developer.delete({ where: { id } });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Deleted Developer: ${developer.name}`,
                ipAddress,
                location,
            });
        }

        return deleted;
    }
}
