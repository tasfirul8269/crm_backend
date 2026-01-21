import { IsArray, IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLeadDto {
    // Contact Information
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(30)
    phone: string;

    // Additional Details
    @IsOptional()
    @IsString()
    @MaxLength(120)
    organizer?: string;

    @IsOptional()
    @IsString()
    @MaxLength(120)
    responsible?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    observers?: string[];

    @IsOptional()
    @IsString()
    status?: string;

    @IsOptional()
    @IsNumber()
    dealPrice?: number;

    @IsOptional()
    @IsString()
    currency?: string;

    @IsOptional()
    @IsString()
    source?: string;

    @IsOptional()
    @IsDateString()
    closingDate?: string;

    // Client's Wishes
    @IsOptional()
    @IsString()
    district?: string;

    @IsOptional()
    @IsString()
    propertyType?: string;

    @IsOptional()
    @IsString()
    developer?: string;

    @IsOptional()
    @IsString()
    bedrooms?: string;

    @IsOptional()
    @IsNumber()
    budgetFrom?: number;

    @IsOptional()
    @IsNumber()
    budgetTo?: number;

    @IsOptional()
    @IsString()
    areaFrom?: string;

    @IsOptional()
    @IsString()
    areaTo?: string;

    @IsOptional()
    @IsString()
    additionalContent?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

