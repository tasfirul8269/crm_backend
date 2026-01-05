import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import axios from 'axios';
import { IntegrationsService } from '../integrations/integrations.service';

interface S3Usage {
    totalSizeBytes: number;
    totalSizeGB: string;
    categories: {
        images: number;
        videos: number;
        audio: number;
        documents: number;
        archives: number;
        fonts: number;
        others: number;
    };
}

@Injectable()
export class UploadService {
    private s3Client: S3Client | null = null;
    private bucketName: string = '';
    private region: string = '';
    private readonly logger = new Logger(UploadService.name);
    private isConfigured = false;
    private initializationAttempted = false;

    constructor(
        private configService: ConfigService,
        private integrationsService: IntegrationsService,
    ) {
        // Try env variables on startup for backward compatibility
        this.initializeFromEnv();
    }

    /**
     * Initialize from environment variables (backward compatibility)
     */
    private initializeFromEnv(): void {
        const region = this.configService.get<string>('AWS_REGION') || '';
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';
        const bucketName = this.configService.get<string>('AWS_BUCKET_NAME') || '';

        if (region && accessKeyId && secretAccessKey && bucketName) {
            try {
                this.s3Client = new S3Client({
                    region,
                    credentials: { accessKeyId, secretAccessKey },
                });
                this.bucketName = bucketName;
                this.region = region;
                this.isConfigured = true;
                this.logger.log('AWS S3 client initialized from environment variables');
            } catch (error) {
                this.logger.error('Failed to initialize S3 client from env:', error);
            }
        } else {
            this.logger.warn('AWS S3 env credentials not complete. Will check integration config on first use.');
        }
    }

    /**
     * Ensure S3 is initialized, fetching from integration config if needed
     */
    private async ensureS3Initialized(): Promise<boolean> {
        if (this.isConfigured && this.s3Client) {
            return true;
        }

        // Only attempt integration config once per app lifecycle
        if (this.initializationAttempted) {
            return this.isConfigured;
        }
        this.initializationAttempted = true;

        // Try to get from integration config
        try {
            const credentials = await this.integrationsService.getCredentials('amazon_aws');
            if (credentials?.accessKeyId && credentials?.secretAccessKey && credentials?.bucketName && credentials?.region) {
                this.s3Client = new S3Client({
                    region: credentials.region,
                    credentials: {
                        accessKeyId: credentials.accessKeyId,
                        secretAccessKey: credentials.secretAccessKey,
                    },
                });
                this.bucketName = credentials.bucketName;
                this.region = credentials.region;
                this.isConfigured = true;
                this.logger.log('AWS S3 client initialized from integration config');
                return true;
            }
        } catch (error) {
            this.logger.warn('Failed to get AWS credentials from integration config');
        }

        return false;
    }

    /**
     * Refresh S3 credentials (call when integration is updated)
     */
    async refreshCredentials(): Promise<void> {
        this.s3Client = null;
        this.isConfigured = false;
        this.initializationAttempted = false;
        this.initializeFromEnv();
        if (!this.isConfigured) {
            await this.ensureS3Initialized();
        }
    }

