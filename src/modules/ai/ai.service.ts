import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { UpdateAiSettingsDto, CreateTrainingExampleDto, UpdateTrainingExampleDto } from './dto/ai-settings.dto';

interface PropertyDetails {
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

@Injectable()
export class AiService {
    private readonly logger = new Logger(AiService.name);
    private genAI: GoogleGenerativeAI | null = null;
    private apiKey: string | undefined;

    constructor(
        private configService: ConfigService,
        private prisma: PrismaService,
        private integrationsService: IntegrationsService,
    ) {
        // Initial setup with env variable (will be overridden by integration config if available)
        this.apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.logger.log('Gemini AI initialized with environment variable');
        } else {
            this.logger.warn('GEMINI_API_KEY not in env. Will check integration config on first use.');
        }
    }

    /**
     * Ensures the Gemini API is initialized, fetching from integration config if needed
     */
    private async ensureApiInitialized(): Promise<boolean> {
        // If already initialized, return true
        if (this.genAI && this.apiKey) {
            return true;
        }

        // Try to get from integration config
        try {
            const credentials = await this.integrationsService.getCredentials('gemini');
            if (credentials?.apiKey && typeof credentials.apiKey === 'string') {
                this.apiKey = credentials.apiKey;
                this.genAI = new GoogleGenerativeAI(credentials.apiKey);
                this.logger.log('Gemini AI initialized from integration config');
                return true;
            }
        } catch (error) {
            this.logger.warn('Failed to get Gemini credentials from integration config');
        }

        // Fall back to env variable again (in case it was set later)
        const envKey = this.configService.get<string>('GEMINI_API_KEY');
        if (envKey) {
            this.apiKey = envKey;
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            return true;
        }

        return false;
    }

    /**
     * Refresh API key from integration config (call when integration is updated)
     */
    async refreshApiKey(): Promise<void> {
        this.genAI = null;
        this.apiKey = undefined;
        await this.ensureApiInitialized();
    }

    // ==================== SETTINGS METHODS ====================

    async getSettings() {
        let settings = await this.prisma.aiSettings.findFirst();

        // Create default settings if none exist
        if (!settings) {
            settings = await this.prisma.aiSettings.create({
                data: {
                    minCharacters: 750,
                    maxCharacters: 2000,
                    minTitleCharacters: 30,
                    maxTitleCharacters: 100,
                    isEnabled: true,
                    modelName: 'gemini-2.5-flash',
                },
            });
        }

        return settings;
    }

    async updateSettings(dto: UpdateAiSettingsDto) {
        const current = await this.getSettings();

        return this.prisma.aiSettings.update({
            where: { id: current.id },
            data: {
                ...(dto.minCharacters !== undefined && { minCharacters: dto.minCharacters }),
                ...(dto.maxCharacters !== undefined && { maxCharacters: dto.maxCharacters }),
                ...(dto.minTitleCharacters !== undefined && { minTitleCharacters: dto.minTitleCharacters }),
                ...(dto.maxTitleCharacters !== undefined && { maxTitleCharacters: dto.maxTitleCharacters }),
                ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
                ...(dto.modelName !== undefined && { modelName: dto.modelName }),
            },
        });
    }

    // ==================== TRAINING EXAMPLES METHODS ====================

