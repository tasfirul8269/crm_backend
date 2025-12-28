
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { encryptValue, decryptValue, isEncrypted } from '../../common/utils/crypto.util';

// Fields that should be encrypted for security
const SENSITIVE_FIELDS = ['apiKey', 'apiSecret', 'accessToken', 'accessKeyId', 'secretAccessKey'];

@Injectable()
export class IntegrationsService {
    constructor(private prisma: PrismaService) { }

    /**
     * Encrypt sensitive fields in credentials object before storing
     */
    private encryptCredentials(credentials: any): any {
        if (!credentials || typeof credentials !== 'object') return credentials;

        const encrypted = { ...credentials };
        for (const field of SENSITIVE_FIELDS) {
            if (encrypted[field] && typeof encrypted[field] === 'string' && !isEncrypted(encrypted[field])) {
                encrypted[field] = encryptValue(encrypted[field]);
            }
        }
        return encrypted;
    }

    /**
     * Decrypt sensitive fields in credentials object when retrieving
     */
    private decryptCredentials(credentials: any): any {
        if (!credentials || typeof credentials !== 'object') return credentials;

        const decrypted = { ...credentials };
        for (const field of SENSITIVE_FIELDS) {
            if (decrypted[field] && typeof decrypted[field] === 'string' && isEncrypted(decrypted[field])) {
                decrypted[field] = decryptValue(decrypted[field]);
            }
        }
        return decrypted;
    }

    async findAll() {
        // Return configs but keep credentials encrypted for security
        // Frontend doesn't need to see the actual credential values
        return this.prisma.integrationConfig.findMany();
    }

    async findOne(provider: string) {
        return this.prisma.integrationConfig.findUnique({
            where: { provider },
        });
    }

    async update(provider: string, data: { isEnabled?: boolean; credentials?: any }) {
        // Encrypt sensitive credential fields before storing
        const encryptedData = {
            ...data,
            credentials: data.credentials ? this.encryptCredentials(data.credentials) : undefined,
        };

        return this.prisma.integrationConfig.upsert({
            where: { provider },
            update: encryptedData,
            create: {
                provider,
                isEnabled: data.isEnabled ?? false,
                credentials: encryptedData.credentials ?? {},
            },
        });
    }

    async remove(provider: string) {
        try {
            return await this.prisma.integrationConfig.delete({
                where: { provider },
            });
        } catch (e) {
            // Ignore if not found
            return null;
        }
    }

    // Helper for other services to get credentials without needing to care about DB structure
    // Decrypts sensitive fields before returning
    async getCredentials(provider: string) {
        const config = await this.findOne(provider);
        if (!config || !config.isEnabled) return null;
        // Decrypt sensitive fields before returning for use
        return this.decryptCredentials(config.credentials);
    }

    async getNotifications(limit = 10) {
        const prisma = this.prisma as any;
        if (!prisma.notification) return [];
        return prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    async markNotificationsRead() {
        const prisma = this.prisma as any;
        if (!prisma.notification) return;
        return prisma.notification.updateMany({
            where: { isRead: false },
            data: { isRead: true }
        });
    }
}
