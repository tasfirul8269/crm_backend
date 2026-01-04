import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Param,
    Body,
    UseInterceptors,
    UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WatermarksService } from './watermarks.service';
import { CreateWatermarkDto, UpdateWatermarkDto } from './dto/watermark.dto';

@Controller('watermarks')
export class WatermarksController {
    constructor(private readonly watermarksService: WatermarksService) { }

    @Get()
    findAll() {
        return this.watermarksService.findAll();
    }

    @Get('active')
    getActive() {
        return this.watermarksService.getActive();
    }

    @Post()
    @UseInterceptors(FileInterceptor('image'))
    create(
        @Body() dto: CreateWatermarkDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.watermarksService.create(dto, file);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateWatermarkDto) {
        return this.watermarksService.update(id, dto);
    }

    @Patch(':id/activate')
    activate(@Param('id') id: string) {
        return this.watermarksService.activate(id);
    }

    @Post('deactivate-all')
    deactivateAll() {
        return this.watermarksService.deactivateAll();
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.watermarksService.delete(id);
    }
}