    async getTrainingExamples(type: string = 'description') {
        return this.prisma.aiTrainingExample.findMany({
            where: { type },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getActiveTrainingExamples(type: string = 'description') {
        return this.prisma.aiTrainingExample.findMany({
            where: { isActive: true, type },
            orderBy: { createdAt: 'desc' },
            take: 10, // Limit to 10 examples to avoid token overflow
        });
    }

    async createTrainingExample(dto: CreateTrainingExampleDto) {
        return this.prisma.aiTrainingExample.create({
            data: {
                type: dto.type || 'description',
                title: dto.title,
                description: dto.description,
                isActive: true,
            },
        });
    }

    async updateTrainingExample(id: string, dto: UpdateTrainingExampleDto) {
        return this.prisma.aiTrainingExample.update({
            where: { id },
            data: dto,
        });
    }

    async deleteTrainingExample(id: string) {
        return this.prisma.aiTrainingExample.delete({
            where: { id },
        });
    }

    // ==================== DESCRIPTION GENERATION ====================

    async generatePropertyDescription(propertyDetails: PropertyDetails): Promise<string> {
        // Ensure API is initialized (from integration config or env)
        const isInitialized = await this.ensureApiInitialized();
        if (!isInitialized || !this.genAI) {
            this.logger.error('AI service not configured - no API key');
            throw new HttpException(
                'AI service is not configured. Please connect Gemini AI in Integrations or add GEMINI_API_KEY to environment.',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        // Get settings and training examples
        const settings = await this.getSettings();
        const trainingExamples = await this.getActiveTrainingExamples('description');

        if (!settings.isEnabled) {
            throw new HttpException(
                'AI generation is currently disabled.',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        const prompt = this.buildPrompt(propertyDetails, trainingExamples, settings);
        this.logger.log('Generating property description with prompt length: ' + prompt.length);

        try {
            // Use model from settings
            const model = this.genAI.getGenerativeModel({ model: settings.modelName });

            this.logger.log('Calling Gemini API...');
            const result = await model.generateContent(prompt);
            const response = result.response;
            let description = response.text();

            this.logger.log('Received response, length: ' + description.length);

            // Clean up the description
            description = description.trim();

            // Ensure it meets the character requirements from settings
            if (description.length < settings.minCharacters) {
                this.logger.log('Description too short, expanding...');
                const extendPrompt = `The following property description is too short. Please expand it to be between ${settings.minCharacters}-${settings.maxCharacters} characters while maintaining the same professional real estate tone:\n\n${description}`;
                const extendResult = await model.generateContent(extendPrompt);
                description = extendResult.response.text().trim();
            } else if (description.length > settings.maxCharacters) {
                this.logger.log('Description too long, trimming...');
                description = description.substring(0, settings.maxCharacters - 3) + '...';
            }

            // Append standard Company Section
            const companySection = `\n\nOUR COMPANY:\n\nMateluxy – your friendly gateway to exceptional real estate experiences in Dubai! \nAs one of the top property agencies in the city, we’re on a mission to bring you high-quality homes for sale and lease, tailored to your unique preferences. But we’re more than just a property agency – Mateluxy is your partner in comprehensive property management services. Whether you’re searching for your dream home or aiming for a smart investment, we’ve got you covered!\n\nMATELUXY REAL ESTATE BROKER L.L.C\n601 Bay Square 13,`;

            description += companySection;

            this.logger.log('Final description length: ' + description.length);
            return description;
        } catch (error: any) {
            this.handleAiError(error);
            return ''; // Unreachable but required by types
        }
    }

    // ==================== TITLE GENERATION ====================

    async generatePropertyTitle(propertyDetails: PropertyDetails): Promise<string> {
        // Ensure API is initialized (from integration config or env)
        const isInitialized = await this.ensureApiInitialized();
        if (!isInitialized || !this.genAI) {
            this.logger.error('AI service not configured - no API key');
            throw new HttpException(
                'AI service is not configured. Please connect Gemini AI in Integrations or add GEMINI_API_KEY to environment.',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        // Get settings and training examples
        const settings = await this.getSettings();
        const trainingExamples = await this.getActiveTrainingExamples('title');

        if (!settings.isEnabled) {
            throw new HttpException(
                'AI generation is currently disabled.',
                HttpStatus.SERVICE_UNAVAILABLE
            );
        }

        const prompt = this.buildTitlePrompt(propertyDetails, trainingExamples, settings);
        this.logger.log('Generating property title with prompt length: ' + prompt.length);

        try {
            const model = this.genAI.getGenerativeModel({ model: settings.modelName });
            const result = await model.generateContent(prompt);
            let title = result.response.text().trim();

            // Remove any surrounding quotes
            title = title.replace(/^["']|["']$/g, '');

            // Truncate if too long (titles shouldn't be expanded if too short usually, but we can check limits)
            if (title.length > settings.maxTitleCharacters) {
                title = title.substring(0, settings.maxTitleCharacters - 3) + '...';
            }

            return title;
        } catch (error: any) {
            this.handleAiError(error);
            return '';
        }
    }

    private handleAiError(error: any) {
        this.logger.error('Error in AI generation:', error.message);
        this.logger.error('Full error:', JSON.stringify(error, null, 2));

        if (error.message?.includes('API_KEY_INVALID')) {
            throw new HttpException(
                'Invalid Gemini API key. Please check your GEMINI_API_KEY.',
                HttpStatus.UNAUTHORIZED
            );
        }

        if (error.message?.includes('quota')) {
            throw new HttpException(
                'API quota exceeded. Please try again later.',
                HttpStatus.TOO_MANY_REQUESTS
            );
        }

        throw new HttpException(
            'Failed to generate content: ' + (error.message || 'Unknown error'),
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }

    private buildPrompt(
        details: PropertyDetails,
        trainingExamples: any[],
        settings: any
    ): string {
        const propertyInfo = this.formatPropertyDetails(details);

        // Build training examples section
        let examplesSection = '';
        if (trainingExamples.length > 0) {
            examplesSection = `\n\nHere are example descriptions that demonstrate the desired writing style. Learn from these examples and write in a similar tone and style:\n\n`;
            trainingExamples.forEach((example, index) => {
                examplesSection += `--- EXAMPLE ${index + 1} ---\n${example.description}\n\n`;
            });
            examplesSection += `--- END OF EXAMPLES ---\n`;
        }

        return `You are a professional real estate copywriter specializing in Dubai and UAE properties.
${examplesSection}
Write a compelling, SEO-optimized property description for a real estate listing with the following details:

${propertyInfo}

Requirements:
1. **Structure**: Organize the description into the following sections with plain text headers (followed by a colon):
   - Overview: A compelling introductory paragraph about the property, its location, and lifestyle.
   - Property Features: A list of key features.
   - Amenities: A list of amenities.

2. **Conditional Logic**:
   - If the "Amenities" list is empty or not provided, **completely skip** the "Amenities" section.
   - Only list features and amenities that are explicitly provided in the details. Do NOT invent or assume features.

3. **Data Privacy**: 
   - Strict rule: Do NOT include any client details (name, phone, nationality), owner information, or internal notes.

4. **Formatting Rules (CRITICAL)**:
   - **NO Bolding**: Do NOT use markdown bolding (e.g., **text** or __text__). Use plain text only.
   - **NO Special Characters**: Do NOT use characters like *, #, %, $, @, or emojis.
   - **Bullets**: Use ONLY the hyphen character "-" for bullet points. Do not use asterisks or dots.
   - **Headers**: Write headers in plain text with a colon (e.g. "Overview:", "Property Features:"). Do not use H1/H2 markdown (#).

5. **Length**: The total length must be between ${settings.minCharacters} and ${settings.maxCharacters} characters.

6. **Exclusions**: 
   - Do NOT include an "About Us", "Our Company", or generic company footer (this is added automatically).

${trainingExamples.length > 0 ? '7. Match the writing style from the examples provided above.' : ''}

Write the description now:`;
    }

    private buildTitlePrompt(
        details: PropertyDetails,
        trainingExamples: any[],
        settings: any
    ): string {
        const propertyInfo = this.formatPropertyDetails(details);

        // Training examples
        let examplesSection = '';
        if (trainingExamples.length > 0) {
            examplesSection = `\n\nHere are example titles that demonstrate the desired style:\n`;
            trainingExamples.forEach((example) => {
                examplesSection += `- ${example.description}\n`;
            });
        }

        return `You are a professional real estate copywriter. Write a SINGLE, catchy, high-converting title for this property listing:

${propertyInfo}
${examplesSection}

Requirements:
1. Length: Between ${settings.minTitleCharacters} and ${settings.maxTitleCharacters} characters.
2. Be concise but descriptive. Include key selling points (e.g., View, Location, Type).
3. Do NOT use emojis unless they are common in Dubai real estate (e.g., 🌟).
4. Do NOT use all caps.
5. Do NOT include quotation marks.
6. Return ONLY the title text.

Title:`;
    }

    private formatPropertyDetails(details: PropertyDetails): string {
        const parts: string[] = [];

        // Property type
        if (details.propertyType) {
            parts.push(`Property Type: ${details.propertyType}`);
        }

        // Size and rooms
        if (details.bedrooms) {
            parts.push(`Bedrooms: ${details.bedrooms}`);
        }
        if (details.bathrooms) {
            parts.push(`Bathrooms: ${details.bathrooms}`);
        }
        if (details.area) {
            parts.push(`Area: ${details.area} sq.ft`);
        }
        if (details.plotArea) {
            parts.push(`Plot Area: ${details.plotArea} sq.ft`);
        }

        // Location
        if (details.address) {
            parts.push(`Location: ${details.address}`);
        }
        if (details.community) {
            parts.push(`Community: ${details.community}`);
        }
        if (details.emirate) {
            parts.push(`Emirate: ${details.emirate}`);
        }

        // Features
        if (details.furnishingType) {
            parts.push(`Furnishing: ${details.furnishingType}`);
        }
        if (details.amenities && details.amenities.length > 0) {
            parts.push(`Amenities: ${details.amenities.join(', ')}`);
        }

        // Price and purpose
        if (details.price) {
            const priceFormatted = details.price.toLocaleString();
            if (details.purpose === 'rent') {
                parts.push(`Rental Price: AED ${priceFormatted}`);
            } else {
                parts.push(`Sale Price: AED ${priceFormatted}`);
            }
        }
        if (details.purpose) {
            parts.push(`Listing Type: For ${details.purpose === 'rent' ? 'Rent' : 'Sale'}`);
        }
        if (details.category) {
            parts.push(`Category: ${details.category}`);
        }

        return parts.length > 0 ? parts.join('\n') : 'A luxury property in Dubai';
    }
}
