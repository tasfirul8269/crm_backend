import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    title?: string;

    @IsOptional()
    @IsString()
    note?: string;

    @IsOptional()
    @IsDateString()
    date?: string;

    @IsOptional()
    @IsString()
    startTime?: string;

    @IsOptional()
    @IsString()
    endTime?: string;

    @IsOptional()
    @IsString()
    @MaxLength(50)
    category?: string;

    @IsOptional()
    @IsBoolean()
    isCompleted?: boolean;
}
