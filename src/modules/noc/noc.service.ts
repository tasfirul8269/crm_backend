import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
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
        this.logger.log('Creating NOC with data:', JSON.stringify(createNocDto, null, 2));
        this.logger.log('Location field:', createNocDto.location);

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
                community: Array.isArray(createNocDto.community)
                    ? createNocDto.community.filter(Boolean).join(', ')
                    : createNocDto.community,
                streetName: createNocDto.streetName,
                buildUpArea: createNocDto.buildUpArea,
                plotArea: createNocDto.plotArea,
                bedrooms: createNocDto.bedrooms,
                bathrooms: createNocDto.bathrooms,
                rentalAmount: createNocDto.rentalAmount,
                saleAmount: createNocDto.saleAmount,
                parking: createNocDto.parking,
                propertyNumber: createNocDto.propertyNumber,

                // Terms
                agreementType: createNocDto.agreementType,
                periodMonths: createNocDto.periodMonths,
                agreementDate: this.safeDate(createNocDto.agreementDate),

                // Contact & Location
                clientPhone: createNocDto.clientPhone,
                location: createNocDto.location,
                latitude: createNocDto.latitude,
                longitude: createNocDto.longitude,
            },
            include: {
                owners: true,
            },
        }).catch(error => {
            if (error.code === 'P2002' && error.meta?.target?.includes('clientPhone')) {
                throw new ConflictException('An NOC with this phone number already exists.');
            }
            throw error;
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
        this.fileManagerService.createNocFolder(updatedNoc, pdfUrl || '').catch(e => {
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
        this.logger.log(`FULL NOC DATA: ${JSON.stringify(noc, null, 2)}`); // Debug: Print full object
        this.logger.log(`Generating PDF for NOC ${noc.id}, Property Number value: "${noc.propertyNumber}"`); // Debug: Specific field check
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
            const doc = new PDFDocument({ size: 'A4', margin: 40 });
            const chunks: Buffer[] = [];

            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            const MARGIN = 40;
            const PAGE_WIDTH = 595.28;
            const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
            let y = MARGIN;

            // --- FONTS & COLORS ---
            const FONTS = {
                REGULAR: 'Helvetica',
                BOLD: 'Helvetica-Bold'
            };
            const COLORS = {
                PRIMARY: '#000000',
                RED_BG: '#FF0000', // Bright red as per image
                WHITE: '#FFFFFF',
                GRAY_LINE: '#000000' // Lines appear black in image
            };

            // --- HELPER FUNCTIONS ---
            const drawRedSectionHeader = (text: string, currentY: number) => {
                doc.rect(MARGIN, currentY, CONTENT_WIDTH, 20).fill(COLORS.RED_BG);
                doc.font(FONTS.BOLD).fontSize(10).fillColor(COLORS.WHITE).text(text, MARGIN + 10, currentY + 5);
                return currentY + 25;
            };

            // Draw text label and value with underline: "Label:   Value___________" or "Label: ________"
            // Layout: Label at x, Value starts at valueX, Underline from valueX to valueX+width
            const drawFieldLine = (label: string, value: string | null | undefined, x: number, yPos: number, labelWidth: number, valueWidth: number, boldLabel: boolean = true) => {
                doc.font(boldLabel ? FONTS.BOLD : FONTS.REGULAR).fontSize(9).fillColor(COLORS.PRIMARY).text(label, x, yPos);

                const lineStartX = x + labelWidth;
                const lineEndX = lineStartX + valueWidth;
                const lineY = yPos + 10;

                // Value text centering roughly above line or just plain text
                if (value) {
                    doc.font(FONTS.BOLD).fontSize(9).text(String(value), lineStartX + 2, yPos - 1, { width: valueWidth, ellipsis: true });
                }

                // Underline
                doc.moveTo(lineStartX, lineY).lineTo(lineEndX, lineY).lineWidth(0.5).strokeColor(COLORS.GRAY_LINE).stroke();
            };

            const drawCheckbox = (label: string, isChecked: boolean, x: number, yPos: number) => {
                // Circle checkbox
                doc.circle(x + 5, yPos + 5, 5).lineWidth(1).strokeColor(COLORS.PRIMARY).stroke();
                if (isChecked) {
                    doc.circle(x + 5, yPos + 5, 2.5).fillColor(COLORS.PRIMARY).fill();
                }
                doc.font(FONTS.BOLD).fontSize(9).fillColor(COLORS.PRIMARY).text(label, x + 15, yPos);
            };

            // --- HEADER ---
            // Left Side: Company Info
            doc.font(FONTS.BOLD).fontSize(16).fillColor(COLORS.PRIMARY).text('Mateluxy Real Estate Broker L.L.C', MARGIN, y);
            y += 20;

            doc.font(FONTS.REGULAR).fontSize(8).text('Tel: +971 4 572 5420 Add:601 Bay Square 13, Business Bay, Dubai, UAE.', MARGIN, y);
            y += 12;
            doc.text('PO. Box: 453467 Email: info@mateluxy.com', MARGIN, y);
            y += 12;
            doc.text('Website: www.mateluxy.com', MARGIN, y);

            // Right Side: Logo
            try {
                // Trying to locate logo - adjusting path assumptions based on typical nestjs structure
                // Previous code used '../frontend/public/Logo.png' which worked relative to execution context presumably
                const logoPath = '../frontend/public/Logo.png';
                // Logo in image is top right, roughly aligned with text top
                doc.image(logoPath, PAGE_WIDTH - MARGIN - 70, MARGIN, { width: 60 });
            } catch (e) {
                // Ignore missing logo
            }

            y += 20;
            // Title
            doc.font(FONTS.BOLD).fontSize(12).text('NOC / LISTING AGREEMENT/ AGREEMENT BETWEEN OWNER & BROKER', MARGIN, y, { width: CONTENT_WIDTH, align: 'center' }); // Centered as best effort or left aligned if preferred? Image looks essentially block justified or left. Let's stick to simple bold line.
            // Actually image title looks left aligned but spans. The text in image: "NOC / LISTING AGREEMENT/ AGREEMENT BETWEEN OWNER & BROKER"

            y += 20;

            // --- LANDLORD / OWNER DETAILS ---
            y = drawRedSectionHeader('LANDLORD / OWNER DETAILS', y);
            y += 5;

            // Owners logic - The design shows 1st and 2nd specifically. We'll Map generic owners to these slots.
            const owner1 = noc.owners?.[0];
            const owner2 = noc.owners?.[1];

            drawFieldLine('1st Owner Name:', owner1?.name, MARGIN, y, 90, 380);
            y += 18;
            drawFieldLine('2nd Owner Name:', owner2?.name, MARGIN, y, 90, 380);
            y += 18;

            // ID/Passport line - shows generic, usually for 1st owner if space limited or combine? 
            // Design has "ID/Passport Number: ________________________________________________"
            // We'll put Owner 1's ID here or both? Let's generic comma separate if multiple, or just Owner 1 as primary.
            const idVal = noc.owners?.map((o: any) => o.emiratesId).join(', ') || '';
            drawFieldLine('ID/Passport  Number:', idVal, MARGIN, y, 100, 370);
            y += 18;

            // Issue Date / Mobile / Expiry - Mixed Line
            // "Issue Date: ______/______/______   Mobile: ____________________"
            const issueDate = owner1?.issueDate ? new Date(owner1.issueDate).toLocaleDateString() : '';
            const mobile = owner1?.phone ? `+${owner1.countryCode || ''} ${owner1.phone}` : '';
            const expiryDate = owner1?.expiryDate ? new Date(owner1.expiryDate).toLocaleDateString() : '';

            // Issue Date
            drawFieldLine('Issue Date:', issueDate, MARGIN, y, 60, 150);
            // Mobile (positioned to right)
            drawFieldLine('Mobile:', mobile, MARGIN + 250, y, 40, 180);
            y += 18;

            // Expiry Date
            drawFieldLine('Expiry Date:', expiryDate, MARGIN, y, 60, 150);
            y += 25;

            // --- PROPERTY DETAILS ---
            y = drawRedSectionHeader('PROPERTY DETAILS', y);
            y += 10;

            // Row 1: Checkboxes
            // Villa, Apartment, Office, Townhouse
            // We check against noc.propertyType
            const pType = (noc.propertyType || '').toLowerCase();
            drawCheckbox('Villa', pType.includes('villa'), MARGIN + 20, y);
            drawCheckbox('Apartment', pType.includes('apartment'), MARGIN + 120, y);
            drawCheckbox('Office', pType.includes('office'), MARGIN + 220, y);
            drawCheckbox('Townhouse', pType.includes('townhouse'), MARGIN + 320, y);
            y += 20;

            // Row 2: Status Checkboxes (We don't have this data, leaving unchecked or inferring?)
            // Vacant, Tenanted, Furnished, Unfurnished
            // user said "no logic change", so we strictly map what we have. We don't have these. Leave unchecked.
            drawCheckbox('Vacant', false, MARGIN + 20, y);
            drawCheckbox('Tenanted', false, MARGIN + 120, y);
            drawCheckbox('Furnished', false, MARGIN + 220, y);
            drawCheckbox('Unfurnished', false, MARGIN + 320, y);
            y += 25;

            // Vacating Date
            drawFieldLine('Vacating Date:', '', MARGIN + 20, y, 70, 150); // No data
            y += 25;

            // Fields
            const fieldLabelWidth = 110;
            const fieldValueWidth = 360;

            drawFieldLine('Building / Project name :', noc.buildingProjectName, MARGIN, y, 130, 340);
            y += 18;
            // Property Number
            drawFieldLine('Property Number', ':', MARGIN, y, 100, 0); // Hack to draw label with colon
            drawFieldLine('', noc.propertyNumber, MARGIN + 130, y, 0, 340);
            y += 18;
            drawFieldLine('Community', ':', MARGIN, y, 100, 0);
            drawFieldLine('', noc.community, MARGIN + 130, y, 0, 340);
            y += 18;
            drawFieldLine('Street Name', ':', MARGIN, y, 100, 0);
            drawFieldLine('', noc.streetName, MARGIN + 130, y, 0, 340);
            y += 25;

            // Split Grid
            // BUA (SQFT) : _______   Plot (SQFT) : ________
            drawFieldLine('BUA (SQFT)', ':', MARGIN, y, 80, 0);
            drawFieldLine('', noc.buildUpArea, MARGIN + 130, y, 0, 100);

            drawFieldLine('Plot (SQFT)', ':', MARGIN + 250, y, 80, 0);
            drawFieldLine('', noc.plotArea, MARGIN + 340, y, 0, 130);
            y += 18;

            // Bedrooms : ______ Bathrooms : _______
            drawFieldLine('Bedrooms', ':', MARGIN, y, 80, 0);
            drawFieldLine('', noc.bedrooms, MARGIN + 130, y, 0, 100);

            drawFieldLine('Bathrooms', ':', MARGIN + 250, y, 80, 0);
            drawFieldLine('', noc.bathrooms, MARGIN + 340, y, 0, 130);
            y += 18;

            // Rental Amount : ______ Parking : _______
            drawFieldLine('Rental Amount', ':', MARGIN, y, 80, 0);
            drawFieldLine('', noc.rentalAmount, MARGIN + 130, y, 0, 100);

            drawFieldLine('Parking', ':', MARGIN + 250, y, 80, 0);
            drawFieldLine('', noc.parking, MARGIN + 340, y, 0, 130);
            y += 18;

            // Sale Amount : ______
            drawFieldLine('Sale Amount', ':', MARGIN, y, 80, 0);
            drawFieldLine('', noc.saleAmount, MARGIN + 130, y, 0, 340);
            y += 30;


            // --- TERMS AND CONDITIONS ---
            y = drawRedSectionHeader('TERMS AND CONDITIONS', y);
            y += 10;

            // "The landlord / legal representative has agreed to appoint Mateluxy Real Estate Broker L.L.C"
            doc.font(FONTS.BOLD).fontSize(9).text('The landlord / legal representative has agreed to appoint', MARGIN, y);
            doc.font(FONTS.REGULAR).fontSize(10).text('Mateluxy Real Estate Broker L.L.C', MARGIN + 270, y - 1);
            y += 20;

            // Exclusive / Non-Exclusive Checkboxes
            const isExclusive = (noc.agreementType || '').toLowerCase() === 'exclusive';
            drawCheckbox('EXCLUSIVE', isExclusive, MARGIN + 20, y);
            drawCheckbox('NON-EXCLUSIVE', !isExclusive, MARGIN + 130, y);
            y += 25;

            // "Broker to list and advertise the above property for a period till _______"
            doc.font(FONTS.BOLD).fontSize(9).text('Broker to list and advertise the above property for a period till', MARGIN, y);
            // Date logic from periodMonths? 
            let tillDateStr = '';
            if (noc.periodMonths && noc.agreementDate) {
                const d = new Date(noc.agreementDate);
                d.setMonth(d.getMonth() + noc.periodMonths);
                tillDateStr = d.toLocaleDateString();
            }
            drawFieldLine('', tillDateStr, MARGIN + 300, y, 0, 150);
            y += 20;

            // Months checkboxes
            const months = noc.periodMonths || 0;
            drawCheckbox('1 MONTH', months === 1, MARGIN + 20, y);
            drawCheckbox('2 MONTH', months === 2, MARGIN + 130, y);
            drawCheckbox('3 MONTH', months === 3, MARGIN + 220, y);
            drawCheckbox('5 MONTH', months === 5, MARGIN + 310, y); // Image says 5 month? odd but okay.
            y += 20;
            // Adding 6 Month just in case since backend supports it, but keeping visual clean
            if (months === 6) {
                drawCheckbox('6 MONTH', true, MARGIN + 400, y - 20);
            }
            y += 10;

            // Legal Text
            const disclaimer = "I the undersigned confirm that I am the owner of the above property and / or have the legal authority to sign on behalf of the named owner(s).\n\nShould this property be subject to an offer I/we will notify the brokerage of this\nThis Agreement may be terminated by either party at any time upon seven (7) days written notice to the other party";
            doc.font(FONTS.REGULAR).fontSize(9).text(disclaimer, MARGIN, y, { width: CONTENT_WIDTH, align: 'justify', lineGap: 3 });
            y += 70;


            // --- SIGNATURES ---
            // 1st Owner Name: ________ Signature: ________ Date: _______

            // Owner 1
            const o1 = noc.owners?.[0];
            drawFieldLine('1st Owner Name:', o1?.name, MARGIN, y, 90, 130);

            // Signature Image for Owner 1 if exists
            const sigY = y - 10;
            if (o1?.signatureUrl) {
                try {
                    const response = await axios.get(o1.signatureUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(response.data);
                    doc.image(imageBuffer, MARGIN + 280, sigY - 10, { height: 30, width: 80, fit: [80, 30] as any });
                } catch (e) { }
            }
            drawFieldLine('Signature:', '', MARGIN + 230, y, 50, 100);

            drawFieldLine('Date:', o1?.signatureDate ? new Date(o1.signatureDate).toLocaleDateString() : '', MARGIN + 390, y, 30, 80);
            y += 40;

            // Owner 2
            const o2 = noc.owners?.[1];
            drawFieldLine('2nd Owner Name:', o2?.name, MARGIN, y, 90, 130);

            // Signature Image for Owner 2 if exists
            if (o2?.signatureUrl) {
                try {
                    const response = await axios.get(o2.signatureUrl, { responseType: 'arraybuffer' });
                    const imageBuffer = Buffer.from(response.data);
                    doc.image(imageBuffer, MARGIN + 280, y - 20, { height: 30, width: 80, fit: [80, 30] as any });
                } catch (e) { }
            }
            drawFieldLine('Signature:', '', MARGIN + 230, y, 50, 100);
            drawFieldLine('Date:', o2?.signatureDate ? new Date(o2.signatureDate).toLocaleDateString() : '', MARGIN + 390, y, 30, 80);


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