    async uploadFile(file: Express.Multer.File): Promise<string | null> {
        // Ensure S3 is initialized (from env or integration config)
        await this.ensureS3Initialized();

        if (!this.isConfigured || !this.s3Client) {
            this.logger.warn('Skipping S3 upload - AWS not configured');
            return null;
        }

        try {
            // Parse original filename
            const originalName = file.originalname;
            const lastDotIndex = originalName.lastIndexOf('.');
            const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
            const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

            // Find unique key with collision handling
            let key = await this.getUniqueKey(baseName, extension);
            let buffer = file.buffer;
            let contentType = file.mimetype;

            // Optimize image if it's an image type
            if (file.mimetype.startsWith('image/')) {
                try {
                    buffer = await this.optimizeImage(file.buffer);
                    // Force jpg/content-type if converted, but keeping original ext for now mainly unless we force conversion to webp/jpg
                    // strict resizing to 1920x1080 inside
                } catch (optError) {
                    this.logger.warn('Image optimization failed, uploading original:', optError);
                }
            }

            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                    ACL: 'public-read', // Make image publicly accessible for Property Finder
                }),
            );

            const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
            this.logger.log(`File uploaded successfully: ${url}`);
            return url;
        } catch (error) {
            this.logger.error('Failed to upload file to S3:', error);
            return null;
        }
    }

    private async optimizeImage(buffer: Buffer): Promise<Buffer> {
        const metadata = await sharp(buffer).metadata();

        let pipeline = sharp(buffer)
            .resize(1920, 1080, {
                fit: 'inside',
                withoutEnlargement: true,
            });

        if (metadata.format === 'png') {
            return pipeline.png({ quality: 80, compressionLevel: 9 }).toBuffer();
        } else {
            return pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
        }
    }

    /**
     * Upload property image with optional watermark
     */
    async uploadPropertyImage(
        file: Express.Multer.File,
        watermark?: { imageUrl: string; position: string; opacity: number; scale: number } | null
    ): Promise<string | null> {
        // Ensure S3 is initialized (from env or integration config)
        await this.ensureS3Initialized();

        if (!this.isConfigured || !this.s3Client) {
            this.logger.warn('Skipping S3 upload - AWS not configured');
            return null;
        }

        try {
            const originalName = file.originalname;
            const lastDotIndex = originalName.lastIndexOf('.');
            const baseName = lastDotIndex > 0 ? originalName.substring(0, lastDotIndex) : originalName;
            const extension = lastDotIndex > 0 ? originalName.substring(lastDotIndex) : '';

            let key = await this.getUniqueKey(baseName, extension);
            let buffer = file.buffer;
            let contentType = file.mimetype;

            // Optimize image first
            if (file.mimetype.startsWith('image/')) {
                try {
                    buffer = await this.optimizeImage(file.buffer);
                } catch (optError) {
                    this.logger.warn('Image optimization failed, using original:', optError);
                }

                // Apply watermark if provided
                if (watermark) {
                    try {
                        buffer = await this.applyWatermark(buffer, watermark);
                    } catch (wmError) {
                        this.logger.warn('Failed to apply watermark, proceeding without:', wmError);
                    }
                }
            }

            await this.s3Client.send(
                new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    Body: buffer,
                    ContentType: contentType,
                    ACL: 'public-read',
                }),
            );

            const url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
            this.logger.log(`Property image uploaded successfully: ${url}`);
            return url;
        } catch (error) {
            this.logger.error('Failed to upload property image to S3:', error);
            return null;
        }
    }

    /**
     * Apply watermark to an image buffer
     */
    private async applyWatermark(
        imageBuffer: Buffer,
        watermark: { imageUrl: string; position: string; opacity: number; scale: number }
    ): Promise<Buffer> {
        // Fetch watermark image
        const response = await axios.get(watermark.imageUrl, { responseType: 'arraybuffer' });
        const watermarkBuffer = Buffer.from(response.data);

        // Get base image dimensions
        const baseImage = sharp(imageBuffer);
        const baseMetadata = await baseImage.metadata();
        const baseWidth = baseMetadata.width || 1920;
        const baseHeight = baseMetadata.height || 1080;

        // Calculate watermark size (scale is % of base image width)
        const wmWidth = Math.round(baseWidth * watermark.scale);

        // Resize watermark maintaining aspect ratio
        const resizedWatermark = await sharp(watermarkBuffer)
            .resize(wmWidth, null, { fit: 'inside', withoutEnlargement: false })
            .toBuffer();

        const wmMetadata = await sharp(resizedWatermark).metadata();
        const wmHeight = wmMetadata.height || wmWidth;

        // Calculate position
        let left = 0;
        let top = 0;
        const padding = 20; // Padding from edges

        switch (watermark.position) {
            case 'top-left':
                left = padding;
                top = padding;
                break;
            case 'top-right':
                left = baseWidth - wmWidth - padding;
                top = padding;
                break;
            case 'bottom-left':
                left = padding;
                top = baseHeight - wmHeight - padding;
                break;
            case 'bottom-right':
                left = baseWidth - wmWidth - padding;
                top = baseHeight - wmHeight - padding;
                break;
            case 'center':
                left = Math.round((baseWidth - wmWidth) / 2);
                top = Math.round((baseHeight - wmHeight) / 2);
                break;
            default:
                left = baseWidth - wmWidth - padding;
                top = baseHeight - wmHeight - padding;
        }

        // Ensure coordinates are non-negative
        left = Math.max(0, left);
        top = Math.max(0, top);

        // Apply opacity to watermark
        const watermarkWithOpacity = await sharp(resizedWatermark)
            .ensureAlpha()
            .modulate({ saturation: 1 })
            .composite([{
                input: Buffer.from([255, 255, 255, Math.round(255 * watermark.opacity)]),
                raw: { width: 1, height: 1, channels: 4 },
                tile: true,
                blend: 'dest-in'
            }])
            .toBuffer();

        // Composite watermark onto base image
        return baseImage
            .composite([{
                input: watermarkWithOpacity,
                left,
                top,
            }])
            .jpeg({ quality: 85 })
            .toBuffer();
    }


    /**
     * Generates a unique S3 key by checking for existing files and appending (1), (2), etc. if needed.
     */
    private async getUniqueKey(baseName: string, extension: string): Promise<string> {
        // Sanitize filename: replace spaces with underscores, remove special chars
        const sanitizedBase = baseName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-()]/g, '');

        let key = `${sanitizedBase}${extension}`;
        let counter = 0;

        while (await this.keyExists(key)) {
            counter++;
            key = `${sanitizedBase}(${counter})${extension}`;
        }

        return key;
    }

    /**
     * Fetch metadata (size, mimeType) for a given URL
     */
    async getFileMetadata(url: string): Promise<{ size: number; mimeType: string }> {
        // Default values
        const metadata = { size: 0, mimeType: 'application/octet-stream' };

        try {
            // Check if it's an S3 URL from our bucket
            if (url.includes(this.bucketName) && url.includes('amazonaws.com')) {
                const rawKey = url.split('.amazonaws.com/')[1];
                const key = decodeURIComponent(rawKey);

                if (this.s3Client && key) {
                    try {
                        const response = await this.s3Client.send(new HeadObjectCommand({
                            Bucket: this.bucketName,
                            Key: key,
                        }));
                        metadata.size = response.ContentLength || 0;
                        metadata.mimeType = response.ContentType || 'application/octet-stream';
                        return metadata;
                    } catch (s3Error) {
                        this.logger.warn(`S3 HeadObject failed for key "${key}" (raw: "${rawKey}"): ${s3Error.message}`);
                    }
                }
            }


            // Fallback: Try a HEAD request for external URLs
            // Some servers require User-Agent
            try {
                const response = await axios.head(url, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                const size = parseInt(response.headers['content-length'] || '0', 10);
                const mimeType = response.headers['content-type'] || 'application/octet-stream';

                if (!isNaN(size) && size > 0) metadata.size = size;
                if (mimeType) metadata.mimeType = mimeType;
            } catch (headError) {
                // Retry with GET and Range: bytes=0-0 to just check existence/metadata if HEAD fails (some servers block HEAD)
                try {
                    const response = await axios.get(url, {
                        timeout: 5000,
                        headers: { 'User-Agent': 'Mozilla/5.0', 'Range': 'bytes=0-0' }
                    });
                    const size = parseInt(response.headers['content-range']?.split('/')[1] || '0', 10);
                    // If content-range is missing, might be content-length of full file if range ignored
                    const totalSize = size || parseInt(response.headers['content-length'] || '0', 10);

                    if (!isNaN(totalSize) && totalSize > 0) metadata.size = totalSize;
                    metadata.mimeType = response.headers['content-type'] || metadata.mimeType;
                } catch (getError) {
                    this.logger.warn(`Failed to fetch metadata for external URL ${url}: ${getError.message}`);
                }
            }

            return metadata;
        } catch (error) {
            this.logger.warn(`Unexpected error in getFileMetadata for ${url}: ${error.message}`);
        }
        return metadata;
    }

    /**
     * Checks if a key already exists in the S3 bucket.
     */
    private async keyExists(key: string): Promise<boolean> {
        if (!this.s3Client) return false;

        try {
            await this.s3Client.send(new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            }));
            return true; // Object exists
        } catch (error: any) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false; // Object doesn't exist
            }
            // Log unexpected errors but assume key doesn't exist to avoid blocking uploads
            this.logger.warn(`Error checking S3 key existence for ${key}:`, error);
            return false;
        }
    }

    // New method for on-the-fly optimization of external images
    async getOptimizedImage(imageUrl: string, width: number = 300, quality: number = 20): Promise<Buffer> {
        try {
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            return sharp(response.data)
                .resize(width, null, { // Maintain aspect ratio based on width
                    withoutEnlargement: true
                })
                .jpeg({ quality, mozjpeg: true }) // High compression for thumbnails
                .toBuffer();
        } catch (error) {
            this.logger.error(`Failed to optimize external image: ${imageUrl}`, error);
            throw new Error('Failed to fetch/optimize image');
        }
    }

    async deleteFile(fileUrl: string): Promise<void> {
        if (!this.isConfigured || !this.s3Client) {
            return;
        }

        try {
            // Extract key from URL
            // URL format: https://bucket-name.s3.region.amazonaws.com/key
            const urlParts = fileUrl.split('/');
            const key = urlParts[urlParts.length - 1];

            await this.s3Client.send(
                new DeleteObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                }),
            );
            this.logger.log(`File deleted successfully: ${key}`);
        } catch (error) {
            this.logger.error('Failed to delete file from S3:', error);
        }
    }
    async getS3Usage(): Promise<S3Usage> {
        if (!this.isConfigured || !this.s3Client) {
            console.log('UploadService: S3 Not Configured or Client null');
            return {
                totalSizeBytes: 0,
                totalSizeGB: '0.00',
                categories: { images: 0, videos: 0, audio: 0, documents: 0, archives: 0, fonts: 0, others: 0 }
            };
        }

        let totalSize = 0;
        let objectCount = 0;
        let continuationToken: string | undefined = undefined;
        const categories: S3Usage['categories'] = { images: 0, videos: 0, audio: 0, documents: 0, archives: 0, fonts: 0, others: 0 };

        try {
            console.log(`UploadService: Fetching S3 usage for bucket ${this.bucketName}...`);
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    ContinuationToken: continuationToken,
                });

                const response: ListObjectsV2CommandOutput = await this.s3Client.send(command);

                if (response.Contents) {
                    objectCount += response.Contents.length;
                    response.Contents.forEach((item) => {
                        const size = item.Size || 0;
                        totalSize += size;

                        const ext = item.Key?.split('.').pop()?.toLowerCase();
                        if (!ext) {
                            categories.others += size;
                            return;
                        }

                        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff'].includes(ext)) {
                            categories.images += size;
                        } else if (['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv'].includes(ext)) {
                            categories.videos += size;
                        } else if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
                            categories.audio += size;
                        } else if (['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'rtf'].includes(ext)) {
                            categories.documents += size;
                        } else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
                            categories.archives += size;
                        } else if (['ttf', 'otf', 'woff', 'woff2', 'eot'].includes(ext)) {
                            categories.fonts += size;
                        } else {
                            categories.others += size;
                        }
                    });
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            console.log(`UploadService: S3 Fetch Complete. Count: ${objectCount}, TotalSize: ${totalSize}`);
            return {
                totalSizeBytes: totalSize,
                totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
                categories
            };
        } catch (error) {
            console.error('UploadService: Failed to fetch S3 usage:', error);
            return {
                totalSizeBytes: 0,
                totalSizeGB: '0.00',
                categories: { images: 0, videos: 0, audio: 0, documents: 0, archives: 0, fonts: 0, others: 0 }
            };
        }
    }

    async getS3Files(): Promise<any[]> {
        if (!this.isConfigured || !this.s3Client) return [];

        let continuationToken: string | undefined = undefined;
        const files: any[] = [];
        const region = this.configService.get('AWS_REGION');

        try {
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.bucketName,
                    ContinuationToken: continuationToken,
                });

                const response: ListObjectsV2CommandOutput = await this.s3Client.send(command);

                if (response.Contents) {
                    response.Contents.forEach((item) => {
                        const ext = item.Key?.split('.').pop()?.toLowerCase();
                        files.push({
                            id: item.Key,
                            name: item.Key,
                            size: item.Size || 0,
                            url: `https://${this.bucketName}.s3.${region}.amazonaws.com/${item.Key}`,
                            mimeType: this.getMimeType(ext),
                            updatedAt: item.LastModified,
                            isS3: true
                        });
                    });
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            return files;
        } catch (error) {
            console.error('UploadService: Failed to fetch S3 files:', error);
            return [];
        }
    }

    private getMimeType(ext: string | undefined): string {
        if (!ext) return 'application/octet-stream';
        const map: { [key: string]: string } = {
            // Images
            jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
            webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp',
            tiff: 'image/tiff', tif: 'image/tiff', heic: 'image/heic', heif: 'image/heif',
            ico: 'image/x-icon', avif: 'image/avif',
            // Videos
            mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
            mkv: 'video/x-matroska', webm: 'video/webm', flv: 'video/x-flv', wmv: 'video/x-ms-wmv',
            // Audio
            mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
            flac: 'audio/flac', aac: 'audio/aac',
            // Documents
            pdf: 'application/pdf',
            doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf',
            // Archives
            zip: 'application/zip', rar: 'application/x-rar-compressed', '7z': 'application/x-7z-compressed',
            tar: 'application/x-tar', gz: 'application/gzip',
        };
        return map[ext.toLowerCase()] || 'application/octet-stream';
    }
}
