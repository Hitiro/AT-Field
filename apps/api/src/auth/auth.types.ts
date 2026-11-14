import type { Request } from 'express';
import type { User } from '../users/entities/user.entity';
import type { VerifiedIdentity } from './auth-provider';

// Gravado pelo AuthGuard. `user` fica ausente só em rota com
// @AllowUnregistered() quando a pessoa ainda não existe no banco.
export type AuthState = {
  identity: VerifiedIdentity;
  user?: User;
};

export type AuthRequest = Request & { auth?: AuthState };
