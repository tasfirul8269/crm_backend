import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PortalSyncModule } from '@frooxi-labs/portal-sync';
import { CrmPortalMapper } from './crm-portal.mapper';
import { PortalInitializerService } from './portal-initializer.service';
import { IntegrationsModule } from '../integrations/integrations.module';

/**
 * Portals Module
 * Configures the Portal Sync library with:
 * - CRM-specific property mapper
 * - Auto-credential configuration from DB
 * - Event telemetry wiring to FrooxiEventBus
 */
@Module({
    imports: [
        ConfigModule,
        IntegrationsModule,
        PortalSyncModule.register({
            mapper: { provide: 'FROOXI_PORTAL_MAPPER', useClass: CrmPortalMapper },
        }),
    ],
    providers: [
        CrmPortalMapper,
        PortalInitializerService,
    ],
    exports: [PortalSyncModule, CrmPortalMapper],
})
export class PortalsModule { }
