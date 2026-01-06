import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException, Delete, Body, Get, Query, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import type { Response } from 'express';

@Controller('upload')
export class UploadController {
    // Audio proxy endpoint added for CORS bypass
    constructor(private readonly uploadService: UploadService) { }

    @Post()
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded');
        }

        const url = await this.uploadService.uploadFile(file);
        if (!url) {
            throw new BadRequestException('File upload failed');
        }

        return { url };
    }

    @Delete('delete')
    async deleteFile(@Body('url') url: string) {
        if (!url) {
            throw new BadRequestException('URL is required');
        }
        await this.uploadService.deleteFile(url);
        return { message: 'File deleted successfully' };
    }

    @Get('optimize')
    async getOptimizedImage(
        @Query('url') url: string,
        @Query('w') width: string,
        @Query('q') quality: string,
        @Res() res: Response
    ) {
        if (!url) {
            throw new BadRequestException('URL is required');
        }

        const w = width ? parseInt(width) : 300;
        const q = quality ? parseInt(quality) : 20;

        try {
            const buffer = await this.uploadService.getOptimizedImage(url, w, q);

            res.set({
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
            });

            res.send(buffer);
        } catch (error) {
            // Fallback: Redirect to original image if optimization fails
            res.redirect(url);
        }
    }

    @Get('audio')
    async proxyAudio(
        @Query('url') url: string,
        @Res() res: Response
    ) {
        if (!url) {
            throw new BadRequestException('URL is required');
        }

        console.log('Audio proxy request for URL:', url);

        try {
            // Fetch the audio file from S3
            const response = await fetch(url);

            console.log('S3 response status:', response.status, response.statusText);

            if (!response.ok) {
                console.error('S3 fetch failed:', response.status, response.statusText);
                throw new BadRequestException(`Failed to fetch audio file: ${response.status}`);
            }

            const contentType = response.headers.get('content-type') || 'audio/mpeg';
            const buffer = Buffer.from(await response.arrayBuffer());

            console.log('Audio file fetched successfully, size:', buffer.length, 'type:', contentType);

            res.set({
                'Content-Type': contentType,
                'Content-Length': buffer.length.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400', // Cache for 1 day
            });

            res.send(buffer);
        } catch (error) {
            console.error('Audio proxy error:', error.message || error);
            throw new BadRequestException('Failed to proxy audio file: ' + (error.message || 'Unknown error'));
        }
    }
}
