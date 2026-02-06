import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UsersService } from '../../users/users.service';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
    constructor(
        private usersService: UsersService,
        private prisma: PrismaService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (request: Request) => {
                    return (request as any)?.cookies?.access_token;
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET!,
        });
    }

    async validate(payload: any) {
        const user = await this.usersService.findById(payload.sub);
        if (user) {
            return user;
        }

        // If not found in User table, check Agent table
        const agent = await this.prisma.agent.findUnique({ where: { id: payload.sub } });
        if (agent) {
            return agent;
        }

        console.error(`[JwtStrategy] User/Agent not found for ID: ${payload.sub}`);
        throw new UnauthorizedException();
    }
}
