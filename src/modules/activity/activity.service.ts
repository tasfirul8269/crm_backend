import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as geoip from 'geoip-lite';

@Injectable()
export class ActivityService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.ActivityLogCreateInput) {
        // Enrich with location if ipAddress is present but location is missing
        if (data.ipAddress && !data.location) {
            const geo = geoip.lookup(data.ipAddress);
            if (geo) {
                const city = geo.city ? `${geo.city}, ` : '';
                data.location = `${city}${geo.country}`;
            }
        }

        try {
            return await this.prisma.activityLog.create({
                data,
            });
        } catch (error) {
            // P2025 is Prisma's "Record to connect not found" error
            // If the user doesn't exist, we just skip logging the activity to prevent breaking the flow
            if (error.code === 'P2025') {
                console.warn(`Skipped activity log creation: User not found for log action "${data.action}"`);
                return null;
            }
            throw error;
        }
    }

    async findAll(params: {
        skip?: number;
        take?: number;
        cursor?: Prisma.ActivityLogWhereUniqueInput;
        where?: Prisma.ActivityLogWhereInput;
        orderBy?: Prisma.ActivityLogOrderByWithRelationInput;
    }) {
        const { skip, take, cursor, where, orderBy } = params;
        return this.prisma.activityLog.findMany({
            skip,
            take,
            cursor,
            where,
            orderBy,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
        });
    }
}
