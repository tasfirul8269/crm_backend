import { IsString, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateWatermarkDto {
    @IsString()
    name: string;
}

export class UpdateWatermarkDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    position?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    opacity?: number;

    @IsOptional()
    @IsNumber()
    @Min(0.05)
    @Max(0.5)
    scale?: number;
}
