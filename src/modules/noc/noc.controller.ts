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

@Controller('noc')
export class NocController {
    constructor(private readonly nocService: NocService) { }

    @Post()
    @UseInterceptors(AnyFilesInterceptor())
    async create(
        @Body() body: any,
        @UploadedFiles() files: Array<Express.Multer.File>,
    ) {
        // Parse the body - formData "owners" will likely be a JSON string if sent as a complex array
        // OR it might be individual fields if we iterate.
        // Let's assume the frontend sends 'owners' as a JSON string for simplicity, 
        // OR we map generic fields. 
        // Given React Hook Form / standard implementations, JSON string for complex nested arrays is safest with FormData.

        let owners = [];
        if (typeof body.owners === 'string') {
            try {
                owners = JSON.parse(body.owners);
            } catch (e) {
                // Handle parse error or fallback
                owners = [];
            }
        } else {
            owners = body.owners || [];
        }

        const createNocDto: CreateNocDto = {
            owners: owners,

            // Property Details
            propertyType: body.propertyType,
            buildingProjectName: body.buildingProjectName,
            community: body.community,
            streetName: body.streetName,
            buildUpArea: body.buildUpArea ? parseFloat(body.buildUpArea) : undefined,
            plotArea: body.plotArea ? parseFloat(body.plotArea) : undefined,
            bedrooms: body.bedrooms ? parseInt(body.bedrooms) : undefined,
            bathrooms: body.bathrooms ? parseInt(body.bathrooms) : undefined,
            rentalAmount: body.rentalAmount ? parseFloat(body.rentalAmount) : undefined,
            saleAmount: body.saleAmount ? parseFloat(body.saleAmount) : undefined,
            parking: body.parking,

            // Terms
            agreementType: body.agreementType,
            periodMonths: body.periodMonths ? parseInt(body.periodMonths) : undefined,
            agreementDate: body.agreementDate,
        };

        return this.nocService.create(createNocDto, files);
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
