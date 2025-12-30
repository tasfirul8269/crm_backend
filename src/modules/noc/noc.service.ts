import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { FileManagerService } from '../file-manager/file-manager.service';
import { CreateNocDto } from './dto/create-noc.dto';
import PDFDocument from 'pdfkit';
import axios from 'axios';

@Injectable()
export class NocService {
    private readonly logger = new Logger(NocService.name);

    constructor(
        private prisma: PrismaService,
        private uploadService: UploadService,
        private fileManagerService: FileManagerService,
    ) { }

    private safeDate(dateStr: string | null | undefined): Date | null {
        if (!dateStr || dateStr.trim() === '') return null;
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    async create(
        createNocDto: CreateNocDto,
        files: Array<Express.Multer.File> = [],
    ) {
        // Prepare owners data with signature uploads
        const ownersData: any[] = [];

        // Assuming createNocDto.owners is an array
        const owners = createNocDto.owners || [];

        for (let i = 0; i < owners.length; i++) {
            const ownerDto = owners[i];
            let signatureUrl: string | null = null;

            // Find matching signature file
            // Expected fieldname format from frontend: "signatures_<index>"
            const signatureFile = files.find(f => f.fieldname === `signatures_${i}`);

            if (signatureFile) {
                signatureUrl = await this.uploadService.uploadFile(signatureFile);
            }

            ownersData.push({
                name: ownerDto.name,
                emiratesId: ownerDto.emiratesId,
                issueDate: this.safeDate(ownerDto.issueDate),
                expiryDate: this.safeDate(ownerDto.expiryDate),
                countryCode: ownerDto.countryCode,
                phone: ownerDto.phone,
                signatureUrl: signatureUrl,
                signatureDate: this.safeDate(ownerDto.signatureDate),
            });
        }

        // Create the NOC record with nested owners
        const noc = await this.prisma.noc.create({
            data: {
                // Owners
                owners: {
                    create: ownersData,
                } as any,

                // Property Details
                propertyType: createNocDto.propertyType,
                buildingProjectName: createNocDto.buildingProjectName,
                community: createNocDto.community,
                streetName: createNocDto.streetName,
                buildUpArea: createNocDto.buildUpArea,
                plotArea: createNocDto.plotArea,
                bedrooms: createNocDto.bedrooms,
                bathrooms: createNocDto.bathrooms,
                rentalAmount: createNocDto.rentalAmount,
                saleAmount: createNocDto.saleAmount,
                parking: createNocDto.parking,

                // Terms
                agreementType: createNocDto.agreementType,
                periodMonths: createNocDto.periodMonths,
                agreementDate: this.safeDate(createNocDto.agreementDate),
            },
            include: {
                owners: true,
            },
        });

        // Generate PDF and upload to S3
        const pdfUrl = await this.generateAndUploadPdf(noc);

        // Update the NOC with the PDF URL
        const updatedNoc = await this.prisma.noc.update({
            where: { id: noc.id },
            data: { pdfUrl },
            include: { owners: true },
        });

        // Register in File Manager
        this.fileManagerService.createNocFolder(updatedNoc, pdfUrl || undefined).catch(e => {
            this.logger.error('Failed to register NOC in file manager', e);
        });

        return updatedNoc;
    }

    async findAll() {
        return this.prisma.noc.findMany({
            orderBy: { createdAt: 'desc' },
            include: { owners: true },
        });
    }

    async findOne(id: string) {
        const noc = await this.prisma.noc.findUnique({
            where: { id },
            include: { owners: true },
        });

        if (!noc) {
            throw new NotFoundException(`NOC with ID ${id} not found`);
        }

        return noc;
    }

    async generateAndUploadPdf(noc: any): Promise<string | null> {
        try {
            const pdfBuffer = await this.generatePdfBuffer(noc);

            // Create a fake file object for the upload service
            const pdfFile = {
                buffer: pdfBuffer,
                originalname: `noc-${noc.id}.pdf`,
                mimetype: 'application/pdf',
            } as Express.Multer.File;

            const pdfUrl = await this.uploadService.uploadFile(pdfFile);
            return pdfUrl;
        } catch (error) {
            this.logger.error('Failed to generate and upload PDF:', error);
            return null;
        }
    }

    private async generatePdfBuffer(noc: any): Promise<Buffer> {
        return new Promise(async (resolve, reject) => {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Company Header
            doc.fontSize(18).font('Helvetica-Bold').text('Mateluxy Real Estate Broker L.L.C', { align: 'left' });
            doc.fontSize(10).font('Helvetica');
            doc.text('Tel: +971 4 572 5420');
            doc.text('Add: 601 Bay Square 13, Business Bay, Dubai, UAE.');
            doc.text('P.O. Box: 453467');
            doc.text('Email: info@mateluxy.com');
            doc.text('Website: www.mateluxy.com');
            doc.moveDown(2);

            // Title
            doc.fontSize(14).font('Helvetica-Bold')
                .text('NOC / LISTING AGREEMENT/ AGREEMENT BETWEEN OWNER & BROKER', { align: 'center' });
            doc.moveDown(2);

            // Owner Details Section
            doc.fontSize(12).font('Helvetica-Bold').text('LANDLORD / OWNER DETAILS');
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10);

            // Loop through owners
            if (noc.owners && noc.owners.length > 0) {
                noc.owners.forEach((owner, index) => {
                    doc.text(`Owner ${index + 1}: ${owner.name || 'N/A'}`);
                    doc.text(`Emirates ID/Passport: ${owner.emiratesId || 'N/A'}`);

                    if (owner.issueDate) doc.text(`Issue Date: ${new Date(owner.issueDate).toLocaleDateString()}`);
                    if (owner.expiryDate) doc.text(`Expiry Date: ${new Date(owner.expiryDate).toLocaleDateString()}`);

                    const countryCode = owner.countryCode || '+971';
                    const phone = owner.phone || '';
                    if (phone) doc.text(`Phone: ${countryCode} ${phone}`);

                    doc.moveDown(0.5);
                });
            } else {
                doc.text('No owner details provided.');
            }

            doc.moveDown(1);

            // Property Details Section
            doc.fontSize(12).font('Helvetica-Bold').text('PROPERTY DETAILS');
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10);

            if (noc.propertyType) doc.text(`Property Type: ${noc.propertyType}`);
            if (noc.buildingProjectName) doc.text(`Building/Project Name: ${noc.buildingProjectName}`);
            if (noc.community) doc.text(`Community: ${noc.community}`);
            if (noc.streetName) doc.text(`Street Name: ${noc.streetName}`);
            if (noc.buildUpArea) doc.text(`Build Up Area: ${noc.buildUpArea} sq.ft`);
            if (noc.plotArea) doc.text(`Plot Area: ${noc.plotArea} sq.ft`);
            if (noc.bedrooms) doc.text(`Bedrooms: ${noc.bedrooms}`);
            if (noc.bathrooms) doc.text(`Bathrooms: ${noc.bathrooms}`);
            if (noc.rentalAmount) doc.text(`Rental Amount: AED ${noc.rentalAmount ? noc.rentalAmount.toLocaleString() : 'N/A'}`);
            if (noc.saleAmount) doc.text(`Sale Amount: AED ${noc.saleAmount ? noc.saleAmount.toLocaleString() : 'N/A'}`);
            if (noc.parking) doc.text(`Parking: ${noc.parking}`);

            doc.moveDown(2);

            // Terms and Conditions Section
            doc.fontSize(12).font('Helvetica-Bold').text('TERMS AND CONDITIONS');
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(10);

            doc.text(`Agreement Type: ${noc.agreementType === 'exclusive' ? 'Exclusive' : 'Non-Exclusive'}`);
            doc.text(`Period: ${noc.periodMonths || 'N/A'} Month(s)`);
            if (noc.agreementDate) {
                doc.text(`Agreement Date: ${new Date(noc.agreementDate).toLocaleDateString()}`);
            }

            doc.moveDown(1);

            // Terms Text
            doc.text('The landlord/legal representative has agreed to appoint Broker to list and advertise the above property for a period till the agreement date.', { align: 'justify' });
            doc.moveDown(0.5);
            doc.text('I, the undersigned confirm that I am the owner of the above property and / or have the legal authority to sign on behalf of the named owner(s).', { align: 'justify' });
            doc.moveDown(0.5);
            doc.text('Should this property be subject to an offer I/we will notify the brokerage of this. This Agreement may be terminated by either party at any time upon seven (7) days written notice to the other party.', { align: 'justify' });

            doc.moveDown(2);

            // Signatures Section
            doc.fontSize(12).font('Helvetica-Bold').text('SIGNATURES');
            doc.moveDown(1);
            doc.font('Helvetica').fontSize(10);

            if (noc.owners && noc.owners.length > 0) {
                for (let i = 0; i < noc.owners.length; i++) {
                    const owner = noc.owners[i];
                    doc.text(`${i + 1}${getOrdinal(i + 1)} Owner Signature: ${owner.name || ''}`);

                    // Add Signature Date
                    if (owner.signatureDate) {
                        doc.text(`Date: ${new Date(owner.signatureDate).toLocaleDateString()}`);
                    } else {
                        doc.text('Date: ___/___/______');
                    }

                    // Add Signature Image if available
                    if (owner.signatureUrl) {
                        try {
                            const response = await axios.get(owner.signatureUrl, { responseType: 'arraybuffer' });
                            const imageBuffer = Buffer.from(response.data);
                            doc.moveDown(0.5);
                            doc.image(imageBuffer, { fit: [150, 60] });
                            doc.moveDown(2);
                        } catch (imgError) {
                            console.error(`Failed to fetch signature image for owner ${i + 1}:`, imgError);
                            doc.text('[Signature Image Error]');
                            doc.moveDown(2);
                        }
                    } else {
                        doc.text('___________________________');
                        doc.moveDown(2);
                    }
                }
            } else {
                doc.text('No owners found.');
            }

            // Footer
            doc.moveDown(2);
            doc.fontSize(8).font('Helvetica').fillColor('gray')
                .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
            doc.text(`NOC ID: ${noc.id}`, { align: 'center' });

            doc.end();
        });
    }
    async downloadPdf(id: string) {
        const noc = await this.findOne(id);

        if (!noc.pdfUrl) {
            // Regenerate PDF if not available
            const pdfUrl = await this.generateAndUploadPdf(noc);
            if (pdfUrl) {
                await this.prisma.noc.update({
                    where: { id },
                    data: { pdfUrl },
                    include: { owners: true },
                });
                return { url: pdfUrl };
            }
            throw new NotFoundException('PDF not available');
        }

        return { url: noc.pdfUrl };
    }
}

function getOrdinal(n: number) {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
}
