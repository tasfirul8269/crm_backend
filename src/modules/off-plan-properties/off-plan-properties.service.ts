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

        // Handle developer relation properly
        if (data.developerId) {
            data.developer = {
                connect: { id: data.developerId }
            };
            delete data.developerId;
        }

        // Handle creator relations
        if (data.createdByAdminId) {
            data.createdByAdmin = {
                connect: { id: data.createdByAdminId }
            };
            delete data.createdByAdminId;
        }

        if (data.createdByAgentId) {
            data.createdByAgent = {
                connect: { id: data.createdByAgentId }
            };
            delete data.createdByAgentId;
        }

        // Handle array fields that might be sent as null from the frontend
        if (data.propertyType === null) {
            data.propertyType = [];
        }
        if (data.exteriorMedia === null) {
            data.exteriorMedia = [];
        }
        if (data.interiorMedia === null) {
            data.interiorMedia = [];
        }
        if (data.projectExperts === null) {
            data.projectExperts = [];
        }

        // Clean out extra properties sent by unified Flutter App PropertyModel that aren't in OffPlanProperty schema
        const unusedFields = [
            'category', 'purpose', 'clientName', 'nationality', 'phoneCountry', 'phoneNumber', 
            'unitNumber', 'ownershipStatus', 'projectStatus', 'completionDate', 'parkingSpaces', 
            'furnishingType', 'price', 'rentalPeriod', 'numberOfCheques', 'pfLocationId', 
            'pfLocationPath', 'propertyTitle', 'propertyDescription', 'availableFrom', 
            'mediaImages', 'assignedAgentId', 'propertyTypes'
        ];
        for (const field of unusedFields) {
            delete data[field];
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
                createdByAgent: {
                    select: { id: true, name: true, photoUrl: true, phone: true }
                },
                createdByAdmin: {
                    select: { id: true, fullName: true, avatarUrl: true }
                },
            },
        });

        if (userId) {
            try {
                // Check if user exists first to prevent P2025 error, or just catch it
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Created Off-Plan Property: ${property.projectTitle}`,
                    ipAddress,
                    location,
                });
            } catch (err) {
                console.warn(`Failed to create activity log for user ${userId}:`, err.message);
            }
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
        createdByAdminId?: string;
        createdByAgentId?: string;
        agentId?: string;
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
        approvalStatus?: string;
        sortBy?: 'date' | 'price' | 'name';
        sortOrder?: 'asc' | 'desc';
    }) {
        const andConditions: any[] = [];

        // Approval Status filtering
        if (filters.approvalStatus && filters.approvalStatus.toUpperCase() === 'ALL') {
             // Bypass filter
        } else if (filters.approvalStatus) {
             andConditions.push({ approvalStatus: filters.approvalStatus.toUpperCase() });
        } else {
             andConditions.push({ approvalStatus: 'APPROVED' });
        }

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

        if (filters.createdByAdminId) {
            andConditions.push({ createdByAdminId: filters.createdByAdminId });
        }

        if (filters.createdByAgentId) {
            andConditions.push({ createdByAgentId: filters.createdByAgentId });
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

        // Global AgentId Filter (OR relationship for "My Properties" view)
        if (filters.agentId) {
            andConditions.push({
                OR: [
                    { createdByAgentId: filters.agentId },
                    { projectExperts: { hasSome: [filters.agentId] } },
                    {
                        areaExperts: {
                            string_contains: filters.agentId
                        }
                    }
                ]
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
            select: {
                id: true,
                projectTitle: true,
                address: true,
                bedrooms: true,
                bathrooms: true,
                area: true,
                startingPrice: true,
                coverPhoto: true,
                propertyType: true,
                createdAt: true,
                isActive: true,
                developer: {
                    select: {
                        id: true,
                        name: true,
                        logoUrl: true,
                        salesManagerPhone: true,
                    },
                },
                createdByAgent: {
                    select: {
                        id: true,
                        name: true,
                        photoUrl: true,
                        phone: true,
                    }
                },
                createdByAdmin: {
                    select: {
                        id: true,
                        fullName: true,
                        avatarUrl: true,
                    }
                },
                // Include other lightweight fields if needed for filtering in-memory if not filtered by DB,
                // but since filters are applied in 'where', we only need to return what's displayed.
            },
            orderBy,
        });
        const endTime = Date.now();

        console.log(`✅ Query completed in ${endTime - startTime}ms, returned ${results.length} properties. First item developer:`, JSON.stringify(results[0]?.developer, null, 2));

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

    async getTopLocations(limit: number = 4) {
        // OPTIMIZED: Fetch all required data in 2 queries instead of N+1
        const [offPlanProps, standardProps] = await Promise.all([
            this.prisma.offPlanProperty.findMany({
                where: { isActive: true, address: { not: null } },
                select: { address: true, latitude: true, longitude: true }
            }),
            this.prisma.property.findMany({
                where: { isActive: true },
                select: { pfLocationPath: true, address: true, latitude: true, longitude: true }
            })
        ]);

        // Map<MasterName, { count: number, subs: Set<string> }>
        const masterMap = new Map<string, { count: number, subs: Set<string> }>();
        // Map<LocationName, { lat: number, lng: number }>
        const coordMap = new Map<string, { lat: number, lng: number }>();

        // Helper to extract community parts
        const extractParts = (raw: string): { master: string, sub: string } | null => {
            if (!raw) return null;
            if (raw.includes('|') || raw.length > 80 || /^(1|2|3|4|5)\s*(BR|Bedroom)/i.test(raw)) return null;

            // Normalize separators
            let parts = raw.includes(',')
                ? raw.split(',').map(s => s.trim())
                : raw.includes(' - ')
                    ? raw.split(' - ').map(s => s.trim())
                    : raw.includes('>')
                        ? raw.split('>').map(s => s.trim())
                        : [raw.trim()];

            // Remove empty parts
            parts = parts.filter(p => p.length > 0);

            // Pop Country (UAE)
            if (parts.length > 1 && (parts[parts.length - 1].toUpperCase() === 'UNITED ARAB EMIRATES' || parts[parts.length - 1].toUpperCase() === 'UAE')) {
                parts.pop();
            }

            // Pop Emirate (Dubai, Abu Dhabi, etc) - Common ones
            const emirates = ['DUBAI', 'ABU DHABI', 'SHARJAH', 'AJMAN', 'RAS AL KHAIMAH', 'FUJAIRAH', 'UMM AL QUWAIN'];
            if (parts.length > 1 && emirates.includes(parts[parts.length - 1].toUpperCase())) {
                parts.pop();
            }

            if (parts.length === 0) return null;

            // Strategy:
            // Master = Last part (e.g. Dubai Land)
            // Sub = First part (e.g. The Acres)
            // If only 1 part, Master = Sub
            const master = parts[parts.length - 1];
            const sub = parts[0];

            return { master, sub };
        };

        const processItem = (locationStr: string, lat: number | null, lng: number | null) => {
            const parts = extractParts(locationStr);
            if (!parts) return;
            const { master, sub } = parts;

            // Update Counts
            const existing = masterMap.get(master) || { count: 0, subs: new Set<string>() };
            existing.count++;
            existing.subs.add(sub);
            masterMap.set(master, existing);

            // Update Coordinates
            if (lat && lng) {
                // Always try to capture coords for the sub-location
                if (!coordMap.has(sub)) {
                    coordMap.set(sub, { lat, lng });
                }

                // Capture coords for master
                // Priority: Exact match > First available
                if (master === sub) {
                    coordMap.set(master, { lat, lng });
                } else if (!coordMap.has(master)) {
                    coordMap.set(master, { lat, lng });
                }
            }
        };

        // Process All Properties
        offPlanProps.forEach(p => {
            if (p.address) processItem(p.address, p.latitude, p.longitude);
        });

        standardProps.forEach(p => {
            const source = p.pfLocationPath || p.address;
            if (source) processItem(source, p.latitude, p.longitude);
        });

        // Sort and Limit
        const sorted = Array.from(masterMap.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, limit);

        // Build Result
        const results = sorted.map(([masterName, data]) => {
            const masterCoords = coordMap.get(masterName);

            // Build sub-locations list with valid coordinates
            const subLocations = Array.from(data.subs)
                .map(subName => {
                    const coords = coordMap.get(subName);
                    return {
                        name: subName,
                        latitude: coords?.lat || 0,
                        longitude: coords?.lng || 0
                    };
                })
                .filter(s => s.latitude !== 0 && s.longitude !== 0);

            // Fallback for Master Coords: Use first valid sub-location if master has no coords
            let finalLat = masterCoords?.lat;
            let finalLng = masterCoords?.lng;

            if (!finalLat && subLocations.length > 0) {
                finalLat = subLocations[0].latitude;
                finalLng = subLocations[0].longitude;
            }

            return {
                name: masterName,
                count: data.count,
                latitude: finalLat || 25.2048,
                longitude: finalLng || 55.2708,
                subLocations: subLocations
            };
        });

        return results;
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

        const data: any = { ...updateOffPlanPropertyDto };
        if (data.handoverDate) {
            data.handoverDate = new Date(data.handoverDate);
        }

        // Handle developer relation properly
        if (data.developerId !== undefined) {
            if (data.developerId === null) {
                data.developer = { disconnect: true };
            } else {
                data.developer = { connect: { id: data.developerId } };
            }
            delete data.developerId;
        }

        // Handle array fields that might be sent as null from the frontend
        if (data.propertyType === null) {
            data.propertyType = [];
        }
        if (data.exteriorMedia === null) {
            data.exteriorMedia = [];
        }
        if (data.interiorMedia === null) {
            data.interiorMedia = [];
        }
        if (data.projectExperts === null) {
            data.projectExperts = [];
        }

        // Clean out extra properties sent by unified Flutter App PropertyModel that aren't in OffPlanProperty schema
        const unusedFields = [
            'category', 'purpose', 'clientName', 'nationality', 'phoneCountry', 'phoneNumber', 
            'unitNumber', 'ownershipStatus', 'projectStatus', 'completionDate', 'parkingSpaces', 
            'furnishingType', 'price', 'rentalPeriod', 'numberOfCheques', 'pfLocationId', 
            'pfLocationPath', 'propertyTitle', 'propertyDescription', 'availableFrom', 
            'mediaImages', 'assignedAgentId', 'propertyTypes'
        ];
        for (const field of unusedFields) {
            delete data[field];
        }

        const updatedProperty = await this.prisma.offPlanProperty.update({
            where: { id },
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
                createdByAgent: {
                    select: { id: true, name: true, photoUrl: true, phone: true }
                },
                createdByAdmin: {
                    select: { id: true, fullName: true, avatarUrl: true }
                },
            },
        });

        if (userId) {
            try {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Updated Off-Plan Property: ${updatedProperty.projectTitle}`,
                    ipAddress,
                    location,
                });
            } catch (err) {
                console.warn(`Failed to create activity log for user ${userId}:`, err.message);
            }
        }

        return updatedProperty;
    }

    async remove(id: string, userId?: string, ipAddress?: string, location?: string) {
        const property = await this.findOne(id); // Check if exists
        const deleted = await this.prisma.offPlanProperty.delete({ where: { id } });

        if (userId) {
            try {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Deleted Off-Plan Property: ${property.projectTitle}`,
                    ipAddress,
                    location,
                });
            } catch (err) {
                console.warn(`Failed to create activity log for user ${userId}:`, err.message);
            }
        }

        return deleted;
    }
}
