import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { ActivityService } from '../activity/activity.service';

@Injectable()
export class LeadsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activityService: ActivityService
    ) { }

    async create(createLeadDto: CreateLeadDto, userId?: string, ipAddress?: string, location?: string) {
        let responsibleName: string | undefined;
        let responsibleAgentId: string | undefined;

        // Auto-assign to logged-in agent if no responsible specified
        const agentIdToUse = createLeadDto.responsible || userId;
        if (agentIdToUse) {
            // @ts-ignore Prisma client includes `agent`
            const agent = await this.prisma.agent.findUnique({
                where: { id: agentIdToUse },
                select: { id: true, name: true },
            });
            if (agent) {
                responsibleAgentId = agent.id;
                responsibleName = agent.name;
            }
        }

        // @ts-ignore Generated Prisma client includes `lead` after `npx prisma generate`
        const lead = await this.prisma.lead.create({
            data: {
                ...createLeadDto,
                responsible: responsibleName,
                responsibleAgentId,
                observers: createLeadDto.observers ?? [],
                closingDate: createLeadDto.closingDate ? new Date(createLeadDto.closingDate) : undefined,
            },
            include: {
                responsibleAgent: {
                    select: { id: true, name: true, photoUrl: true },
                },
            },
        });

        if (userId) {
            try {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Created new Lead: ${lead.name}`,
                    ipAddress,
                    location,
                });
            } catch (e) {
                // Agent users may not be in User table — skip activity log
                console.warn(`[LeadsService] Activity log skipped for userId ${userId}:`, e?.message || e);
            }
        }

        return lead;
    }

    async findAll(agentId?: string) {
        const where: any = {};
        if (agentId) {
            where.responsibleAgentId = agentId;
        }

        // @ts-ignore Generated Prisma client includes `lead` after `npx prisma generate`
        return this.prisma.lead.findMany({
            where,
            include: {
                responsibleAgent: {
                    select: { id: true, name: true, photoUrl: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string) {
        // @ts-ignore Generated Prisma client includes `lead` after `npx prisma generate`
        const lead = await this.prisma.lead.findUnique({
            where: { id },
            include: {
                responsibleAgent: {
                    select: { id: true, name: true, photoUrl: true },
                },
            },
        });

        if (!lead) {
            throw new NotFoundException('Lead not found');
        }

        return lead;
    }

    async updateResponsible(leadId: string, agentId: string, userId?: string, ipAddress?: string, location?: string) {
        // @ts-ignore Prisma client includes `agent`
        const agent = await this.prisma.agent.findUnique({
            where: { id: agentId },
            select: { id: true, name: true, photoUrl: true },
        });

        if (!agent) {
            throw new NotFoundException('Agent not found');
        }

        // @ts-ignore Prisma client includes `lead`
        const updatedLead = await this.prisma.lead.update({
            where: { id: leadId },
            data: {
                responsibleAgentId: agent.id,
                responsible: agent.name,
            },
            include: {
                responsibleAgent: {
                    select: { id: true, name: true, photoUrl: true },
                },
            },
        });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Reassigned Lead ${updatedLead.name} to ${agent.name}`,
                ipAddress,
                location,
            });
        }

        return updatedLead;
    }

    async getStats(source?: string) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const lastYear = currentYear - 1;
        const startOfLastYear = new Date(lastYear, 0, 1);

        // Build where clause with optional source filter
        const whereClause: any = {
            createdAt: {
                gte: startOfLastYear,
            },
        };

        // Add source filter if provided (case-insensitive matching)
        if (source && source.toLowerCase() !== 'all') {
            whereClause.source = {
                equals: source,
                mode: 'insensitive',
            };
        }

        // @ts-ignore Generated Prisma client includes `lead`
        const leads = await this.prisma.lead.findMany({
            where: whereClause,
            select: {
                createdAt: true,
                dealPrice: true,
            },
        });

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Initialize stats
        const stats = months.map(month => ({
            month,
            current: 0,
            last: 0,
        }));

        leads.forEach(lead => {
            const date = new Date(lead.createdAt);
            const year = date.getFullYear();
            const monthIdx = date.getMonth();
            const price = lead.dealPrice || 0;

            if (year === currentYear) {
                stats[monthIdx].current += price;
            } else if (year === lastYear) {
                stats[monthIdx].last += price;
            }
        });

        return stats;
    }
    async getLeadSourceStats() {
        const stats = await this.prisma.lead.groupBy({
            by: ['source'],
            _count: {
                _all: true
            }
        });

        const result = {
            facebook: 0,
            instagram: 0,
            tiktok: 0,
            mateluxy: 0, // Website/Other
            total: 0
        };

        stats.forEach(group => {
            const count = group._count._all;
            const source = (group.source || '').toLowerCase();
            result.total += count;

            if (source.includes('facebook')) {
                result.facebook += count;
            } else if (source.includes('instagram')) {
                result.instagram += count;
            } else if (source.includes('tiktok')) {
                result.tiktok += count;
            } else {
                // Default everything else to Mateluxy/Website for now as per design
                result.mateluxy += count;
            }
        });

        return result;
    }
}
