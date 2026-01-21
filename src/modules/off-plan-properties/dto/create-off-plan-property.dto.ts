import { IsString, IsNumber, IsOptional, Min, IsArray, IsObject, IsBoolean } from 'class-validator';

export class CreateOffPlanPropertyDto {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    developerId?: string;

    // Specific Details
    @IsOptional()
    @IsString()
    emirate?: string;

    @IsOptional()
    @IsString()
    launchType?: string;

    @IsOptional()
    @IsString()
    projectHighlight?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    propertyType?: string[];

    @IsOptional()
    @IsNumber()
    @Min(0)
    plotArea?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    area?: number;

    @IsOptional()
    @IsString()
    bedrooms?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    kitchens?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    bathrooms?: number;

    // Locations
    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @IsString()
    style?: string;

    @IsOptional()
    @IsString()
    focalPoint?: string;

    @IsOptional()
    @IsString()
    focalPointImage?: string;

    @IsOptional()
    @IsArray()
    nearbyHighlights?: Array<{
        title: string;
        subtitle: string;
        highlights: Array<{
            name: string;
            image?: string;
        }>;
    }>;

    // Price Tab
    @IsOptional()
    @IsNumber()
    @Min(0)
    startingPrice?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    serviceCharges?: number;

    @IsOptional()
    @IsString()
    brokerFee?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    roiPotential?: number;

    @IsOptional()
    @IsObject()
    paymentPlan?: {
        title: string;
        subtitle: string;
        milestones: Array<{
            label: string;
            percentage: string;
            subtitle: string;
        }>;
    };

    // DLD & Status
    @IsOptional()
    @IsString()
    dldPermitNumber?: string;

    @IsOptional()
    @IsString()
    dldQrCode?: string;

    @IsOptional()
    @IsString()
    projectStage?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    constructionProgress?: number;

    @IsOptional()
    @IsString() // Date string from frontend
    handoverDate?: string;

    // General Details
    @IsOptional()
    @IsString()
    projectTitle?: string;

    @IsOptional()
    @IsString()
    shortDescription?: string;

    @IsOptional()
    @IsString()
    projectDescription?: string;

    // Media
    @IsOptional()
    @IsString()
    coverPhoto?: string;

    @IsOptional()
    @IsString()
    videoUrl?: string;

    @IsOptional()
    @IsString()
    agentVideoUrl?: string;

    @IsOptional()
    @IsString()
    virtualTourUrl?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    exteriorMedia?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    interiorMedia?: string[];

    // Additional
    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @IsString()
    brochure?: string;

    @IsOptional()
    @IsString()
    amenitiesCover?: string;

    @IsOptional()
    @IsString()
    amenitiesTitle?: string;

    @IsOptional()
    @IsString()
    amenitiesSubtitle?: string;

    @IsOptional()
    @IsArray()
    amenities?: Array<{
        name: string;
        icon: string;
    }>;

    @IsOptional()
    @IsArray()
    floorPlans?: Array<{
        propertyType: string;
        livingArea: string;
        price: string;
        floorPlanImage?: string;
    }>;

    // Agent Tab
    @IsOptional()
    @IsObject()
    areaExperts?: Record<string, string[]>;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    projectExperts?: string[];
}

