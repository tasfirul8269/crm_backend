
import { PrismaClient } from '@prisma/client';
import { IntegrationsService } from '../src/modules/integrations/integrations.service';
import { isEncrypted } from '../src/common/utils/crypto.util';

async function main() {
    const prisma = new PrismaClient();
    console.log('1. Initialized Prisma Client');

    // Instantiate Service manually (dependency injection mock)
    // We cast to any because IntegrationsService expects PrismaService which extends PrismaClient
    const integrationsService = new IntegrationsService(prisma as any);
    console.log('2. Initialized IntegrationsService');

    const TEST_PROVIDER = 'verification_test_provider_' + Date.now();
    const TEST_API_KEY = 'secret-api-key-12345';
    const TEST_SECRET_KEY = 'super-secret-key-99999';

    try {
        console.log(`\n--- STEP 3: Saving Credentials via Service ---`);
        console.log(`Input API Key: ${TEST_API_KEY}`);
        console.log(`Input Secret Key: ${TEST_SECRET_KEY}`);

        // 3. Save using the Service (which should encrypt)
        await integrationsService.update(TEST_PROVIDER, {
            isEnabled: true,
            credentials: {
                apiKey: TEST_API_KEY,
                apiSecret: TEST_SECRET_KEY,
                otherField: 'not-encrypted'
            }
        });
        console.log('Saved successfully.');

        console.log(`\n--- STEP 4: Inspecting Database Directly ---`);
        // 4. Read directly from DB (bypassing service decryption)
        const rawRecord = await prisma.integrationConfig.findUnique({
            where: { provider: TEST_PROVIDER }
        });

        if (!rawRecord) {
            throw new Error('Failed to save record!');
        }

        const rawCreds = rawRecord.credentials as any;
        console.log('Raw DB Record Credentials:', JSON.stringify(rawCreds, null, 2));

        // Verification Logic
        const storedApiKey = rawCreds.apiKey;
        const storedSecret = rawCreds.apiSecret;

        // Verify Key is Encrypted
        let allPassed = true;

        if (storedApiKey === TEST_API_KEY) {
            console.error('❌ FAIL: API Key is stored in PLAIN TEXT!');
            allPassed = false;
        } else if (isEncrypted(storedApiKey)) {
            console.log('✅ SUCCESS: API Key is stored ENCRYPTED.');
            console.log(`   (Original: "${TEST_API_KEY}" -> Stored: "${storedApiKey.substring(0, 20)}...")`);
        } else {
            console.warn('⚠️ WARNING: API Key is changed but does not look like standard encryption?');
            allPassed = false;
        }

        // Verify Secret is Encrypted
        if (storedSecret === TEST_SECRET_KEY) {
            console.error('❌ FAIL: Secret Key is stored in PLAIN TEXT!');
            allPassed = false;
        } else if (isEncrypted(storedSecret)) {
            console.log('✅ SUCCESS: Secret Key is stored ENCRYPTED.');
        }

        console.log(`\n--- STEP 5: Retrieving via Service ---`);
        // 5. Retrieve via Service (should decrypt)
        const decryptedCreds = await integrationsService.getCredentials(TEST_PROVIDER);
        console.log('Retrieved Credentials:', JSON.stringify(decryptedCreds, null, 2));

        if (decryptedCreds.apiKey === TEST_API_KEY && decryptedCreds.apiSecret === TEST_SECRET_KEY) {
            console.log('✅ SUCCESS: Service correctly decrypts credentials on retrieval.');
        } else {
            console.error('❌ FAIL: Decrypted credentials do not match original!');
            allPassed = false;
        }

        if (allPassed) {
            console.log('\n✨✨✨ OVERALL RESULT: VERIFICATION PASSED ✨✨✨');
            console.log('Property Finder encryption is working end-to-end.');
        } else {
            console.log('\n🛑🛑🛑 OVERALL RESULT: VERIFICATION FAILED 🛑🛑🛑');
        }

    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        // Cleanup
        console.log(`\n--- Cleanup ---`);
        await prisma.integrationConfig.delete({
            where: { provider: TEST_PROVIDER }
        }).catch(() => { });
        console.log('Test record deleted.');
        await prisma.$disconnect();
    }
}

main();
