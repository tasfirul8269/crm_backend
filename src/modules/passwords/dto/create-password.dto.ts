
import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreatePasswordDto {
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    username: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsArray()
    @IsOptional()
    accessIds: string[];

    @IsString()
    @IsOptional()
    note?: string;

    @IsString()
    @IsOptional()
    logoUrl?: string;
}
