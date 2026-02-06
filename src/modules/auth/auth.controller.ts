import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import { AuthenticationService, AuthContext } from '@frooxi-labs/authentication';
import { EmailService } from '../../providers/email/email.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthenticationService,
        private readonly emailService: EmailService,
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService
    ) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const context: AuthContext = {
            ipAddress: req.ip || req.socket.remoteAddress,
            deviceId: req.headers['x-device-id'] as string,
            userAgent: req.headers['user-agent'],
        };

        console.log('Login Request:', { username: loginDto.username, password: loginDto.password });
        let user = await this.authService.validateUser(loginDto.username, loginDto.password, context);

        // If not found in User table, check Agent table
        if (!user) {
            const agent = await this.prisma.agent.findUnique({ where: { username: loginDto.username } });
            if (agent && await bcrypt.compare(loginDto.password, agent.password)) {
                // Generate tokens manually for Agent
                const payload = { sub: agent.id, username: agent.username }; // Adjust payload as needed
                const secret = process.env.JWT_SECRET;

                const accessToken = this.jwtService.sign(payload, { secret, expiresIn: '1d' });
                const refreshToken = this.jwtService.sign(payload, { secret, expiresIn: '7d' });

                // Set cookies (same as standard login)
                const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
                res.cookie('access_token', accessToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 24 * 60 * 60 * 1000, // 1d
                });

                res.cookie('refresh_token', refreshToken, {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: isProduction ? 'none' : 'lax',
                    maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
                });

                return { user: agent, accessToken, refreshToken };
            }
        }

        if (!user) {
            res.status(HttpStatus.UNAUTHORIZED).json({ message: 'Invalid credentials' });
            return;
        }
        const tokens = await this.authService.login(user);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        res.cookie('access_token', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 1d
        });

        res.cookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        return { user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }

    @UseGuards(AuthGuard('jwt-refresh'))
    @Get('refresh')
    @HttpCode(HttpStatus.OK)
    async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const user = req.user as any;
        const tokens = await this.authService.refreshTokens(user.sub, user.refreshToken);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        res.cookie('access_token', tokens.accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000, // 1d
        });

        res.cookie('refresh_token', tokens.refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
        });

        return { message: 'Tokens refreshed', accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('me')
    @HttpCode(HttpStatus.OK)
    async getProfile(@Req() req: Request) {
        return req.user;
    }

    @UseGuards(AuthGuard('jwt'))
    @Post('logout')
    @HttpCode(HttpStatus.OK)
    async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const user = req.user as any;
        await this.authService.logout(user.id);

        const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
        res.clearCookie('access_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });
        res.clearCookie('refresh_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        });

        return { message: 'Logged out' };
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() dto: ForgotPasswordDto, @Headers('x-device-id') deviceId: string) {
        const result = await this.authService.initiateForgotPassword(dto.usernameOrEmail, deviceId);

        // If an OTP was generated (meaning user exists), send it via email
        if (result.success && result.rawOtp) {
            await this.emailService.sendOtpEmail(result.email, result.rawOtp);
        }

        // SANITIZATION: Never return the OTP in the response
        return {
            success: true,
            message: 'If an account with that email exists, a password reset code has been sent.'
        };
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto, @Headers('x-device-id') deviceId: string) {
        return this.authService.resetPassword(dto.usernameOrEmail, dto.otp, dto.newPassword, deviceId);
    }
}
