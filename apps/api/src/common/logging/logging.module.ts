import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env, resolveLogFormat } from '../../config/env';
import { AppLogger } from './app-logger';

@Global()
@Module({
  providers: [
    {
      provide: AppLogger,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new AppLogger({
          json:
            resolveLogFormat(
              config.get('NODE_ENV'),
              config.get('LOG_FORMAT'),
            ) === 'json',
          level: config.get('LOG_LEVEL'),
        }),
    },
  ],
  exports: [AppLogger],
})
export class LoggingModule {}
