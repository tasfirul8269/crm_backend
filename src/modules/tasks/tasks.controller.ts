import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GetUser } from '../../common/decorators/get-user.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasksService: TasksService) { }

    @Post()
    create(@Body() createTaskDto: CreateTaskDto, @GetUser() user?: any) {
        return this.tasksService.create(createTaskDto, user?.id);
    }

    @Get('categories')
    getCategories() {
        return this.tasksService.getCategories();
    }

    @Get('indicators')
    getTaskIndicators(@Query('start') start: string, @Query('end') end: string, @GetUser() user?: any) {
        return this.tasksService.getTaskIndicators(start, end, user?.id);
    }

    @Get()
    findAll(@Query('date') date?: string, @GetUser() user?: any) {
        return this.tasksService.findAll(date, user?.id);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.tasksService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
        return this.tasksService.update(id, updateTaskDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.tasksService.remove(id);
    }
}
