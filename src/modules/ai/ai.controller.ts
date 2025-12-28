import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AiService } from './ai.service';
import { UpdateAiSettingsDto, CreateTrainingExampleDto, UpdateTrainingExampleDto } from './dto/ai-settings.dto';

interface GenerateDescriptionDto {
    propertyType?: string;
    bedrooms?: number;
    bathrooms?: number;
    area?: number;
    plotArea?: number;
    address?: string;
    community?: string;
    emirate?: string;
    furnishingType?: string;
    amenities?: string[];
    price?: number;
    purpose?: string;
    category?: string;
}

@Controller('ai')
export class AiController {
    private readonly logger = new Logger(AiController.name);

    constructor(private readonly aiService: AiService) { }

    // ==================== DESCRIPTION GENERATION ====================

    @Post('generate-description')
    async generateDescription(@Body() dto: GenerateDescriptionDto) {
        this.logger.log('Received generate-description request');

        try {
            const description = await this.aiService.generatePropertyDescription(dto);
            return { description };
        } catch (error: any) {
            this.handleError(error, 'Error in generate-description endpoint');
        }
    }

    @Post('generate-title')
    async generateTitle(@Body() dto: GenerateDescriptionDto) {
        this.logger.log('Received generate-title request');

        try {
            const title = await this.aiService.generatePropertyTitle(dto);
            return { title };
        } catch (error: any) {
            this.handleError(error, 'Error in generate-title endpoint');
        }
    }

    // ==================== SETTINGS ENDPOINTS ====================

    @Get('settings')
    async getSettings() {
        try {
            return await this.aiService.getSettings();
        } catch (error: any) {
            this.handleError(error, 'Error getting AI settings');
        }
    }

    @Put('settings')
    async updateSettings(@Body() dto: UpdateAiSettingsDto) {
        try {
            return await this.aiService.updateSettings(dto);
        } catch (error: any) {
            this.handleError(error, 'Error updating AI settings');
        }
    }

    // ==================== TRAINING EXAMPLES ENDPOINTS ====================

    @Get('training-examples')
    async getTrainingExamples(@Query('type') type?: string) {
        try {
            // Default to 'description' if not provided for backward compatibility
            // But service defaults to 'description' too, so passing undefined is fine if service handles it
            // Actually service defaults to 'description' in argument: type: string = 'description'
            return await this.aiService.getTrainingExamples(type);
        } catch (error: any) {
            this.handleError(error, 'Error getting training examples');
        }
    }

    @Post('training-examples')
    async createTrainingExample(@Body() dto: CreateTrainingExampleDto) {
        try {
            return await this.aiService.createTrainingExample(dto);
        } catch (error: any) {
            this.handleError(error, 'Error creating training example');
        }
    }

    @Put('training-examples/:id')
    async updateTrainingExample(@Param('id') id: string, @Body() dto: UpdateTrainingExampleDto) {
        try {
            return await this.aiService.updateTrainingExample(id, dto);
        } catch (error: any) {
            this.handleError(error, 'Error updating training example');
        }
    }

    @Delete('training-examples/:id')
    async deleteTrainingExample(@Param('id') id: string) {
        try {
            await this.aiService.deleteTrainingExample(id);
            return { success: true };
        } catch (error: any) {
            this.handleError(error, 'Error deleting training example');
        }
    }

    private handleError(error: any, context: string) {
        this.logger.error(`${context}:`, error.message);

        if (error instanceof HttpException) {
            throw error;
        }

        throw new HttpException(
            error.message || context,
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
}
