import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOffPlanPropertyDto } from './dto/create-off-plan-property.dto';
import { UpdateOffPlanPropertyDto } from './dto/update-off-plan-property.dto';
import { ActivityService } from '../activity/activity.service';
import { FileManagerService } from '../file-manager/file-manager.service';

@Injectable()
export class OffPlanPropertiesService {
    constructor(
        private prisma: PrismaService,
        private activityService: ActivityService,
        private fileManagerService: FileManagerService,
    ) { }

    async create(createOffPlanPropertyDto: CreateOffPlanPropertyDto, userId?: string, ipAddress?: string, location?: string) {
        // Convert handoverDate string to Date object if it exists
        const data: any = { ...createOffPlanPropertyDto };
        if (data.handoverDate) {
            data.handoverDate = new Date(data.handoverDate);
        }

        const property = await this.prisma.offPlanProperty.create({
            data,
            include: {
                developer: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        salesManagerPhone: true,
                    },
                },
            },
        });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Created Off-Plan Property: ${property.projectTitle}`,
                ipAddress,
                location,
            });
        }

        // Create File Manager Structure
        this.fileManagerService.createOffPlanStructure(property, createOffPlanPropertyDto).catch(e => {
            console.error('Failed to create off-plan file manager structure', e);
        });

        return property;
    }

    async findAll(filters: {
        search?: string;
        developerId?: string;
        areaExpertIds?: string[];
        projectExpertIds?: string[];
        propertyType?: string[];
        minPrice?: number;
        maxPrice?: number;
        minArea?: number;
        maxArea?: number;
        status?: string;
        reference?: string;
        location?: string;
        category?: string;
        permitNumber?: string;
        sortBy?: 'date' | 'price' | 'name';
        sortOrder?: 'asc' | 'desc';
    }) {
        const andConditions: any[] = [];

        // Status filtering
        if (filters.status) {
            if (filters.status === 'published') andConditions.push({ isActive: true });
            else if (filters.status === 'draft' || filters.status === 'unpublished') andConditions.push({ isActive: false });
        }
        // If no status filter is applied, show all properties (both active and inactive)

        if (filters.search) {
            andConditions.push({
                OR: [
                    { emirate: { contains: filters.search, mode: 'insensitive' as const } },
                    { projectHighlight: { contains: filters.search, mode: 'insensitive' as const } },
                    { projectTitle: { contains: filters.search, mode: 'insensitive' as const } },
                ]
            });
        }

        if (filters.developerId) {
            andConditions.push({ developerId: filters.developerId });
        }

        // Filter by project experts
        if (filters.projectExpertIds && filters.projectExpertIds.length > 0) {
            andConditions.push({ projectExperts: { hasSome: filters.projectExpertIds } });
        }

        // Filter by area experts - checking if JSON string contains the agent ID
        if (filters.areaExpertIds && filters.areaExpertIds.length > 0) {
            andConditions.push({
                OR: filters.areaExpertIds.map(id => ({
                    areaExperts: {
                        string_contains: id
                    }
                }))
            });
        }

        if (filters.propertyType && filters.propertyType.length > 0) {
            andConditions.push({ propertyType: { hasSome: filters.propertyType } });
        }

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            const priceCondition: any = {};
            if (filters.minPrice !== undefined) priceCondition.gte = filters.minPrice;
            if (filters.maxPrice !== undefined) priceCondition.lte = filters.maxPrice;

            if (filters.minPrice === 0 || filters.minPrice === undefined) {
                // If min price is 0, include properties with null price (drafts)
                andConditions.push({
                    OR: [
                        { startingPrice: priceCondition },
                        { startingPrice: null }
                    ]
                });
            } else {
                andConditions.push({ startingPrice: priceCondition });
            }
        }

        if (filters.minArea !== undefined || filters.maxArea !== undefined) {
            const areaCondition: any = {};
            if (filters.minArea !== undefined) areaCondition.gte = filters.minArea;
            if (filters.maxArea !== undefined) areaCondition.lte = filters.maxArea;

            if (filters.minArea === 0 || filters.minArea === undefined) {
                // If min area is 0, include properties with null area (drafts)
                andConditions.push({
                    OR: [
                        { area: areaCondition },
                        { area: null }
                    ]
                });
            } else {
                andConditions.push({ area: areaCondition });
            }
        }

        if (filters.reference) {
            andConditions.push({ reference: { contains: filters.reference, mode: 'insensitive' as const } });
        }

        if (filters.permitNumber) {
            andConditions.push({ dldPermitNumber: { contains: filters.permitNumber, mode: 'insensitive' as const } });
        }

        if (filters.location) {
            andConditions.push({
                OR: [
                    { address: { contains: filters.location, mode: 'insensitive' as const } },
                    { emirate: { contains: filters.location, mode: 'insensitive' as const } }
                ]
            });
        }

        const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

        // Category filter (if you want to add a category field to your schema, otherwise skip)
        // For now, skipping category as it's not in the schema

        console.log('🔍 PRISMA WHERE CLAUSE:', JSON.stringify(where, null, 2));
        console.log('🔍 AND CONDITIONS COUNT:', andConditions.length);

        const startTime = Date.now();

        // Sorting
        const inputSortBy = filters.sortBy || 'date';
        const inputSortOrder = filters.sortOrder || 'desc';

        let orderBy: any = {};

        switch (inputSortBy) {
            case 'price':
                orderBy = { startingPrice: inputSortOrder };
                break;
            case 'name':
                orderBy = { projectTitle: inputSortOrder };
                break;
            case 'date':
            default:
                orderBy = { createdAt: inputSortOrder };
                break;
        }

        const results = await this.prisma.offPlanProperty.findMany({
            where,
            include: {
                developer: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        salesManagerPhone: true,
                    },
                },
            },
            orderBy,
        });
        const endTime = Date.now();

        console.log(`✅ Query completed in ${endTime - startTime}ms, returned ${results.length} properties`);

        return results;
    }

    async getAggregates() {
        const aggregates = await this.prisma.offPlanProperty.aggregate({
            _min: {
                startingPrice: true,
                area: true,
            },
            _max: {
                startingPrice: true,
                area: true,
            },
        });

        return {
            minPrice: aggregates._min.startingPrice || 0,
            maxPrice: aggregates._max.startingPrice || 100000000, // Default fallback
            minArea: aggregates._min.area || 0,
            maxArea: aggregates._max.area || 10000, // Default fallback
        };
    }

    async findOne(id: string) {
        const property = await this.prisma.offPlanProperty.findUnique({
            where: { id },
            include: {
                developer: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        salesManagerPhone: true,
                    },
                },
            },
        });

        if (!property) {
            throw new NotFoundException(`Property with ID ${id} not found`);
        }

        return property;
    }

    async update(id: string, updateOffPlanPropertyDto: UpdateOffPlanPropertyDto, userId?: string, ipAddress?: string, location?: string) {
        await this.findOne(id); // Check if exists

        const updatedProperty = await this.prisma.offPlanProperty.update({
            where: { id },
            data: updateOffPlanPropertyDto,
            include: {
                developer: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        salesManagerPhone: true,
                    },
                },
            },
        });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Updated Off-Plan Property: ${updatedProperty.projectTitle}`,
                ipAddress,
                location,
            });
        }

        return updatedProperty;
    }

    async remove(id: string, userId?: string, ipAddress?: string, location?: string) {
        const property = await this.findOne(id); // Check if exists
        const deleted = await this.prisma.offPlanProperty.delete({ where: { id } });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Deleted Off-Plan Property: ${property.projectTitle}`,
                ipAddress,
                location,
            });
        }

        return deleted;
    }
}
