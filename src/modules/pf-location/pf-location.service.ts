import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PropertyFinderService } from '../property-finder/property-finder.service';

@Injectable()
export class PfLocationService {
    private readonly logger = new Logger(PfLocationService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly propertyFinderService: PropertyFinderService,
    ) { }

    /**
     * Get location path by ID using cache-first strategy
     * 1. Check local cache (PfLocation table)
     * 2. If not found, fetch from Property Finder API
     * 3. Cache the result for future lookups (including negative results)
     * @param locationId - Property Finder location ID
     * @returns Location path string (e.g., "Dubai > Dubai Marina") or null
     */
    async getLocationPath(locationId: number): Promise<string | null> {
        if (!locationId) return null;

        try {
            // Step 1: Check cache first (FAST)
            const cached = await this.prisma.pfLocation.findUnique({
                where: { id: locationId }
            });

            if (cached) {
                // If it's a "not found" marker, return null without calling API again
                if (cached.path === '__NOT_FOUND__') {
                    return null;
                }
                return cached.path;
            }

            // Step 2: Not in cache - fetch from Property Finder API (SLOW)
            this.logger.log(`Location ${locationId} not in cache, fetching from PF API...`);
            const pfLocation = await this.propertyFinderService.getLocationById(locationId);

            if (!pfLocation) {
                // Cache the negative result so we don't keep calling the API
                this.logger.warn(`Location ${locationId} not found in Property Finder - caching negative result`);
                await this.prisma.pfLocation.create({
                    data: {
                        id: locationId,
                        name: 'Unknown',
                        path: '__NOT_FOUND__',
                        type: null,
                        lat: null,
                        lng: null,
                    }
                }).catch(() => {
                    // Ignore duplicate key errors (race condition)
                });
                return null;
            }

            // Step 3: Build the path from the PF response
            const path = this.buildLocationPath(pfLocation);
            const name = this.extractLocationName(pfLocation);

            if (!path || !name) {
                this.logger.warn(`Could not build path for location ${locationId}`);
                return null;
            }

            // Step 4: Cache for future lookups
            await this.prisma.pfLocation.create({
                data: {
                    id: locationId,
                    name: name,
                    path: path,
                    type: pfLocation.type || null,
                    lat: pfLocation.coordinates?.lat || null,
                    lng: pfLocation.coordinates?.lng || null,
                }
            });

            this.logger.log(`Cached location ${locationId}: ${path}`);
            return path;

        } catch (error: any) {
            this.logger.error(`Failed to get location path for ${locationId}`, error);
            return null;
        }
    }

    /**
     * Get full location details by ID (including name, coordinates, etc.)
     * Uses cache-first strategy
     */
    async getLocationDetails(locationId: number) {
        if (!locationId) return null;

        // Check cache first
        const cached = await this.prisma.pfLocation.findUnique({
            where: { id: locationId }
        });

        if (cached) {
            return cached;
        }

        // Fetch and cache
        await this.getLocationPath(locationId);

        // Return the newly cached entry
        return this.prisma.pfLocation.findUnique({
            where: { id: locationId }
        });
    }

    /**
     * Build location path from Property Finder location data
     */
    private buildLocationPath(location: any): string | null {
        // Priority 1: Use full_name if available (already formatted by PF)
        if (location?.full_name && typeof location.full_name === 'string') {
            return location.full_name;
        }

        // Priority 2: Use path if available
        if (location?.path && typeof location.path === 'string') {
            return location.path;
        }

        // Priority 3: Build from location_tree array
        if (location?.location_tree && Array.isArray(location.location_tree)) {
            const sorted = [...location.location_tree].sort((a, b) => (a.level || 0) - (b.level || 0));
            const names = sorted.map((loc: any) => {
                if (typeof loc.name === 'object' && loc.name.en) return loc.name.en;
                if (typeof loc.name === 'string') return loc.name;
                return null;
            }).filter(Boolean);

            if (names.length > 0) {
                return names.join(' > ');
            }
        }

        // Priority 4: Use name field as fallback
        if (location?.name) {
            if (typeof location.name === 'object' && location.name.en) {
                return location.name.en;
            }
            if (typeof location.name === 'string') {
                return location.name;
            }
        }

        return null;
    }

    /**
     * Extract the specific location name (not the full path)
     */
    private extractLocationName(location: any): string | null {
        if (location?.name) {
            if (typeof location.name === 'object' && location.name.en) {
                return location.name.en;
            }
            if (typeof location.name === 'string') {
                return location.name;
            }
        }
        return null;
    }

    /**
     * Get all cached locations (for debugging/admin purposes)
     */
    async getAllCached() {
        return this.prisma.pfLocation.findMany({
            orderBy: { updatedAt: 'desc' }
        });
    }

    /**
     * Clear entire cache (for admin purposes)
     */
    async clearCache() {
        return this.prisma.pfLocation.deleteMany();
    }
}
