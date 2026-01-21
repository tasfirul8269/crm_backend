import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class FileManagerService implements OnModuleInit {
    private readonly logger = new Logger(FileManagerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly uploadService: UploadService,
    ) { }

    async onModuleInit() {
        // Trigger a sync on startup to fix any 0B files
        this.syncFileSizes().catch(err => {
            this.logger.error('Initial file size sync failed', err);
        });
    }

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

    async getStorageStats() {
        const s3Usage = await this.uploadService.getS3Usage();

        const stats = {
            totalUsed: s3Usage.totalSizeBytes,
            totalCapacity: 10 * 1024 * 1024 * 1024, // 10GB Mock limit
            categories: [
                { name: 'Images', size: s3Usage.categories.images, color: '#00AAFF', icon: 'Image' },
                { name: 'Videos', size: s3Usage.categories.videos, color: '#FFAA00', icon: 'Video' },
                { name: 'Audio', size: s3Usage.categories.audio, color: '#AA00FF', icon: 'Music' },
                { name: 'Archives', size: s3Usage.categories.archives, color: '#FF00AA', icon: 'Archive' },
                { name: 'Documents', size: s3Usage.categories.documents, color: '#00FFAA', icon: 'FileText' },
                { name: 'Fonts', size: s3Usage.categories.fonts, color: '#AAAAAA', icon: 'Type' },
            ]
        };

        return stats;
    }

    async syncFileSizes() {
        this.logger.log('Starting sync of file sizes for 0B files...');
        const filesWithZeroSize = await this.prisma.file.findMany({
            where: { size: 0, isDeleted: false },
            select: { id: true, url: true, name: true, mimeType: true }
        });

        this.logger.log(`Found ${filesWithZeroSize.length} files with 0 size to sync.`);

        let updatedCount = 0;
        for (const file of filesWithZeroSize) {
            try {
                this.logger.debug(`Processing file: ${file.name} (${file.url})`);
                const metadata = await this.uploadService.getFileMetadata(file.url);
                this.logger.debug(`Metadata result for ${file.name}: size=${metadata.size}, mime=${metadata.mimeType}`);

                if (metadata.size > 0) {
                    await this.prisma.file.update({
                        where: { id: file.id },
                        data: {
                            size: metadata.size,
                            mimeType: file.mimeType === 'application/octet-stream' ? metadata.mimeType : undefined
                        }
                    });
                    updatedCount++;
                    this.logger.log(`Updated ${file.name} size to ${metadata.size}`);
                } else {
                    this.logger.warn(`Failed to retrieve size for ${file.name} (ID: ${file.id}), URL: ${file.url}`);
                }
            } catch (e) {
                this.logger.error(`Failed to sync size for file ${file.id}: ${e.message}`);
            }
        }

        this.logger.log(`File sync completed. Updated ${updatedCount} files.`);

        // Sync Folder Sizes
        this.logger.log('Starting sync of folder sizes...');
        const folders = await this.prisma.folder.findMany({
            where: { isDeleted: false }
        });

        let updatedFolders = 0;
        for (const folder of folders) {
            const realSize = await this.getFolderSize(folder.id);
            if (realSize !== folder.size) {
                await this.prisma.folder.update({
                    where: { id: folder.id },
                    data: { size: realSize }
                });
                updatedFolders++;
            }
        }
        this.logger.log(`Folder sync completed. Updated ${updatedFolders} folders.`);

        return { updatedCount, totalFound: filesWithZeroSize.length, updatedFolders };
    }

    async getFilesByCategory(category: string) {
        const s3Files = await this.uploadService.getS3Files();

        const categoryMap: { [key: string]: string[] } = {
            'images': ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff'],
            'videos': ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv'],
            'audio': ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'],
            'documents': ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf'],
            'archives': ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'],
            'fonts': ['ttf', 'otf', 'woff', 'woff2', 'eot']
        };

        const extensions = categoryMap[category.toLowerCase()] || [];

        const files = await this.prisma.file.findMany({
            where: {
                isDeleted: false,
                OR: extensions.map(ext => ({
                    url: { endsWith: `.${ext}`, mode: 'insensitive' }
                }))
            },
            orderBy: { createdAt: 'desc' }
        });

        return files;
    }

    async getRecentFiles() {
        return this.prisma.file.findMany({
            where: { isDeleted: false },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
    }

    async getDeletedItems() {
        const folders = await this.prisma.folder.findMany({
            where: { isDeleted: true },
            orderBy: { deletedAt: 'desc' }
        });

        const files = await this.prisma.file.findMany({
            where: { isDeleted: true },
            orderBy: { deletedAt: 'desc' }
        });

        return { folders, files };
    }

    async uploadFile(file: Express.Multer.File, folderId?: string) {
        const url = await this.uploadService.uploadFile(file);
        if (!url) throw new Error('Failed to upload file to S3');

        return this.prisma.file.create({
            data: {
                name: file.originalname,
                url: url,
                mimeType: file.mimetype,
                size: file.size,
                folderId: folderId,
            }
        });
    }

    async restoreFile(fileId: string) {
        return this.prisma.file.update({
            where: { id: fileId },
            data: { isDeleted: false, deletedAt: null }
        });
    }

    async deleteFolder(folderId: string) {
        // Soft delete folder and all its contents recursively
        await this.prisma.folder.update({
            where: { id: folderId },
            data: { isDeleted: true, deletedAt: new Date() }
        });

        // Soft delete files in this folder
        await this.prisma.file.updateMany({
            where: { folderId },
            data: { isDeleted: true, deletedAt: new Date() }
        });

        // Recursively soft delete subfolders
        const subfolders = await this.prisma.folder.findMany({
            where: { parentId: folderId }
        });

        for (const sub of subfolders) {
            await this.deleteFolder(sub.id);
        }
    }

    async restoreFolder(folderId: string) {
        await this.prisma.folder.update({
            where: { id: folderId },
            data: { isDeleted: false, deletedAt: null }
        });

        await this.prisma.file.updateMany({
            where: { folderId },
            data: { isDeleted: false, deletedAt: null }
        });

        const subfolders = await this.prisma.folder.findMany({
            where: { parentId: folderId }
        });

        for (const sub of subfolders) {
            await this.restoreFolder(sub.id);
        }
    }

    async renameFolder(id: string, name: string) {
        return this.prisma.folder.update({
            where: { id },
            data: { name }
        });
    }

    async updateFolderColor(folderId: string, color: string) {
        return this.prisma.folder.update({
            where: { id: folderId },
            data: { color }
        });
    }

    async renameFile(id: string, name: string) {
        return this.prisma.file.update({
            where: { id },
            data: { name }
        });
    }

    async moveFolder(id: string, targetParentId: string | null) {
        // Prevent moving a folder into itself or its children
        if (targetParentId) {
            let current: any = await this.prisma.folder.findUnique({
                where: { id: targetParentId },
                include: { parent: true }
            });
            while (current) {
                if (current.id === id) throw new Error('Cannot move a folder into itself or its children');
                if (!current.parentId) break;
                current = await this.prisma.folder.findUnique({
                    where: { id: current.parentId },
                    include: { parent: true }
                });
            }
        }

        return this.prisma.folder.update({
            where: { id },
            data: { parentId: targetParentId }
        });
    }

    async moveFile(id: string, targetFolderId: string | null) {
        return this.prisma.file.update({
            where: { id },
            data: { folderId: targetFolderId }
        });
    }

    async copyFile(id: string, targetFolderId: string | null) {
        const file = await this.prisma.file.findUnique({ where: { id } });
        if (!file) throw new Error('File not found');

        return this.prisma.file.create({
            data: {
                name: `Copy of ${file.name}`,
                url: file.url,
                mimeType: file.mimeType,
                size: file.size,
                folderId: targetFolderId
            }
        });
    }

    async copyFolder(id: string, targetParentId: string | null) {
        const folder = await this.prisma.folder.findUnique({ where: { id } });
        if (!folder) throw new Error('Folder not found');

        const newFolder = await this.prisma.folder.create({
            data: {
                name: `Copy of ${folder.name}`,
                parentId: targetParentId,
                isSystem: folder.isSystem
            }
        });

        await this.copyFolderRecursive(id, newFolder.id);
        return newFolder;
    }

    private async copyFolderRecursive(sourceId: string, targetId: string) {
        // Copy files
        const files = await this.prisma.file.findMany({ where: { folderId: sourceId, isDeleted: false } });
        for (const file of files) {
            await this.prisma.file.create({
                data: {
                    name: file.name,
                    url: file.url,
                    mimeType: file.mimeType,
                    size: file.size,
                    folderId: targetId
                }
            });
        }

        // Copy subfolders
        const subfolders = await this.prisma.folder.findMany({ where: { parentId: sourceId, isDeleted: false } });
        for (const sub of subfolders) {
            const newSub = await this.prisma.folder.create({
                data: {
                    name: sub.name,
                    parentId: targetId,
                    isSystem: sub.isSystem
                }
            });
            await this.copyFolderRecursive(sub.id, newSub.id);
        }
    }

    async ensureFolderStructure(path: string): Promise<string> {
        const segments = path.split('/').filter(s => s.length > 0);
        let parentId: string | null = null;

        for (const segment of segments) {
            let folder = await this.prisma.folder.findFirst({
                where: { name: segment, parentId, isDeleted: false }
            });

            if (!folder) {
                folder = await this.prisma.folder.create({
                    data: { name: segment, parentId, isSystem: true }
                });
            }
            parentId = folder.id;
        }

        return parentId!;
    }

    async createPropertyStructure(property: any, fileUrls: any) {
        const propFolderId = await this.ensureFolderStructure(`Properties/${property.title}`);

        // Photos
        if (fileUrls.images && fileUrls.images.length > 0) {
            const photosFolderId = await this.createFolder('Photos', propFolderId, true);
            for (const url of fileUrls.images) {
                await this.registerSystemFile(url, property.title, photosFolderId.id);
            }
        }

        const documentsFolderId = await this.createFolder('Documents', propFolderId, true);
        if (fileUrls.floorPlans && fileUrls.floorPlans.length > 0) {
            for (const url of fileUrls.floorPlans) {
                await this.registerSystemFile(url, 'Floor Plan', documentsFolderId.id);
            }
        }
        if (fileUrls.qrCodeUrl) {
            await this.registerSystemFile(fileUrls.qrCodeUrl, 'QR Code', documentsFolderId.id);
        }

        if (fileUrls.videoTourUrl) {
            const videosFolderId = await this.createFolder('Videos', propFolderId, true);
            await this.registerSystemFile(fileUrls.videoTourUrl, 'Video Tour', videosFolderId.id);
        }
    }

    async createOffPlanStructure(property: any, urls: any) {
        const propFolderId = await this.ensureFolderStructure(`Off-Plan/${property.title}`);

        if (urls.images && urls.images.length > 0) {
            const photosFolderId = await this.createFolder('Photos', propFolderId, true);
            for (const url of urls.images) {
                await this.registerSystemFile(url, property.title, photosFolderId.id);
            }
        }

        if (urls.brochureUrl) {
            const docsFolderId = await this.createFolder('Documents', propFolderId, true);
            await this.registerSystemFile(urls.brochureUrl, 'Brochure', docsFolderId.id);
        }

        if (urls.paymentPlanUrl) {
            const docsFolderId = await this.createFolder('Documents', propFolderId, true);
            await this.registerSystemFile(urls.paymentPlanUrl, 'Payment Plan', docsFolderId.id);
        }

        if (urls.videoUrl) {
            const videosFolderId = await this.createFolder('Videos', propFolderId, true);
            await this.registerSystemFile(urls.videoUrl, 'Video Tour', videosFolderId.id);
        }
    }

    async createAgentFolder(agent: any, photoUrl: string, vcardUrl: string, licenseUrl: string) {
        const agentFolderId = await this.ensureFolderStructure(`Agents/${agent.name}`);

        if (photoUrl) {
            await this.registerSystemFile(photoUrl, `${agent.name} Photo`, agentFolderId);
        }
        if (vcardUrl) {
            await this.registerSystemFile(vcardUrl, `${agent.name} VCard`, agentFolderId);
        }
        if (licenseUrl) {
            await this.registerSystemFile(licenseUrl, `${agent.name} License`, agentFolderId);
        }
    }

    async createTenancyContractStructure(contract: any, pdfUrl: string) {
        const contractFolderId = await this.ensureFolderStructure(`Tenancy Contracts/${contract.contractNumber}`);
        await this.registerSystemFile(pdfUrl, `Contract ${contract.contractNumber}`, contractFolderId);
    }

    async createNocFolder(noc: any, pdfUrl: string) {
        const nocFolderId = await this.ensureFolderStructure(`NOCs/${noc.nocNumber}`);
        await this.registerSystemFile(pdfUrl, `NOC ${noc.nocNumber}`, nocFolderId);
    }

    async createUserFolder(user: any, avatarUrl: string) {
        const userFolderId = await this.ensureFolderStructure(`Users/${user.firstName} ${user.lastName}`);
        if (avatarUrl) {
            await this.registerSystemFile(avatarUrl, `${user.firstName} Avatar`, userFolderId);
        }
    }

    async createDeveloperFolder(developer: any, logoUrl?: string, salesManagerPhotoUrl?: string) {
        if (!developer) return;

        // 1. Create Developer Folder in "Developers" root folder
        let developersFolder = await this.prisma.folder.findFirst({
            where: { name: 'Developers', parentId: null }
        });

        if (!developersFolder) {
            developersFolder = await this.prisma.folder.create({
                data: { name: 'Developers', isSystem: true }
            });
        }

        const devFolder = await this.createFolder(developer.name, developersFolder.id, true);

        // 2. Add Developer Logo and Sales Manager Photo
        if (logoUrl) {
            await this.registerSystemFile(logoUrl, 'logo', devFolder.id);
        }
        if (salesManagerPhotoUrl) {
            await this.registerSystemFile(salesManagerPhotoUrl, 'sales_manager_photo', devFolder.id);
        }

        return devFolder;
    }

    async migrateAllData() {
        const properties = await this.prisma.property.findMany();
        for (const prop of properties) {
            await this.createPropertyStructure(prop, {
                images: prop.mediaImages || [],
                floorPlans: [],
                qrCodeUrl: prop.dldQrCode,
                videoTourUrl: prop.videoUrl
            });
        }

        const offPlanProperties = await this.prisma.offPlanProperty.findMany();
        for (const prop of offPlanProperties) {
            const images = [
                ...(prop.exteriorMedia || []),
                ...(prop.interiorMedia || []),
            ];

            // Extract floor plan images from JSON if possible
            if (Array.isArray(prop.floorPlans)) {
                const fpImages = (prop.floorPlans as any[]).map(f => f.floorPlanImage).filter(Boolean);
                images.push(...fpImages);
            }

            await this.createOffPlanStructure(prop, {
                images,
                brochureUrl: prop.brochure,
                paymentPlanUrl: '',
                videoUrl: prop.videoUrl
            });
        }

        const agents = await this.prisma.agent.findMany();
        for (const agent of agents) {
            await this.createAgentFolder(agent, agent.photoUrl || '', agent.vcardUrl || '', agent.licenseDocumentUrl || '');
        }

        const users = await this.prisma.user.findMany();
        for (const user of users) {
            await this.createUserFolder(user, user.avatarUrl!);
        }

        return { message: 'Migration completed' };
    }

    async deleteFile(fileId: string) {
        return this.prisma.file.update({
            where: { id: fileId },
            data: { isDeleted: true, deletedAt: new Date() }
        });
    }

    async permanentlyDeleteFile(fileId: string) {
        const file = await this.prisma.file.findUnique({ where: { id: fileId } });
        if (file) {
            // Delete from S3 only if it's an uploaded file (optional, depends on policy)
            // await this.uploadService.deleteFile(file.url);
            return this.prisma.file.delete({ where: { id: fileId } });
        }
    }

    async permanentlyDeleteFolder(folderId: string) {
        // Recursively delete subfolders and files
        const subfolders = await this.prisma.folder.findMany({ where: { parentId: folderId } });
        for (const sub of subfolders) {
            await this.permanentlyDeleteFolder(sub.id);
        }

        await this.prisma.file.deleteMany({ where: { folderId } });
        return this.prisma.folder.delete({ where: { id: folderId } });
    }

    async cleanupDeletedItems() {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const filesToDelete = await this.prisma.file.findMany({
            where: { isDeleted: true, deletedAt: { lt: fifteenDaysAgo } }
        });

        for (const file of filesToDelete) {
            await this.permanentlyDeleteFile(file.id);
        }

        const foldersToDelete = await this.prisma.folder.findMany({
            where: { isDeleted: true, deletedAt: { lt: fifteenDaysAgo } }
        });

        for (const folder of foldersToDelete) {
            await this.permanentlyDeleteFolder(folder.id);
        }
    }

    async registerSystemFile(url: string, nameHint: string, folderId: string) {
        if (!url) return;
        const filename = url.split('/').pop() || nameHint;

        try {
            const existing = await this.prisma.file.findFirst({
                where: { url, folderId, isDeleted: false }
            });
            if (existing) return;
        } catch (e) { }

        // Fetch real metadata if possible
        const metadata = await this.uploadService.getFileMetadata(url);

        // Create File record
        await this.prisma.file.create({
            data: {
                name: filename,
                url: url,
                mimeType: metadata.mimeType || 'application/octet-stream',
                size: metadata.size || 0,
                folderId: folderId,
            }
        });
    }
    async getItemPath(id: string, type: 'file' | 'folder'): Promise<string> {
        let currentFolderId: string | null = null;

        if (type === 'file') {
            const file = await this.prisma.file.findUnique({ where: { id }, select: { folderId: true } });
            if (!file) throw new Error('File not found');
            currentFolderId = file.folderId;
        } else {
            const folder = await this.prisma.folder.findUnique({ where: { id }, select: { parentId: true } });
            if (!folder) throw new Error('Folder not found');
            currentFolderId = folder.parentId;
        }

        if (!currentFolderId) return 'Root';

        const pathSegments: string[] = [];
        let current = await this.prisma.folder.findUnique({ where: { id: currentFolderId } });

        while (current) {
            pathSegments.unshift(current.name);
            if (!current.parentId) break;
            current = await this.prisma.folder.findUnique({ where: { id: current.parentId } });
        }

        return 'Root/' + pathSegments.join('/');
    }
}
