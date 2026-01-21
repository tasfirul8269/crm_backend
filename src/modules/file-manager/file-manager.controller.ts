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

    @Get('item-path')
    async getItemPath(@Query('id') id: string, @Query('type') type: 'file' | 'folder') {
        return { path: await this.fileManagerService.getItemPath(id, type) };
    }

    @Post('migrate')
    async migrateData() {
        return this.fileManagerService.migrateAllData();
    }

    @Get('stats')
    async getStats() {
        return this.fileManagerService.getStorageStats();
    }

    @Get('category/:category')
    async getCategoryFiles(@Param('category') category: string) {
        return this.fileManagerService.getFilesByCategory(category);
    }

    @Get('recent')
    async getRecent() {
        return this.fileManagerService.getRecentFiles();
    }

    @Get('deleted')
    async getDeleted() {
        return this.fileManagerService.getDeletedItems();
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

    @Post('file/:id/restore')
    async restoreFile(@Param('id') id: string) {
        return this.fileManagerService.restoreFile(id);
    }

    @Post('folder/:id/restore')
    async restoreFolder(@Param('id') id: string) {
        return this.fileManagerService.restoreFolder(id);
    }

    @Post('folder/:id/rename')
    async renameFolder(@Param('id') id: string, @Body('name') name: string) {
        return this.fileManagerService.renameFolder(id, name);
    }

    @Post('file/:id/rename')
    async renameFile(@Param('id') id: string, @Body('name') name: string) {
        return this.fileManagerService.renameFile(id, name);
    }

    @Post('folder/:id/move')
    async moveFolder(@Param('id') id: string, @Body('targetParentId') targetParentId: string | null) {
        return this.fileManagerService.moveFolder(id, targetParentId);
    }

    @Post('file/:id/move')
    async moveFile(@Param('id') id: string, @Body('targetFolderId') targetFolderId: string | null) {
        return this.fileManagerService.moveFile(id, targetFolderId);
    }

    @Post('folder/:id/copy')
    async copyFolder(@Param('id') id: string, @Body('targetParentId') targetParentId: string | null) {
        return this.fileManagerService.copyFolder(id, targetParentId);
    }

    @Post('folder/:id/color')
    async updateFolderColor(@Param('id') id: string, @Body('color') color: string) {
        return this.fileManagerService.updateFolderColor(id, color);
    }

    @Post('file/:id/copy')
    async copyFile(@Param('id') id: string, @Body('targetFolderId') targetFolderId: string | null) {
        return this.fileManagerService.copyFile(id, targetFolderId);
    }

    @Delete('folder/:id')
    async deleteFolder(@Param('id') id: string) {
        return this.fileManagerService.deleteFolder(id);
    }

    @Delete('file/:id')
    async deleteFile(@Param('id') id: string) {
        return this.fileManagerService.deleteFile(id);
    }

    @Delete('folder/:id/permanent')
    async permanentlyDeleteFolder(@Param('id') id: string) {
        return this.fileManagerService.permanentlyDeleteFolder(id);
    }

    @Delete('file/:id/permanent')
    async permanentlyDeleteFile(@Param('id') id: string) {
        return this.fileManagerService.permanentlyDeleteFile(id);
    }

    @Get('sync-sizes')
    async syncSizes() {
        return this.fileManagerService.syncFileSizes();
    }
}
