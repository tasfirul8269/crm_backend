import { IsNumber, IsOptional, IsString, IsBoolean, Min, Max } from 'class-validator';

export class UpdateAiSettingsDto {
    @IsOptional()
    @IsNumber()
    @Min(100)
    @Max(5000)
    minCharacters?: number;

    @IsOptional()
    @IsNumber()
    @Min(500)
    @Max(10000)
    maxCharacters?: number;

    @IsOptional()
    @IsNumber()
    @Min(10)
    @Max(100)
    minTitleCharacters?: number;

    @IsOptional()
    @IsNumber()
    @Min(30)
    @Max(200)
    maxTitleCharacters?: number;

    @IsOptional()
    @IsBoolean()
    isEnabled?: boolean;

    @IsOptional()
    @IsString()
    modelName?: string;
}

export class CreateTrainingExampleDto {
    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsString()
    description: string;
}

export class UpdateTrainingExampleDto {
    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
