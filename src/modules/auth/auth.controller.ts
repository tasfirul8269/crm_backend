import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, Res, UseGuards, Inject } from '@nestjs/common';
import { AuthenticationService, AuthContext } from '@frooxi-labs/authentication';
import { EmailService } from '../../providers/email/email.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthenticationService,
        private readonly emailService: EmailService
    ) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
        const context: AuthContext = {
            ipAddress: req.ip || req.socket.remoteAddress,
            deviceId: req.headers['x-device-id'] as string,
            userAgent: req.headers['user-agent'],
        };

        const user = await this.authService.validateUser(loginDto.username, loginDto.password, context);
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

        return { user };
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

        return { message: 'Tokens refreshed' };
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
