import './load-env';
import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { env } from './config/env';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { AppModule } from './app.module';

async function bootstrap() {
  const config = env(); // fail fast on bad configuration
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });

  app.set('trust proxy', 1); // behind a TLS-terminating load balancer; real client IP for rate limits/audit
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: config.NODE_ENV === 'production' ? undefined : false, hsts: { maxAge: 31536000, includeSubDomains: true } }));
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id', 'Accept-Language'],
  });
  app.useBodyParser('json', { limit: '256kb' });
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.NODE_ENV !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Orgil Lending API')
      .setDescription('Digital lending platform API. Monetary values are decimal strings in MNT. Sandbox payment endpoints never move real money.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'docs/openapi.json' });
  }

  await app.listen(config.PORT);
  Logger.log(`API listening on :${config.PORT} (docs: /docs)`, 'Bootstrap');
}

bootstrap().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
