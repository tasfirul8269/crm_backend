
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { encryptValue, decryptValue } from '../../common/utils/crypto.util';
import { CreatePasswordDto } from './dto/create-password.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class PasswordsService {
    constructor(private prisma: PrismaService) { }

    async create(createPasswordDto: CreatePasswordDto, creatorId: string) {
        const encryptedUsername = encryptValue(createPasswordDto.username);
        const encryptedPassword = encryptValue(createPasswordDto.password);

        return this.prisma.passwordEntry.create({
            data: {
                ...createPasswordDto,
                username: encryptedUsername,
                password: encryptedPassword,
                createdBy: creatorId,
            }
        });
    }

    async findAll(userId: string, role: string) {
        // Enforce Strict Access Control:
        // Only return passwords that the user has explicit access to (or created).
        // Unauthorized passwords are NOT returned at all (remain hidden).

        const entries = await this.prisma.passwordEntry.findMany({
            where: {
                OR: [
                    { createdBy: userId },
                    { accessIds: { has: userId } }
                ]
            },
            orderBy: { createdAt: 'desc' },
        });

        // Since we are now filtering strictly, we can safely return the decrypted credentials
        // because the user IS authorized to see every entry in this list.
        return entries.map(entry => ({
            id: entry.id,
            title: entry.title,
            username: decryptValue(entry.username),
            password: decryptValue(entry.password),
            note: entry.note,
            logoUrl: entry.logoUrl,
            createdAt: entry.createdAt,
            hasAccess: true, // Always true for the filtered list
            accessIds: entry.accessIds, // Helpful for edit form
        }));
    }

    async findOne(id: string, userId: string, role: string) {
        const entry = await this.prisma.passwordEntry.findUnique({
            where: { id },
        });

        if (!entry) {
            throw new NotFoundException('Password entry not found');
        }

        // Strict Access Control
        const hasAccess = entry.accessIds.includes(userId) || entry.createdBy === userId;

        if (!hasAccess) {
            throw new ForbiddenException('You do not have access to this password');
        }

        return {
            ...entry,
            username: decryptValue(entry.username),
            password: decryptValue(entry.password),
        };
    }

    async update(id: string, updatePasswordDto: UpdatePasswordDto, userId: string, role: string) {
        const entry = await this.prisma.passwordEntry.findUnique({
            where: { id },
        });

        if (!entry) {
            throw new NotFoundException('Password entry not found');
        }

        // Strict Access Control for Edit
        const hasAccess = entry.accessIds.includes(userId) || entry.createdBy === userId;
        if (!hasAccess) {
            throw new ForbiddenException('You do not have permission to edit this password');
        }

        const data: any = { ...updatePasswordDto };

        if (updatePasswordDto.username) {
            data.username = encryptValue(updatePasswordDto.username);
        }
        if (updatePasswordDto.password) {
            data.password = encryptValue(updatePasswordDto.password);
        }

        return this.prisma.passwordEntry.update({
            where: { id },
            data,
        });
    }

    async remove(id: string, userId: string, role: string) {
        const entry = await this.prisma.passwordEntry.findUnique({
            where: { id },
        });

        if (!entry) {
            throw new NotFoundException('Password entry not found');
        }

        // Strict Access Control for Delete
        const canDelete = entry.accessIds.includes(userId) || entry.createdBy === userId;
        if (!canDelete) {
            throw new ForbiddenException('You do not have permission to delete this entry');
        }

        return this.prisma.passwordEntry.delete({
            where: { id },
        });
    }
}
