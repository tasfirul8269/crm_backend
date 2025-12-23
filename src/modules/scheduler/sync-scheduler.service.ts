import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IntegrationsService } from '../integrations/integrations.service';
import { PropertiesService } from '../properties/properties.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';

@Injectable()
export class SyncSchedulerService {
    private readonly logger = new Logger(SyncSchedulerService.name);

    constructor(
        private integrationsService: IntegrationsService,
        private propertiesService: PropertiesService,
        private prisma: PrismaService,
        private agentsService: AgentsService,
    ) { }

    @Cron(CronExpression.EVERY_MINUTE)
    async handleCron() {
        // 1. Get System Timezone
        const config = await this.integrationsService.findOne('system_settings');
        const timeZone = config?.credentials ? (config.credentials as any).timeZone : 'UTC';

        // 2. Get Current Time in Target Timezone
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(now);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

        this.logger.debug(`Checking Schedule. Target TZ: ${timeZone}. Time: ${hour}:${minute}`);

        // Logic: Every 6 hours starting 12:00 AM (00:00)
        // Times: 00:00, 06:00, 12:00, 18:00

        // Warning: 15 mins before (23:45, 05:45, 11:45, 17:45)
        // Check if next hour is a sync hour (0, 6, 12, 18)
        const nextHour = (hour + 1) % 24;
        const isSyncNextHour = nextHour % 6 === 0;

        if (minute === 45 && isSyncNextHour) {
            await this.createNotification(
                'WARNING',
                'Auto Sync Pending',
                `Automated synchronization will start in 15 minutes (at ${nextHour.toString().padStart(2, '0')}:00).`
            );
        }

        // Execution: On the hour
        if (minute === 0 && hour % 6 === 0) {
            await this.runSync();
        }
    }

    private async runSync() {
        this.logger.log('Starting Scheduled Sync...');
        await this.createNotification('INFO', 'Auto Sync Started', 'The automated synchronization process has started.');

        try {
            const result = await this.propertiesService.syncAllToPropertyFinder();
            const message = `Sync completed. Total: ${result.total}, Synced: ${result.synced}, Failed: ${result.failed}`;

            await this.createNotification('SUCCESS', 'Auto Sync Completed', message);
            this.logger.log(message);

            // Sync Agents
            this.logger.log('Starting Agent Sync...');
            const agentSyncResult = await this.agentsService.syncFromPropertyFinder();
            const agentMessage = `Agent Sync completed. ${agentSyncResult.message}`;
            this.logger.log(agentMessage);
            await this.createNotification('SUCCESS', 'Agent Sync Completed', agentMessage);

        } catch (error) {
            this.logger.error('Scheduled Sync Failed', error);
            await this.createNotification('ERROR', 'Auto Sync Failed', `An error occurred during auto sync: ${error.message}`);
        }
    }

    private async createNotification(type: string, title: string, message: string) {
        // Cast to any to avoid build errors if Prisma Client isn't regenerated yet
        const prisma = this.prisma as any;
        if (prisma.notification) {
            await prisma.notification.create({
                data: {
                    type,
                    title,
                    message,
                    isRead: false
                }
            });
        } else {
            this.logger.warn(`Notification table not found in Prisma Client. Message: ${title} - ${message}`);
        }
    }
}
