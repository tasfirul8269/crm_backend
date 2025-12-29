import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import * as bcrypt from 'bcrypt';
import { PropertyFinderService } from '../property-finder/property-finder.service';
import { getCode } from 'country-list';

import { ActivityService } from '../activity/activity.service';

@Injectable()
export class AgentsService {
    private readonly logger = new Logger(AgentsService.name);

    constructor(
        private prisma: PrismaService,
        private propertyFinderService: PropertyFinderService,
        private activityService: ActivityService,
    ) { }

    async create(createAgentDto: CreateAgentDto, photoUrl?: string, vcardUrl?: string, licenseDocumentUrl?: string, userId?: string, ipAddress?: string, location?: string) {
        // Hash password
        const hashedPassword = await bcrypt.hash(createAgentDto.password, 10);

        const agentData: any = {
            ...createAgentDto,
            password: hashedPassword,
            photoUrl,
            vcardUrl,
            licenseDocumentUrl,
        };

        // Convert date strings to Date objects
        if (createAgentDto.birthdate) {
            agentData.birthdate = new Date(createAgentDto.birthdate);
        }
        if (createAgentDto.joinedDate) {
            agentData.joinedDate = new Date(createAgentDto.joinedDate);
        }
        if (createAgentDto.visaExpiryDate) {
            agentData.visaExpiryDate = new Date(createAgentDto.visaExpiryDate);
        }

        // Convert experienceSince to integer if provided
        if (createAgentDto.experienceSince) {
            agentData.experienceSince = parseInt(String(createAgentDto.experienceSince), 10);
        }

        const createdAgent = await this.prisma.agent.create({
            data: agentData,
        });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Created new Agent: ${createdAgent.name}`,
                ipAddress,
                location,
            });
        }

        // Sync with Property Finder
        try {
            // Helper function to convert language names to Property Finder IDs
            const convertLanguagesToIds = (languages: string[] | null | undefined): number[] => {
                if (!languages || languages.length === 0) return [];

                const languageMap: Record<string, number> = {
                    'english': 1, 'arabic': 2, 'french': 3, 'polish': 4, 'german': 5,
                    'russian': 6, 'hindi': 7, 'urdu': 8, 'croatian': 9, 'spanish': 10,
                    'persian': 11, 'farsi': 11, 'greek': 12, 'tagalog': 13, 'bengali': 14,
                    'tamil': 15, 'malayalam': 16, 'other': 17, 'kyrgyz': 18, 'uzbek': 19,
                    'kazakh': 20, 'mandarin': 21, 'italian': 22, 'portuguese': 23, 'dutch': 24,
                    'hungarian': 25, 'azerbaijani': 26, 'turkish': 27, 'memon': 28, 'gujarati': 29,
                    'ukrainian': 30, 'bulgarian': 32, 'swedish': 33, 'romanian': 34, 'afrikaans': 35,
                    'punjabi': 36, 'danish': 37, 'serbian': 38, 'norwegian': 39, 'cantonese': 40,
                    'bahasa melayu': 41, 'malay': 41, 'shona': 42, 'pashto': 43, 'albanian': 44,
                    'amharic': 45, 'baluchi': 46, 'belarusian': 47, 'berber': 48, 'catalan': 49,
                    'czech': 50, 'finnish': 51, 'japanese': 52, 'javanese': 53, 'kannada': 54,
                    'korean': 55, 'kurdi': 56, 'latvian': 57, 'sinhalese': 59, 'slovak': 60,
                    'slovene': 61, 'somali': 62, 'sudanese': 63, 'swahili': 64, 'telugu': 65,
                    'thai': 66, 'macedonian': 67, 'lithuanian': 68, 'armenian': 69, 'sindhi': 70,
                    'chinese': 21, // Map Chinese to Mandarin
                };

                return languages
                    .map(lang => {
                        const normalized = lang.trim().toLowerCase();
                        return languageMap[normalized] || null;
                    })
                    .filter((id): id is number => id !== null);
            };

            // Map CRM Agent model to Property Finder structure
            const nameParts = createdAgent.name.split(' ');
            const firstName = nameParts[0] || 'Agent';
            const lastName = nameParts.slice(1).join(' ') || '.';

            const pfData = {
                firstName,
                lastName,
                email: createdAgent.email,
                mobile: createdAgent.phone,
                whatsapp: createdAgent.whatsapp || createdAgent.phone,
                phoneSecondary: createdAgent.phoneSecondary || undefined,
                position: createdAgent.position,
                about: createdAgent.about || undefined,
                languages: convertLanguagesToIds(createdAgent.languages),
                nationality: createdAgent.nationality ? (getCode(createdAgent.nationality) || undefined) : undefined,
                imageUrl: photoUrl || undefined,
                linkedinAddress: createdAgent.linkedinAddress || undefined,
                experienceSince: createdAgent.experienceSince || undefined,
            };

            const pfResponse = await this.propertyFinderService.createAgent(pfData);

            // Update Agent with PF IDs
            if (pfResponse && pfResponse.id) {
                await this.prisma.agent.update({
                    where: { id: createdAgent.id },
                    data: {
                        pfUserId: String(pfResponse.id),
                        pfPublicProfileId: pfResponse.publicProfile?.id ? String(pfResponse.publicProfile.id) : undefined
                    }
                });
            }
        } catch (error) {
            this.logger.error('Failed to sync new agent to Property Finder:', error.response?.data || error.message);
            // Don't fail the CRM creation, just log the error
        }

        return createdAgent;
    }

    /**
     * Get top agents ranked by number of sold/rented properties
     * Returns agents with their sold and rented property counts
     */
    async getTopAgents(limit: number = 10) {
        // Get properties that are SOLD or RENTED and have an assigned agent
        const properties = await this.prisma.property.findMany({
            where: {
                status: { in: ['SOLD', 'RENTED'] },
                assignedAgentId: { not: null },
            },
            select: {
                assignedAgentId: true,
                status: true,
            },
        });

        // Count sold and rented per agent
        const agentStatsMap = new Map<string, { soldCount: number; rentedCount: number }>();

        for (const prop of properties) {
            if (!prop.assignedAgentId) continue;

            const current = agentStatsMap.get(prop.assignedAgentId) || { soldCount: 0, rentedCount: 0 };
            if (prop.status === 'SOLD') {
                current.soldCount++;
            } else if (prop.status === 'RENTED') {
                current.rentedCount++;
            }
            agentStatsMap.set(prop.assignedAgentId, current);
        }

        // Get agent IDs sorted by total deals (sold + rented)
        const sortedAgentIds = Array.from(agentStatsMap.entries())
            .map(([agentId, stats]) => ({
                agentId,
                ...stats,
                totalDeals: stats.soldCount + stats.rentedCount,
            }))
            .sort((a, b) => b.totalDeals - a.totalDeals)
            .slice(0, limit);

        // If no agents have sold/rented properties, return empty array
        if (sortedAgentIds.length === 0) {
            return [];
        }

        // Fetch agent details
        const agents = await this.prisma.agent.findMany({
            where: {
                id: { in: sortedAgentIds.map(a => a.agentId) },
            },
            select: {
                id: true,
                name: true,
                position: true,
                photoUrl: true,
            },
        });

        // Merge agent details with stats, maintaining sort order
        const result = sortedAgentIds.map(stat => {
            const agent = agents.find(a => a.id === stat.agentId);
            return {
                id: stat.agentId,
                name: agent?.name || 'Unknown',
                position: agent?.position || '',
                photoUrl: agent?.photoUrl || null,
                soldCount: stat.soldCount,
                rentedCount: stat.rentedCount,
                totalDeals: stat.totalDeals,
            };
        });

        return result;
    }

    async findAll(search?: string) {
        const where = search
            ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { username: { contains: search, mode: 'insensitive' as const } },
                    { department: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {};

        return this.prisma.agent.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findByArea(area: string) {
        if (!area) {
            return [];
        }

        // Trim the search term to handle extra spaces
        const searchTerm = area.trim().toLowerCase();
        console.log('[AgentsService] Searching for area:', area, '→ trimmed:', searchTerm);

        // Find agents where any of their expert areas contains the search term (case-insensitive)
        const agents = await this.prisma.agent.findMany({
            where: {
                isActive: true
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log('[AgentsService] Active agents found:', agents.length);
        agents.forEach(a => console.log(`  → ${a.name}: areas =`, a.areasExpertIn));

        // Filter in-memory for partial, case-insensitive matching
        // Also trim expert areas to handle "Dhaka, Joypurhat" format with spaces
        const matched = agents.filter(agent =>
            agent.areasExpertIn.some(expertArea =>
                expertArea.trim().toLowerCase().includes(searchTerm)
            )
        );

        console.log('[AgentsService] Matched agents:', matched.length);
        return matched;
    }

    async findOne(id: string) {
        const agent = await this.prisma.agent.findUnique({
            where: { id },
        });

        if (!agent) {
            throw new NotFoundException(`Agent with ID ${id} not found`);
        }

        // Fetch counts
        const [assignedPropertiesCount, projectExpertCount, offPlanProperties] = await Promise.all([
            // Standard properties assigned to agent
            this.prisma.property.count({
                where: { assignedAgentId: id }
            }),
            // Off-plan properties where agent is project expert
            this.prisma.offPlanProperty.count({
                where: {
                    projectExperts: {
                        has: id
                    }
                }
            }),
            // Fetch off-plan to filter area experts
            this.prisma.offPlanProperty.findMany({
                select: {
                    areaExperts: true
                }
            })
        ]);

        // Filter area experts in memory
        let areaExpertCount = 0;
        offPlanProperties.forEach(prop => {
            const experts = prop.areaExperts as Record<string, string[]>;
            if (experts) {
                const isExpert = Object.values(experts).some(agentIds =>
                    Array.isArray(agentIds) && agentIds.includes(id)
                );
                if (isExpert) areaExpertCount++;
            }
        });

        return {
            ...agent,
            _count: {
                properties: assignedPropertiesCount,
                offPlanProjectExpert: projectExpertCount,
                offPlanAreaExpert: areaExpertCount,
                totalAssigned: assignedPropertiesCount + projectExpertCount + areaExpertCount
            }
        };
    }

    async update(id: string, updateAgentDto: UpdateAgentDto, photoUrl?: string, vcardUrl?: string, licenseDocumentUrl?: string, userId?: string, ipAddress?: string, location?: string) {
        const agent = await this.findOne(id); // Check if exists

        const updateData: any = { ...updateAgentDto };

        // Hash password if provided
        if (updateAgentDto.password) {
            updateData.password = await bcrypt.hash(updateAgentDto.password, 10);
        }

        if (photoUrl) {
            updateData.photoUrl = photoUrl;
        }
        if (vcardUrl) {
            updateData.vcardUrl = vcardUrl;
        }
        if (licenseDocumentUrl) {
            updateData.licenseDocumentUrl = licenseDocumentUrl;
        }

        // Convert date strings to Date objects
        if (updateAgentDto.birthdate) {
            updateData.birthdate = new Date(updateAgentDto.birthdate);
        }
        if (updateAgentDto.joinedDate) {
            updateData.joinedDate = new Date(updateAgentDto.joinedDate);
        }
        if (updateAgentDto.visaExpiryDate) {
            updateData.visaExpiryDate = new Date(updateAgentDto.visaExpiryDate);
        }

        // Convert experienceSince to integer if provided
        if (updateAgentDto.experienceSince) {
            updateData.experienceSince = parseInt(String(updateAgentDto.experienceSince), 10);
        }

        // Filter out empty strings for optional fields (convert to null)
        if (updateData.phoneSecondary === '') updateData.phoneSecondary = null;
        if (updateData.linkedinAddress === '') updateData.linkedinAddress = null;
        if (updateData.whatsapp === '') updateData.whatsapp = null;
        if (updateData.address === '') updateData.address = null;
        if (updateData.nationality === '') updateData.nationality = null;
        if (updateData.about === '') updateData.about = null;

        console.log('Updating agent with data:', {
            id,
            phoneSecondary: updateData.phoneSecondary,
            linkedinAddress: updateData.linkedinAddress,
            experienceSince: updateData.experienceSince,
        });

        const updatedAgent = await this.prisma.agent.update({
            where: { id },
            data: updateData,
        });

        // Sync with Property Finder
        if (agent.pfUserId || agent.pfPublicProfileId) {
            try {
                // Map updates
                const pfUpdates: any = {};
                if (updateAgentDto.name) {
                    pfUpdates.firstName = updateAgentDto.name.split(' ')[0];
                    pfUpdates.lastName = updateAgentDto.name.split(' ').slice(1).join(' ') || '.';
                }
                if (updateAgentDto.email) pfUpdates.email = updateAgentDto.email;
                if (updateAgentDto.phone) pfUpdates.phone = updateAgentDto.phone;
                if (updateAgentDto.phoneSecondary) pfUpdates.phoneSecondary = updateAgentDto.phoneSecondary;
                if (updateAgentDto.whatsapp) pfUpdates.whatsapp = updateAgentDto.whatsapp;
                if (updateAgentDto.linkedinAddress) pfUpdates.linkedinAddress = updateAgentDto.linkedinAddress;
                if (updateAgentDto.experienceSince) pfUpdates.experienceSince = parseInt(String(updateAgentDto.experienceSince), 10);
                if (updateAgentDto.position) pfUpdates.position = updateAgentDto.position;
                if (updateAgentDto.about) pfUpdates.about = updateAgentDto.about;
                if (updateAgentDto.nationality) pfUpdates.nationality = getCode(updateAgentDto.nationality) || undefined;


                // Convert languages to Property Finder IDs if provided
                if (updateAgentDto.languages && updateAgentDto.languages.length > 0) {
                    const convertLanguagesToIds = (languages: string[]): number[] => {
                        const languageMap: Record<string, number> = {
                            'english': 1, 'arabic': 2, 'french': 3, 'polish': 4, 'german': 5,
                            'russian': 6, 'hindi': 7, 'urdu': 8, 'croatian': 9, 'spanish': 10,
                            'persian': 11, 'farsi': 11, 'greek': 12, 'tagalog': 13, 'bengali': 14,
                            'tamil': 15, 'malayalam': 16, 'other': 17, 'kyrgyz': 18, 'uzbek': 19,
                            'kazakh': 20, 'mandarin': 21, 'italian': 22, 'portuguese': 23, 'dutch': 24,
                            'hungarian': 25, 'azerbaijani': 26, 'turkish': 27, 'memon': 28, 'gujarati': 29,
                            'ukrainian': 30, 'bulgarian': 32, 'swedish': 33, 'romanian': 34, 'afrikaans': 35,
                            'punjabi': 36, 'danish': 37, 'serbian': 38, 'norwegian': 39, 'cantonese': 40,
                            'bahasa melayu': 41, 'malay': 41, 'shona': 42, 'pashto': 43, 'albanian': 44,
                            'amharic': 45, 'baluchi': 46, 'belarusian': 47, 'berber': 48, 'catalan': 49,
                            'czech': 50, 'finnish': 51, 'japanese': 52, 'javanese': 53, 'kannada': 54,
                            'korean': 55, 'kurdi': 56, 'latvian': 57, 'sinhalese': 59, 'slovak': 60,
                            'slovene': 61, 'somali': 62, 'sudanese': 63, 'swahili': 64, 'telugu': 65,
                            'thai': 66, 'macedonian': 67, 'lithuanian': 68, 'armenian': 69, 'sindhi': 70,
                            'chinese': 21, // Map Chinese to Mandarin
                        };
                        return languages
                            .map(lang => languageMap[lang.trim().toLowerCase()] || null)
                            .filter((id): id is number => id !== null);
                    };
                    pfUpdates.languages = convertLanguagesToIds(updateAgentDto.languages);
                }

                if (photoUrl) pfUpdates.imageUrl = photoUrl;

                console.log('═══════════════════════════════════════');
                console.log('Syncing to Property Finder:', {
                    pfUserId: agent.pfUserId,
                    pfPublicProfileId: agent.pfPublicProfileId,
                    updates: pfUpdates
                });
                console.log('═══════════════════════════════════════');

                if (agent.pfUserId && Object.keys(pfUpdates).length > 0) {
                    await this.propertyFinderService.updateAgent(agent.pfUserId, pfUpdates);
                }
            } catch (error) {
                console.error('Failed to sync agent update to Property Finder:', error.message);
            }
        }

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Updated Agent: ${updatedAgent.name}`,
                ipAddress,
                location,
            });
        }

        return updatedAgent;
    }

    async remove(id: string, userId?: string, ipAddress?: string, location?: string) {
        const agent = await this.findOne(id); // Check if exists

        // Deactivate in Property Finder before deleting from CRM
        if (agent.pfUserId) {
            try {
                await this.propertyFinderService.deactivateAgent(agent.pfUserId);
                this.logger.log(`Agent ${agent.name} (PF ID: ${agent.pfUserId}) deactivated in Property Finder`);
            } catch (error) {
                this.logger.error(`Failed to deactivate agent in Property Finder: ${error.message}`);
                // Continue with CRM deletion even if PF deactivation fails
            }
        }

        const deleted = await this.prisma.agent.delete({ where: { id } });

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Deleted Agent: ${agent.name}`,
                ipAddress,
                location,
            });
        }

        return deleted;
    }

    async activate(id: string, userId?: string, ipAddress?: string, location?: string) {
        const agent = await this.findOne(id);

        const updatedAgent = await this.prisma.agent.update({
            where: { id },
            data: { isActive: true },
        });

        if (agent.pfUserId) {
            try {
                await this.propertyFinderService.activateAgent(agent.pfUserId);
            } catch (error) {
                this.logger.error(`Failed to activate agent in Property Finder: ${error.message}`);
            }
        }

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Activated Agent: ${agent.name}`,
                ipAddress,
                location,
            });
        }

        return updatedAgent;
    }

    async deactivate(id: string, userId?: string, ipAddress?: string, location?: string) {
        const agent = await this.findOne(id);

        const updatedAgent = await this.prisma.agent.update({
            where: { id },
            data: { isActive: false },
        });

        if (agent.pfUserId) {
            try {
                await this.propertyFinderService.deactivateAgent(agent.pfUserId);
            } catch (error) {
                this.logger.error(`Failed to deactivate agent in Property Finder: ${error.message}`);
            }
        }

        if (userId) {
            await this.activityService.create({
                user: { connect: { id: userId } },
                action: `Deactivated Agent: ${agent.name}`,
                ipAddress,
                location,
            });
        }

        return updatedAgent;
    }

    async syncFromPropertyFinder(userId?: string, ipAddress?: string, location?: string) {
        try {
            const pfAgents = await this.propertyFinderService.getAgents();

            const agentsList = pfAgents.data || [];

            let syncedCount = 0;

            for (const pfAgent of agentsList) {
                // Extract photo URL from imageVariants object
                const photoUrl = pfAgent.publicProfile?.imageVariants?.large?.default
                    || pfAgent.publicProfile?.imageVariants?.large?.jpg
                    || null;

                // Parse languages from bio if mentioned, otherwise empty array
                const languages: string[] = [];
                const bioText = pfAgent.publicProfile?.bio?.primary || '';
                // Common language keywords to look for
                const languageKeywords = ['English', 'Arabic', 'French', 'Spanish', 'Russian', 'Hindi', 'Urdu', 'German', 'Italian', 'Chinese', 'Portuguese', 'Dutch', 'Japanese', 'Korean'];
                languageKeywords.forEach(lang => {
                    if (bioText.toLowerCase().includes(lang.toLowerCase())) {
                        languages.push(lang);
                    }
                });

                // Prepare common data object from PF
                const pfAgentData = {
                    // Basic Info
                    name: `${pfAgent.firstName} ${pfAgent.lastName}`,
                    // Professional Info
                    position: pfAgent.publicProfile?.position?.primary || pfAgent.role?.name || 'Agent',
                    // Contact Info
                    phone: pfAgent.mobile || pfAgent.publicProfile?.phone || '',
                    phoneSecondary: pfAgent.publicProfile?.phoneSecondary || null,
                    whatsapp: pfAgent.mobile || pfAgent.publicProfile?.phone || null,
                    linkedinAddress: pfAgent.publicProfile?.linkedinAddress || null,
                    experienceSince: pfAgent.publicProfile?.experienceSince || null,
                    // Personal Info
                    languages: languages,
                    about: pfAgent.publicProfile?.bio?.primary || null,
                    // Employment Info
                    joinedDate: pfAgent.createdAt ? new Date(pfAgent.createdAt) : undefined,
                    // Status
                    isActive: pfAgent.status === 'active',
                    // Property Finder Integration
                    pfUserId: String(pfAgent.id),
                    pfPublicProfileId: pfAgent.publicProfile?.id ? String(pfAgent.publicProfile.id) : undefined,
                };

                // Add photoUrl only if it exists, to avoid overwriting with null if we want to keep local photo (optional decision, but here we sync from PF so we might want to overwrite)
                const dataToSync: any = { ...pfAgentData, photoUrl };

                // Try to find existing agent by email
                const existingAgent = await this.prisma.agent.findUnique({
                    where: { email: pfAgent.email },
                });

                if (existingAgent) {
                    // Update existing agent with fresh data from PF
                    await this.prisma.agent.update({
                        where: { id: existingAgent.id },
                        data: dataToSync,
                    });
                    syncedCount++;
                } else {
                    // Create new agent
                    const randomPassword = Math.random().toString(36).slice(-8);
                    const hashedPassword = await bcrypt.hash(randomPassword, 10);
                    const username = pfAgent.email.split('@')[0] + Math.floor(Math.random() * 1000);

                    await this.prisma.agent.create({
                        data: {
                            ...dataToSync,
                            email: pfAgent.email,
                            username: username,
                            password: hashedPassword,
                            department: 'Sales', // Default
                        },
                    });
                    syncedCount++;
                }
            }

            if (userId) {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Synced ${syncedCount} Agents from Property Finder`,
                    ipAddress,
                    location,
                });
            }

            return { success: true, message: `Synced ${syncedCount} agents from Property Finder` };
        } catch (error) {
            console.error('Failed to sync agents from Property Finder:', error);
            throw error;
        }
    }

    async submitForVerification(id: string, userId?: string, ipAddress?: string, location?: string) {
        const agent = await this.findOne(id);

        // Validate that agent has required data
        if (!agent.pfPublicProfileId) {
            throw new NotFoundException('Agent not synced to Property Finder');
        }

        if (!agent.licenseDocumentUrl) {
            throw new NotFoundException('Agent license document not uploaded');
        }

        if (!agent.phone) {
            throw new NotFoundException('Agent phone number required for verification');
        }

        try {
            // Submit verification to Property Finder
            await this.propertyFinderService.submitVerification(
                agent.pfPublicProfileId,
                agent.phone,
                agent.licenseDocumentUrl
            );

            // Update status to pending
            const updatedAgent = await this.prisma.agent.update({
                where: { id },
                data: { pfVerificationStatus: 'pending' },
            });

            this.logger.log(`Verification submitted for agent ${agent.name}`);

            if (userId) {
                await this.activityService.create({
                    user: { connect: { id: userId } },
                    action: `Submitted Agent Verification: ${agent.name}`,
                    ipAddress,
                    location,
                });
            }

            return updatedAgent;
        } catch (error) {
            this.logger.error(`Failed to submit verification for agent ${agent.name}:`, error.response?.data || error.message);
            throw error;
        }
    }
}
