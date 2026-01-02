import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { CreateTenancyContractDto } from './dto/create-tenancy-contract.dto';
import { FileManagerService } from '../file-manager/file-manager.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class TenancyContractService {
    private readonly logger = new Logger(TenancyContractService.name);

    constructor(
        private prisma: PrismaService,
        private uploadService: UploadService,
        private fileManagerService: FileManagerService,
    ) { }

    async create(createDto: CreateTenancyContractDto) {
        // Create DB Record
        const contract = await this.prisma.tenancyContract.create({
            data: {
                propertyId: createDto.propertyId,
                ownerName: createDto.ownerName,
                ownerPhone: createDto.ownerPhone,
                ownerEmail: createDto.ownerEmail,
                tenantName: createDto.tenantName,
                tenantPhone: createDto.tenantPhone,
                tenantEmail: createDto.tenantEmail,
                propertyUsage: createDto.propertyUsage,
                buildingName: createDto.buildingName,
                location: createDto.location,
                propertySize: createDto.propertySize,
                propertyType: createDto.propertyType,
                propertyNumber: createDto.propertyNumber,
                plotNumber: createDto.plotNumber,
                premisesNumber: createDto.premisesNumber,
                contractStartDate: createDto.contractStartDate ? new Date(createDto.contractStartDate) : null,
                contractEndDate: createDto.contractEndDate ? new Date(createDto.contractEndDate) : null,
                annualRent: createDto.annualRent,
                contractValue: createDto.contractValue,
                securityDeposit: createDto.securityDeposit,
                modeOfPayment: createDto.modeOfPayment,
                additionalTerms: createDto.additionalTerms || [],
            },
        });

        // Generate PDF
        const pdfUrl = await this.generateAndUploadPdf(contract);

        // Update with PDF URL
        const updatedContract = await this.prisma.tenancyContract.update({
            where: { id: contract.id },
            data: { pdfUrl },
        });

        // Create Folder Structure in File Manager
        if (pdfUrl) {
            try {
                await this.fileManagerService.createTenancyContractStructure(updatedContract, pdfUrl);
            } catch (error) {
                this.logger.error(`Failed to create file manager structure for contract ${contract.id}`, error);
            }
        }

        return updatedContract;
    }

    async generateAndUploadPdf(contract: any): Promise<string | null> {
        try {
            const pdfBuffer = await this.generatePdfBuffer(contract);
            const pdfFile = {
                buffer: pdfBuffer,
                originalname: `tenancy-contract-${contract.id}.pdf`,
                mimetype: 'application/pdf',
            } as Express.Multer.File;

            return await this.uploadService.uploadFile(pdfFile);
        } catch (error) {
            this.logger.error('Failed to generate PDF', error);
            return null;
        }
    }

    private async generatePdfBuffer(contract: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks: Buffer[] = [];

            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Header
            doc.fontSize(18).font('Helvetica-Bold').text('TENANCY CONTRACT', { align: 'center' });
            doc.moveDown();

            // Property Details
            doc.fontSize(12).font('Helvetica-Bold').text('Property Details');
            doc.font('Helvetica').fontSize(10);
            doc.text(`Building: ${contract.buildingName || 'N/A'}`);
            doc.text(`Location: ${contract.location || 'N/A'}`);
            doc.text(`Type: ${contract.propertyType || 'N/A'}`);
            doc.text(`Size: ${contract.propertySize ? contract.propertySize + ' sq ft' : 'N/A'}`);
            doc.text(`Property No: ${contract.propertyNumber || 'N/A'}`);
            doc.moveDown();

            // Tenant & Owner
            doc.fontSize(12).font('Helvetica-Bold').text('Parties');
            doc.font('Helvetica').fontSize(10);
            doc.text(`Landlord: ${contract.ownerName || 'N/A'} (${contract.ownerPhone || ''})`);
            doc.text(`Tenant: ${contract.tenantName || 'N/A'} (${contract.tenantPhone || 'N/A'})`);
            doc.moveDown();

            // Contract Details
            doc.fontSize(12).font('Helvetica-Bold').text('Contract Terms');
            doc.font('Helvetica').fontSize(10);
            const start = contract.contractStartDate ? new Date(contract.contractStartDate).toLocaleDateString() : 'N/A';
            const end = contract.contractEndDate ? new Date(contract.contractEndDate).toLocaleDateString() : 'N/A';
            doc.text(`Period: ${start} to ${end}`);
            doc.text(`Annual Rent: AED ${contract.annualRent}`);
            doc.text(`Security Deposit: AED ${contract.securityDeposit}`);
            doc.text(`Mode of Payment: ${contract.modeOfPayment || 'N/A'}`);
            doc.moveDown();

            // Additional Terms
            if (contract.additionalTerms && Array.isArray(contract.additionalTerms) && contract.additionalTerms.length > 0) {
                doc.fontSize(12).font('Helvetica-Bold').text('Additional Terms');
                doc.font('Helvetica').fontSize(10);
                contract.additionalTerms.forEach((term: string, index: number) => {
                    doc.text(`${index + 1}. ${term}`);
                });
            }

            doc.end();
        });
    }
}
