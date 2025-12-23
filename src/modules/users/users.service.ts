import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private uploadService: UploadService,
        private activityService: ActivityService,
    ) { }

    async remove(id: string, currentUserId?: string, ipAddress?: string, location?: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });

        // Admin Protection: Prevent deleting the last Admin
        if (user && user.role === Role.ADMIN) {
            const adminCount = await this.prisma.user.count({
                where: { role: Role.ADMIN }
            });
            if (adminCount <= 1) {
                throw new BadRequestException('Cannot delete the last Administrator account.');
            }
        }

        if (user && user.avatarUrl) {
            await this.uploadService.deleteFile(user.avatarUrl);
        }
        const deletedUser = await this.prisma.user.delete({ where: { id } });

        if (currentUserId && user) {
            await this.activityService.create({
                user: { connect: { id: currentUserId } },
                action: `Deleted User: ${user.fullName}`,
                ipAddress,
                location,
            });
        }
        return deletedUser;
    }

    async update(id: string, updateUserDto: UpdateUserDto, avatarUrl?: string, currentUserId?: string, ipAddress?: string, location?: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });

        if (avatarUrl && user?.avatarUrl) {
            await this.uploadService.deleteFile(user.avatarUrl);
        }

        const data: any = { ...updateUserDto };
        if (avatarUrl) {
            data.avatarUrl = avatarUrl;
        }

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        // Admin Protection: Prevent downgrading the last Admin
        if (user && user.role === Role.ADMIN && data.role && data.role !== Role.ADMIN) {
            const adminCount = await this.prisma.user.count({
                where: { role: Role.ADMIN }
            });
            if (adminCount <= 1) {
                throw new BadRequestException('Cannot change the role of the last Administrator.');
            }
        }

        const updatedUser = await this.prisma.user.update({
            where: { id },
            data,
        });

        if (currentUserId) {
            await this.activityService.create({
                user: { connect: { id: currentUserId } },
                action: `Updated User: ${updatedUser.fullName}`,
                ipAddress,
                location,
            });
        }

        return updatedUser;
    }

    async findOne(usernameOrEmail: string) {
        return this.prisma.user.findFirst({
            where: {
                OR: [
                    { username: usernameOrEmail },
                    { email: usernameOrEmail },
                ],
            },
        });
    }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async create(createUserDto: CreateUserDto, avatarUrl?: string, currentUserId?: string, ipAddress?: string, location?: string) {
        const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
        try {
            const user = await this.prisma.user.create({
                data: {
                    ...createUserDto,
                    role: createUserDto.role ?? Role.MODERATOR,
                    password: hashedPassword,
                    avatarUrl: avatarUrl,
                    permissions: createUserDto.permissions || [],
                },
            });

            if (currentUserId) {
                await this.activityService.create({
                    user: { connect: { id: currentUserId } },
                    action: `Created User: ${user.fullName} (${user.role})`,
                    ipAddress,
                    location,
                });
            }

            return user;
        } catch (error) {
            if (error.code === 'P2002') {
                const target = error.meta?.target;
                if (target?.includes('username')) {
                    throw new ConflictException('Username already exists');
                }
                if (target?.includes('email')) {
                    throw new ConflictException('Email already exists');
                }
                throw new ConflictException('User with this credential already exists');
            }
            throw error;
        }
    }

    async findAll(search?: string, role?: Role | 'All') {
        const where: any = {};

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { username: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        if (role && role !== 'All') {
            where.role = role;
        }

        return this.prisma.user.findMany({
            where,
            select: {
                id: true,
                fullName: true,
                username: true,
                email: true,
                role: true,
                avatarUrl: true,
                permissions: true,
                isActive: true,
                createdAt: true,
                // Exclude sensitive data
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
    }

    async updateRefreshToken(userId: string, refreshToken: string | null) {
        if (refreshToken) {
            refreshToken = await bcrypt.hash(refreshToken, 10);
        }
        await this.prisma.user.update({
            where: { id: userId },
            data: { refreshToken },
        });
    }

    async updateOtp(userId: string, otp: string | null, otpExpiresAt: Date | null) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { otp, otpExpiresAt },
        });
    }

    async updatePassword(userId: string, hashedPassword: string) {
        await this.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
    }

    async findDeviceLock(userId: string, deviceId: string) {
        return this.prisma.otpDeviceLock.findUnique({
            where: {
                userId_deviceId: {
                    userId,
                    deviceId,
                },
            },
        });
    }

    async upsertDeviceLock(userId: string, deviceId: string, attempts: number, lockedUntil: Date | null) {
        return this.prisma.otpDeviceLock.upsert({
            where: {
                userId_deviceId: {
                    userId,
                    deviceId,
                },
            },
            update: {
                attempts,
                lockedUntil,
            },
            create: {
                userId,
                deviceId,
                attempts,
                lockedUntil,
            },
        });
    }
}
