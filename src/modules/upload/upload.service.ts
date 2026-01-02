import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, ListObjectsV2CommandOutput, HeadObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import axios from 'axios';

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
    private bucketName: string;
    private region: string;
    private readonly logger = new Logger(UploadService.name);
    private isConfigured = false;

    constructor(private configService: ConfigService) {
        const region = this.configService.get<string>('AWS_REGION') || '';
        const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
        const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';
        const bucketName = this.configService.get<string>('AWS_BUCKET_NAME') || '';

        if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
            this.logger.warn('AWS S3 credentials not configured. Avatar uploads will be skipped.');
            this.isConfigured = false;
            return;
        }

        try {
            this.s3Client = new S3Client({
                region,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                },
            });
            this.bucketName = bucketName;
            this.region = region;
            this.isConfigured = true;
            this.logger.log('AWS S3 client initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize S3 client:', error);
            this.isConfigured = false;
        }
    }

    async uploadFile(file: Express.Multer.File): Promise<string | null> {
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
        return sharp(buffer)
            .resize(1920, 1080, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 80, mozjpeg: true }) // Compress efficiently
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
