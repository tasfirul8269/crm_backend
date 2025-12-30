import { Controller, Get, Post, Body, UploadedFile, UseInterceptors, Query, Param, Delete, UseGuards } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileManagerService } from './file-manager.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('file-manager')
@UseGuards(JwtAuthGuard)
export class FileManagerController {
    constructor(private readonly fileManagerService: FileManagerService) { }

    @Get('contents')
    async getContents(@Query('folderId') folderId?: string) {
        return this.fileManagerService.getFolderContents(folderId);
    }

    @Post('migrate')
    async migrateData() {
        return this.fileManagerService.migrateAllData();
    }

    @Post('folder')
    async createFolder(
        @Body('name') name: string,
        @Body('parentId') parentId?: string
    ) {
        return this.fileManagerService.createFolder(name, parentId);
    }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('folderId') folderId?: string
    ) {
        return this.fileManagerService.uploadFile(file, folderId);
    }

    @Delete('folder/:id')
    async deleteFolder(@Param('id') id: string) {
        return this.fileManagerService.deleteFolder(id);
    }

    @Delete('file/:id')
    async deleteFile(@Param('id') id: string) {
        return this.fileManagerService.deleteFile(id);
    }
}
