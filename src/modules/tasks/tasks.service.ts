import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
    constructor(private readonly prisma: PrismaService) { }

    async create(createTaskDto: CreateTaskDto, userId?: string) {
        // @ts-ignore Prisma client includes `task` after `npx prisma generate`
        return this.prisma.task.create({
            data: {
                ...createTaskDto,
                date: new Date(createTaskDto.date),
                createdBy: userId,
            },
        });
    }

    async findAll(date?: string, userId?: string) {
        const where: any = {};

        if (date) {
            // Filter tasks for a specific date (start of day to end of day)
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);
            const end = new Date(date);
            end.setHours(23, 59, 59, 999);
            where.date = { gte: start, lte: end };
        }

        if (userId) {
            where.createdBy = userId;
        }

        // @ts-ignore Prisma client includes `task` after `npx prisma generate`
        return this.prisma.task.findMany({
            where,
            orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });
    }

    async findOne(id: string) {
        // @ts-ignore
        const task = await this.prisma.task.findUnique({ where: { id } });
        if (!task) {
            throw new NotFoundException('Task not found');
        }
        return task;
    }

    async update(id: string, updateTaskDto: UpdateTaskDto) {
        await this.findOne(id); // Ensure it exists

        const data: any = { ...updateTaskDto };
        if (updateTaskDto.date) {
            data.date = new Date(updateTaskDto.date);
        }

        // @ts-ignore
        return this.prisma.task.update({
            where: { id },
            data,
        });
    }

    async remove(id: string) {
        await this.findOne(id);
        // @ts-ignore
        return this.prisma.task.delete({ where: { id } });
    }

    async getCategories() {
        // @ts-ignore
        const tasks = await this.prisma.task.findMany({
            where: { category: { not: null } },
            select: { category: true },
            distinct: ['category'],
        });
        return tasks.map((t: any) => t.category).filter(Boolean);
    }

    async getTaskIndicators(start: string, end: string, userId?: string) {
        const where: any = {
            date: {
                gte: new Date(start),
                lte: new Date(end),
            },
        };
        if (userId) {
            where.createdBy = userId;
        }

        // @ts-ignore
        const tasks = await this.prisma.task.findMany({
            where,
            select: { date: true },
        });

        // Return unique dates using local timezone (matching findAll's setHours logic)
        const dates = tasks.map((t: any) => {
            const d: Date = t.date;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        });
        return [...new Set(dates)];
    }
}
