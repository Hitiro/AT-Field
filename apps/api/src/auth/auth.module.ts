import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isLoopbackEmulatorHost, type Env } from '../config/env';
import { AUTH_PROVIDER } from './auth-provider';
import { AuthMeService } from './auth-me.service';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { FirebaseAuthProvider } from './firebase-auth.provider';
import { MeController } from './me.controller';

// Factory do AUTH_PROVIDER. Segunda barreira (a primeira é o envSchema): o
// SDK lê FIREBASE_AUTH_EMULATOR_HOST direto do process.env e, com ela, aceita
// token sem assinatura. Proibida em produção e, fora dela, só em loopback.
export function createAuthProvider(
  config: ConfigService<Env, true>,
): FirebaseAuthProvider {
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  if (
    emulatorHost &&
    (config.get('NODE_ENV') === 'production' ||
      !isLoopbackEmulatorHost(emulatorHost))
  ) {
    throw new Error(
      'FIREBASE_AUTH_EMULATOR_HOST proibida em produção e fora de loopback',
    );
  }
  return new FirebaseAuthProvider({
    projectId: config.get('FIREBASE_PROJECT_ID'),
    checkRevoked: config.get('AUTH_CHECK_REVOKED'),
  });
}

@Module({
  controllers: [MeController],
  providers: [
    {
      provide: AUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: createAuthProvider,
    },
    AuthService,
    AuthMeService,
    AuthGuard,
  ],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
