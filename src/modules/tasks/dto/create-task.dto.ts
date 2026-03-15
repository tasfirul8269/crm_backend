import { IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTaskDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(200)
    title: string;

    @IsOptional()
    @IsString()
    note?: string;

    @IsDateString()
    @IsNotEmpty()
    date: string;

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
}
