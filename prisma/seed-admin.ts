import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin1234', 10);

    const admin = await prisma.user.upsert({
        where: { email: 'admin@gmail.com' },
        update: {
            role: Role.ADMIN,
            permissions: ['*'],
        },
        create: {
            fullName: 'Admin',
            username: 'admin',
            email: 'admin@gmail.com',
            password: hashedPassword,
            role: Role.ADMIN,
            permissions: ['*'],
        },
    });

    console.log('Admin user created/updated:', admin);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
