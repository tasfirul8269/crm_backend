import { Injectable, OnModuleInit, Logger, Optional, Inject } from '@nestjs/common';
import { PortalSyncService } from '@frooxi-labs/portal-sync';
import { FrooxiEventBus } from '@frooxi-labs/core';
import { IntegrationsService } from '../integrations/integrations.service';
import { ConfigService } from '@nestjs/config';

/**
 * Portal Initializer Service
 * Auto-configures portal drivers with credentials on app startup.
 * Wires event telemetry to FrooxiEventBus (if available).
 */
@Injectable()
export class PortalInitializerService implements OnModuleInit {
    private readonly logger = new Logger(PortalInitializerService.name);

    constructor(
        private readonly portalSync: PortalSyncService,
        private readonly integrationsService: IntegrationsService,
        private readonly configService: ConfigService,
        @Optional() @Inject('FROOXI_EVENT_BUS') private readonly eventBus?: FrooxiEventBus,
    ) { }

    async onModuleInit() {
        await this.configurePropertyFinder();
        this.logger.log('Portal drivers initialized successfully.');
    }

    private async configurePropertyFinder(): Promise<void> {
        try {
            // Try to get credentials from database first
            let apiKey: string | undefined;
            let apiSecret: string | undefined;

            const dbCreds = await this.integrationsService.getCredentials('property_finder');
            if (dbCreds && typeof dbCreds === 'object') {
                const creds = dbCreds as any;
                apiKey = creds.apiKey;
                apiSecret = creds.apiSecret;
            }

            // Fallback to environment variables
            if (!apiKey) apiKey = this.configService.get<string>('PF_API_KEY');
            if (!apiSecret) apiSecret = this.configService.get<string>('PF_API_SECRET');

            if (!apiKey || !apiSecret) {
                this.logger.warn('Property Finder credentials not configured. Driver will be disabled.');
                return;
            }

            // Configure the driver with credentials and event emitter
            await this.portalSync.configureDriver('propertyfinder', {
                clientId: apiKey,
                clientSecret: apiSecret,
                baseUrl: 'https://atlas.propertyfinder.com/v1',
                authUrl: 'https://atlas.propertyfinder.com/v1/auth/token',
                // Wire telemetry to FrooxiEventBus (if available)
                eventEmitter: this.eventBus
                    ? (event: string, payload: any) => this.eventBus!.emit(event, payload)
                    : undefined,
            });

            this.logger.log('PropertyFinder driver configured successfully.');
        } catch (error: any) {
            this.logger.error('Failed to configure PropertyFinder driver', error.message);
        }
    }
}
