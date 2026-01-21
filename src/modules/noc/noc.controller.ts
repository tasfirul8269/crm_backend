import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseInterceptors,
    UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { NocService } from './noc.service';
import { CreateNocDto } from './dto/create-noc.dto';
import * as fs from 'fs';
import * as path from 'path';

@Controller('noc')
export class NocController {
    constructor(private readonly nocService: NocService) { }

    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    async create(
        @Body() body: any,
        @UploadedFiles() files: Array<Express.Multer.File>,
    ) {
        // Logging for debugging
        console.log('NOC Create Body:', JSON.stringify(body, null, 2));
        console.log('NOC Create Files:', files?.map(f => f.fieldname));

        // 1. Parsing Owners
        let owners = [];
        if (typeof body.owners === 'string') {
            try {
                owners = JSON.parse(body.owners);
            } catch (e) {
                console.error('Error parsing owners JSON:', e);
                owners = [];
            }
        } else if (Array.isArray(body.owners)) {
            owners = body.owners;
        } else {
            console.warn('Body owners is neither string nor array:', typeof body.owners);
            owners = [];
        }

        console.log('NOC Create Owners Parsed:', JSON.stringify(owners, null, 2));

        // 2. Safe Number Parsing Helpers
        const safeFloat = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? undefined : parsed;
        };
        const safeInt = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            const parsed = parseInt(val);
            return isNaN(parsed) ? undefined : parsed;
        };

        const safeString = (val: any) => {
            if (val === undefined || val === null || val === '') return undefined;
            return String(val);
        };

        // 3. Construct DTO
        const createNocDto: CreateNocDto = {
            owners: owners,

            // Property Details
            propertyType: body.propertyType,
            buildingProjectName: body.buildingProjectName,
            community: body.community,
            streetName: body.streetName,
            buildUpArea: safeFloat(body.buildUpArea),
            plotArea: safeFloat(body.plotArea),
            bedrooms: safeString(body.bedrooms),
            bathrooms: safeInt(body.bathrooms),
            rentalAmount: safeFloat(body.rentalAmount),
            saleAmount: safeFloat(body.saleAmount),
            parking: body.parking,
            propertyNumber: body.propertyNumber,

            // Terms
            agreementType: body.agreementType,
            periodMonths: safeInt(body.periodMonths),
            agreementDate: body.agreementDate,

            // Contact & Location
            clientPhone: body.clientPhone,
            location: body.location,
            latitude: safeFloat(body.latitude),
            longitude: safeFloat(body.longitude),
        };

        // 4. Call Service
        try {
            return await this.nocService.create(createNocDto, files);
        } catch (error) {
            console.error('Error creating NOC in controller:', error);
            const logPath = path.join(process.cwd(), 'noc_error.log');
            const errorMessage = error instanceof Error ? error.stack : JSON.stringify(error);
            fs.writeFileSync(logPath, `${new Date().toISOString()} - ERROR: ${errorMessage}\nDTO: ${JSON.stringify(createNocDto)}\n\n`);

            if (error instanceof Error) {
                console.error(error.stack);
            }
            throw error;
        }
    }

    @Get()
    async findAll() {
        return this.nocService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.nocService.findOne(id);
    }

    @Get(':id/download')
    async downloadPdf(@Param('id') id: string) {
        return this.nocService.downloadPdf(id);
    }
}
