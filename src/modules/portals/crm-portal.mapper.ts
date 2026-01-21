import { Injectable } from '@nestjs/common';
import { IPortalMapper, PortalListing } from '@frooxi-labs/portal-sync';

/**
 * CRM-specific Property Mapper.
 * Transforms the CRM's Property entity to the standardized PortalListing format.
 */
@Injectable()
export class CrmPortalMapper implements IPortalMapper {
    /**
     * Maps a CRM Property to PortalListing.
     * This is where all field translations happen.
     */
    mapProperty(property: any): PortalListing {
        // Determine offering type based on purpose
        const offeringType = this.mapOfferingType(property.purpose);

        return {
            referenceNumber: property.reference || property.id,
            permitNumber: property.dldPermitNumber || undefined,
            offeringType,
            propertyType: this.mapPropertyType(property.propertyType),
            price: {
                value: property.price || 0,
                currency: 'AED',
                period: this.mapRentalPeriod(property.rentalPeriod),
            },
            location: {
                city: property.emirate || 'Dubai',
                community: property.pfLocationPath?.split(' > ')[1] || property.address || 'Unknown',
                subCommunity: property.pfLocationPath?.split(' > ')[2] || undefined,
                coordinates: property.latitude && property.longitude
                    ? { lat: property.latitude, lng: property.longitude }
                    : undefined,
            },
            title: {
                en: property.propertyTitle || `${property.bedrooms || 'Studio'} BR ${property.propertyType} in ${property.address || 'Dubai'}`,
            },
            description: {
                en: property.propertyDescription || '',
            },
            specifications: {
                bedrooms: property.bedrooms,
                bathrooms: property.bathrooms || 0,
                size: property.area || 0,
                sizeUnit: 'sqft',
            },
            media: {
                images: this.buildImageArray(property),
                videos: property.videoUrl ? [property.videoUrl] : undefined,
            },
            agent: {
                id: property.assignedAgent?.pfUserId || property.assignedAgentId || '',
            },
            // PF-specific extras
            extraFields: {
                pfListingId: property.pfListingId,
                pfLocationId: property.pfLocationId,
                furnishingType: property.furnishingType,
                parkingSpaces: property.parkingSpaces,
                amenities: property.amenities,
            },
        };
    }

    /**
     * Optional: Filter which properties should sync to a portal.
     */
    shouldSync(property: any, portalName: string): boolean {
        // Only sync active properties with a price
        if (!property.isActive || property.status !== 'AVAILABLE') {
            return false;
        }
        if (!property.price || property.price <= 0) {
            return false;
        }
        // For Property Finder, also require assigned agent
        if (portalName === 'propertyfinder' && !property.assignedAgentId) {
            return false;
        }
        return true;
    }

    private mapOfferingType(purpose: string): 'S' | 'R' | 'CS' | 'CR' {
        const purposeLower = purpose?.toLowerCase() || '';
        if (purposeLower.includes('rent')) {
            if (purposeLower.includes('commercial')) return 'CR';
            return 'R';
        }
        if (purposeLower.includes('commercial')) return 'CS';
        return 'S'; // Default to Sale
    }

    private mapPropertyType(type: string | null): string {
        // Map common CRM types to PF types
        const typeMap: Record<string, string> = {
            'Apartment': 'AP',
            'Villa': 'VH',
            'Townhouse': 'TH',
            'Penthouse': 'PH',
            'Studio': 'ST',
            'Office': 'OF',
            'Warehouse': 'WH',
            'Land': 'LP',
            'Building': 'BU',
        };
        return typeMap[type || ''] || type || 'AP';
    }

    private mapRentalPeriod(period: string | null): 'yearly' | 'monthly' | 'weekly' | 'daily' {
        const periodLower = period?.toLowerCase() || '';
        if (periodLower.includes('month')) return 'monthly';
        if (periodLower.includes('week')) return 'weekly';
        if (periodLower.includes('day')) return 'daily';
        return 'yearly';
    }

    private buildImageArray(property: any): string[] {
        const images: string[] = [];
        if (property.coverPhoto) {
            images.push(property.coverPhoto);
        }
        if (property.mediaImages?.length) {
            images.push(...property.mediaImages);
        }
        return images;
    }
}
