import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class FileManagerService {
    private readonly logger = new Logger(FileManagerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async createFolder(name: string, parentId?: string, isSystem: boolean = false) {
        return this.prisma.folder.create({
            data: {
                name,
                parentId,
                isSystem,
            },
        });
    }

    async getFolderContents(folderId?: string) {
        // If no folderId, get root folders (parentId is null)
        const whereClause = {
            isDeleted: false,
            parentId: folderId ?? null
        };

        const foldersRaw = await this.prisma.folder.findMany({
            where: whereClause,
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        files: { where: { isDeleted: false } },
                        children: { where: { isDeleted: false } }
                    }
                }
            }
        });

        // Calculate sizes for each folder in the current view
        const folders = await Promise.all(foldersRaw.map(async (folder) => {
            const size = await this.getFolderSize(folder.id);
            return { ...folder, size };
        }));

        // Get files only if folderId is provided (files can't easily be at 'root' in this UI logic,
        // or they can be. Let's assume files can be at root too).
        const files = await this.prisma.file.findMany({
            where: {
                isDeleted: false,
                folderId: folderId ?? null
            },
            orderBy: { createdAt: 'desc' },
        });

        // Also get breadcrumbs if folderId provided
        let breadcrumbs: any[] = [];
        if (folderId) {
            breadcrumbs = await this.getBreadcrumbs(folderId);
        }

        return { folders, files, breadcrumbs };
    }

    private async getFolderSize(folderId: string): Promise<number> {
        // Recursive size calculation
        let totalSize = 0;

        // Sum files in this folder
        const files = await this.prisma.file.aggregate({
            _sum: { size: true },
            where: { folderId, isDeleted: false }
        });
        totalSize += files._sum.size || 0;

        // Sum subfolders
        const subfolders = await this.prisma.folder.findMany({
            where: { parentId: folderId, isDeleted: false },
            select: { id: true }
        });

        for (const sub of subfolders) {
            totalSize += await this.getFolderSize(sub.id);
        }

        return totalSize;
    }

    private async getBreadcrumbs(folderId: string): Promise<any[]> {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
            include: { parent: true }
        });

        if (!folder) return [];

        const breadcrumbs = [{ id: folder.id, name: folder.name }];
        let current = folder;
        while (current.parent) {
            current = await this.prisma.folder.findUnique({
                where: { id: current.parentId! },
                include: { parent: true }
            }) as any;
            if (current) {
                breadcrumbs.unshift({ id: current.id, name: current.name });
            } else {
                break;
            }
        }
        return breadcrumbs;
    }

    async uploadFile(file: Express.Multer.File, folderId?: string) {
        // Upload to S3 via UploadService
        const url = await this.uploadService.uploadFile(file);
        if (!url) return null;

        // Create File record
        return this.prisma.file.create({
            data: {
                name: file.originalname,
                url,
                mimeType: file.mimetype,
                size: file.size,
                folderId: folderId ?? null,
            },
        });
    }

    // Virtual move/copy logic to be added

    // --- Automation Helpers ---

    async ensureFolderStructure(path: string[]): Promise<string> {
        // path e.g. ["Properties", "My Property Ref"]
        // Returns the ID of the last folder

        let parentId: string | null = null;

        for (const segment of path) {
            // Find existing
            let folder = await this.prisma.folder.findFirst({
                where: {
                    name: segment,
                    parentId: parentId
                }
            });

            // Create if not exists
            if (!folder) {
                folder = await this.prisma.folder.create({
                    data: {
                        name: segment,
                        parentId: parentId,
                        isSystem: true, // Auto-created folders are system folders
                    }
                });
            }

            parentId = folder.id;
        }

        return parentId!;
    }

    // --- Entity Specific Automation ---

    async createPropertyStructure(property: any, fileUrls: any) {
        // Folder: Properties / [Reference]
        const reference = property.reference || property.propertyTitle || 'Untitled Property';
        const rootId = await this.ensureFolderStructure(['Properties', reference]);

        // 1. Cover Photo
        if (fileUrls.coverPhoto) {
            await this.registerSystemFile(fileUrls.coverPhoto, 'Cover Photo', rootId);
        }

        // 2. Media Images -> "media" folder
        if (fileUrls.mediaImages && fileUrls.mediaImages.length > 0) {
            const mediaId = await this.ensureFolderStructure(['Properties', reference, 'media']);
            for (const url of fileUrls.mediaImages) {
                await this.registerSystemFile(url, 'Image', mediaId);
            }
        }

        // 3. Documents -> "documents" folder (NOC, Title Deed, etc)
        const docsToCheck = ['nocDocument', 'passportCopy', 'emiratesIdScan', 'titleDeed'];
        const hasDocs = docsToCheck.some(key => fileUrls[key]);

        if (hasDocs) {
            const docId = await this.ensureFolderStructure(['Properties', reference, 'documents']);
            if (fileUrls.nocDocument) await this.registerSystemFile(fileUrls.nocDocument, 'NOC', docId);
            if (fileUrls.passportCopy) await this.registerSystemFile(fileUrls.passportCopy, 'Passport', docId);
            if (fileUrls.emiratesIdScan) await this.registerSystemFile(fileUrls.emiratesIdScan, 'Emirates ID', docId);
            if (fileUrls.titleDeed) await this.registerSystemFile(fileUrls.titleDeed, 'Title Deed', docId);
        }
    }

    async createOffPlanStructure(property: any, urls: any) {
        // Folder: Off Plan / [Project Title]
        const title = property.projectTitle || 'Untitled Project';
        const rootId = await this.ensureFolderStructure(['Off Plan', title]);

        // Cover
        if (urls.coverPhoto) await this.registerSystemFile(urls.coverPhoto, 'Cover Photo', rootId);

        // Subfolders
        if (urls.exteriorMedia?.length) {
            const extId = await this.ensureFolderStructure(['Off Plan', title, 'exterior']);
            for (const url of urls.exteriorMedia) {
                await this.registerSystemFile(url, 'Exterior', extId);
            }
        }

        if (urls.interiorMedia?.length) {
            const intId = await this.ensureFolderStructure(['Off Plan', title, 'interior']);
            for (const url of urls.interiorMedia) {
                await this.registerSystemFile(url, 'Interior', intId);
            }
        }

        // Brochure
        if (urls.brochure) await this.registerSystemFile(urls.brochure, 'Brochure', rootId);
    }

    async createAgentFolder(agent: any, photoUrl?: string, vcardUrl?: string, licenseUrl?: string) {
        const rootId = await this.ensureFolderStructure(['Agents', agent.name]);
        if (photoUrl) await this.registerSystemFile(photoUrl, 'Photo', rootId);
        if (vcardUrl) await this.registerSystemFile(vcardUrl, 'VCard', rootId);
        if (licenseUrl) await this.registerSystemFile(licenseUrl, 'License', rootId);
    }

    async createDeveloperFolder(developer: any, logoUrl?: string, salesPhotoUrl?: string) {
        const rootId = await this.ensureFolderStructure(['Developers', developer.name]);
        if (logoUrl) await this.registerSystemFile(logoUrl, 'Logo', rootId);
        if (salesPhotoUrl) await this.registerSystemFile(salesPhotoUrl, 'Sales Manager', rootId);
    }

    async createTenancyContractStructure(contract: any, pdfUrl: string) {
        const rootId = await this.ensureFolderStructure(['Tenancy Contracts']);
        await this.registerSystemFile(pdfUrl, `Tenancy Contract - ${contract.id}.pdf`, rootId);
    }

    async createNocFolder(noc: any, pdfUrl?: string) {
        const rootId = await this.ensureFolderStructure(['Mateluxy NOC']);
        if (pdfUrl) await this.registerSystemFile(pdfUrl, `Signed NOC - ${noc.id}.pdf`, rootId);
    }

    async createUserFolder(user: any, avatarUrl?: string) {
        if (!avatarUrl) return;

        try {
            const rootId = await this.ensureFolderStructure(['Users', user.username || user.emails?.[0] || 'Unknown']);
            await this.registerSystemFile(avatarUrl, 'avatar', rootId);
        } catch (e) {
            this.logger.error(`Failed to register User files`, e);
        }
    }

    async migrateAllData() {
        this.logger.log('Starting migration of existing data to File Manager...');
        let count = 0;

        // 1. Developers
        const developers = await this.prisma.developer.findMany();
        for (const dev of developers) {
            await this.createDeveloperFolder(dev, dev.logoUrl || undefined, dev.salesManagerPhotoUrl || undefined);
            count++;
        }

        // 2. Agents
        const agents = await this.prisma.agent.findMany();
        for (const agent of agents) {
            await this.createAgentFolder(agent, agent.photoUrl || undefined, undefined, agent.licenseDocumentUrl || undefined);
            count++;
        }

        // 3. Properties
        const properties = await this.prisma.property.findMany();
        for (const prop of properties) {
            const files = {
                coverPhoto: prop.coverPhoto,
                mediaImages: prop.mediaImages,
                videoUrl: prop.videoUrl,
                nocDocument: prop.nocDocument,
                passportCopy: prop.passportCopy,
                emiratesIdScan: prop.emiratesIdScan,
                titleDeed: prop.titleDeed,
            };
            await this.createPropertyStructure(prop, files);
            count++;
        }

        // 4. Off-Plan
        const offPlan = await this.prisma.offPlanProperty.findMany();
        for (const op of offPlan) {
            const urls = {
                coverPhoto: op.coverPhoto,
                interiorMedia: op.interiorMedia,
                exteriorMedia: op.exteriorMedia,
                brochure: op.brochure,
            };
            await this.createOffPlanStructure(op, urls);
            count++;
        }

        // 5. Users
        const users = await this.prisma.user.findMany();
        for (const user of users) {
            await this.createUserFolder(user, user.avatarUrl || undefined);
            count++;
        }

        this.logger.log(`Migration completed. Processed ${count} entities.`);
        return { message: 'Migration completed', count };
    }

    async deleteFile(fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (!file) throw new Error('File not found');

        // Soft delete from DB
        return this.prisma.file.update({
            where: { id: fileId },
            data: { isDeleted: true, deletedAt: new Date() }
        });
    }

    async restoreFile(fileId: string) {
        return this.prisma.file.update({
            where: { id: fileId },
            data: { isDeleted: false, deletedAt: null }
        });
    }

    async deleteFolder(folderId: string) {
        const folder = await this.prisma.folder.findUnique({
            where: { id: folderId },
        });

        if (!folder) throw new Error('Folder not found');

        // Soft delete folder and all contents recursively (logic wise, path-based filters handle it)
        // For real recursive soft delete:
        await this.prisma.file.updateMany({
            where: { folderId },
            data: { isDeleted: true, deletedAt: new Date() }
        });

        return this.prisma.folder.update({
            where: { id: folderId },
            data: { isDeleted: true, deletedAt: new Date() }
        });
    }

    async restoreFolder(folderId: string) {
        await this.prisma.file.updateMany({
            where: { folderId },
            data: { isDeleted: false, deletedAt: null }
        });

        return this.prisma.folder.update({
            where: { id: folderId },
            data: { isDeleted: false, deletedAt: null }
        });
    }

    async getStorageStats() {
        const files = await this.prisma.file.findMany({
            where: { isDeleted: false },
            select: { size: true, mimeType: true }
        });

        const totalLimit = 150 * 1024 * 1024 * 1024; // 150 GB
        const stats = {
            totalLimit,
            usedSize: 0,
            categories: {
                images: 0,
                videos: 0,
                audio: 0,
                archives: 0,
                documents: 0,
                fonts: 0,
                others: 0
            }
        };

        files.forEach(file => {
            stats.usedSize += file.size;
            const mime = file.mimeType.toLowerCase();
            if (mime.startsWith('image/')) stats.categories.images += file.size || 0;
            else if (mime.startsWith('video/')) stats.categories.videos += file.size || 0;
            else if (mime.startsWith('audio/')) stats.categories.audio += file.size || 0;
            else if (mime === 'application/zip' || mime.includes('archive') || mime.includes('compressed')) stats.categories.archives += file.size || 0;
            else if (mime === 'application/pdf' || mime.includes('word') || mime.includes('openxmlformats') || mime.includes('spreadsheet') || mime.includes('text/')) stats.categories.documents += file.size || 0;
            else if (mime.startsWith('font/')) stats.categories.fonts += file.size || 0;
            else stats.categories.others += file.size || 0;
        });

        return stats;
    }

    async getRecentFiles() {
        return this.prisma.file.findMany({
            where: { isDeleted: false },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            include: { folder: true }
        });
    }

    async getDeletedItems() {
        const files = await this.prisma.file.findMany({
            where: { isDeleted: true },
            orderBy: { deletedAt: 'desc' },
            take: 20
        });

        const folders = await this.prisma.folder.findMany({
            where: { isDeleted: true },
            orderBy: { deletedAt: 'desc' },
            take: 20
        });

        return { files, folders };
    }

    async registerSystemFile(url: string, nameHint: string, folderId: string) {
        // Check if already exists in this folder to avoid dupes?
        // For simplicity, just create. filename will be derived or generic.

        // Try to get filename from URL
        let filename = nameHint;
        try {
            const urlParts = url.split('/');
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && lastPart.includes('.')) {
                // If it looks like a filename (has ext), use it, but maybe prepend hint
                // Actually user probably wants clean names.
                // Let's use the hint + extension if possible, or just the UUID from S3 if no hint useful
                filename = lastPart;
            } else {
                filename = `${nameHint}`; // + ext?
            }
        } catch (e) { }

        // Create File record
        // We don't have mimeType/size easily for URLs unless we HEAD them or used upload service return.
        // For now, allow 0/unknown.
        await this.prisma.file.create({
            data: {
                name: filename,
                url: url,
                mimeType: 'application/octet-stream', // Unknown
                size: 0,
                folderId: folderId,
            }
        });
    }
}
