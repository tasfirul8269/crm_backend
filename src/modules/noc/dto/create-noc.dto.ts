import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNocOwnerDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    emiratesId?: string;

    @IsOptional()
    @IsString()
    issueDate?: string;

    @IsOptional()
    @IsString()
    expiryDate?: string;

    @IsOptional()
    @IsString()
    countryCode?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    signatureDate?: string;
}

export class CreateNocDto {
    // Owners - Dynamic Array
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateNocOwnerDto)
    owners: CreateNocOwnerDto[];

    // Property Details
    @IsOptional()
    @IsString()
    propertyType?: string;

    @IsOptional()
    @IsString()
    buildingProjectName?: string;

    @IsOptional()
    @IsString()
    community?: string;

    @IsOptional()
    @IsString()
    streetName?: string;

    @IsOptional()
    @IsNumber()
    buildUpArea?: number;

    @IsOptional()
    @IsNumber()
    plotArea?: number;

    @IsOptional()
    @IsString()
    bedrooms?: string;

    @IsOptional()
    @IsNumber()
    bathrooms?: number;

    @IsOptional()
    @IsNumber()
    rentalAmount?: number;

    @IsOptional()
    @IsNumber()
    saleAmount?: number;

    @IsOptional()
    @IsString()
    parking?: string;

    @IsOptional()
    @IsString()
    propertyNumber?: string;

    // Terms
    @IsOptional()
    @IsString()
    agreementType?: string;

    @IsOptional()
    @IsNumber()
    periodMonths?: number;

    @IsOptional()
    @IsString()
    agreementDate?: string;

    // Contact & Location
    @IsOptional()
    @IsString()
    clientPhone?: string;

    @IsOptional()
    @IsString()
    location?: string;

    @IsOptional()
    @IsNumber()
    latitude?: number;

    @IsOptional()
    @IsNumber()
    longitude?: number;
}
