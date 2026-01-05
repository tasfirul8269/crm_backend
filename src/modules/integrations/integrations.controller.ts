
import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';

@Controller('integrations')
export class IntegrationsController {
    constructor(private readonly integrationsService: IntegrationsService) { }

    @Get()
    findAll() {
        return this.integrationsService.findAll();
    }

    // Public endpoint - returns only the Google Maps API key (safe for frontend)
    @Get('google-maps-key')
    async getGoogleMapsKey() {
        const credentials = await this.integrationsService.getCredentials('google_maps');
        return { apiKey: credentials?.apiKey || null };
    }

    @Get('notifications')
    getNotifications() {
        return this.integrationsService.getNotifications();
    }

    @Post('notifications/read')
    markRead() {
        return this.integrationsService.markNotificationsRead();
    }

    @Post('notifications/test')
    createTest() {
        return this.integrationsService.createTestNotification();
    }

    @Post(':provider')
    update(@Param('provider') provider: string, @Body() body: { isEnabled?: boolean; credentials?: any }) {
        return this.integrationsService.update(provider, body);
    }

    @Delete(':provider')
    remove(@Param('provider') provider: string) {
        return this.integrationsService.remove(provider);
    }
}
