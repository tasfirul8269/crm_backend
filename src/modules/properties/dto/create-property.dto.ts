import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreatePropertyDto {
    @IsOptional()
    @IsString()
    category: string;

    @IsOptional()
    @IsString()
    purpose: string;

    // Client Details
    @IsOptional()
    @IsString()
    clientName: string;

    @IsOptional()
    @IsString()
    nationality?: string;

    @IsOptional()
    @IsString()
    phoneCountry?: string;

    @IsOptional()
    @IsString()
    phoneNumber: string;

    // Specific Details
    @IsOptional()
    @IsString()
    emirate?: string;

    @IsOptional()
    @IsString()
    propertyType?: string;

    @IsOptional()
    @Transform(({ value }) => { const v = parseFloat(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    plotArea?: number;

    @IsOptional()
    @Transform(({ value }) => { const v = parseFloat(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    area?: number;

    @IsOptional()
    @IsString()
    bedrooms?: string;

    @IsOptional()
    @Transform(({ value }) => { const v = parseInt(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    kitchens?: number;

    @IsOptional()
    @Transform(({ value }) => { const v = parseInt(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    bathrooms?: number;

    @IsOptional()
    @IsString()
    unitNumber?: string;

    @IsOptional()
    @IsString()
    ownershipStatus?: string;

    @IsOptional()
    @IsString()
    projectStatus?: string;

    @IsOptional()
    @IsString()
    completionDate?: string;

    @IsOptional()
    @IsString()
    parkingSpaces?: string;

    // Locations
    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @Transform(({ value }) => { const v = parseFloat(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @Transform(({ value }) => { const v = parseFloat(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    longitude?: number;

    @IsOptional()
    @IsString()
    furnishingType?: string;

    // Price
    @IsOptional()
    @Transform(({ value }) => { const v = parseFloat(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsString()
    rentalPeriod?: string;

    @IsOptional()
    @IsString()
    brokerFee?: string;

    @IsOptional()
    @IsString()
    numberOfCheques?: string;

    // DLD
    @IsOptional()
    @IsString()
    dldPermitNumber?: string;

    @IsOptional()
    @IsString()
    dldQrCode?: string;

    // General Details
    @IsOptional()
    @IsString()
    propertyTitle?: string;

    @IsOptional()
    @IsString()
    propertyDescription?: string;

    // Media
    @IsOptional()
    @IsString()
    videoUrl?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    mediaImages?: string[];

    // Additional
    @IsOptional()
    @IsString()
    reference?: string;

    @IsOptional()
    @Transform(({ value }) => value === '' || value === 'undefined' || value === 'null' ? undefined : value)
    @IsDateString()
    availableFrom?: string;

    @IsOptional()
    @Transform(({ value }) => {
        if (value === '[]' || value === '' || value === undefined) return [];
        if (typeof value === 'string') return [value];
        return value;
    })
    @IsArray()
    @IsString({ each: true })
    amenities?: string[];

    // Agent
    @IsOptional()
    @IsString()
    assignedAgentId?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isActive?: boolean;

    @IsOptional()
    @Transform(({ value }) => { const v = parseInt(value); return isNaN(v) ? undefined : v; })
    @IsNumber()
    pfLocationId?: number;

    @IsOptional()
    @IsString()
    pfLocationPath?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    pfPublished?: boolean;
}
