import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { IncomingMessage } from 'http';
import { join } from 'path';
import { AppModule } from './app.module';
import {
  formatHttpStartupError,
  HttpServerOptions,
  resolveHttpServerOptions,
} from './shared/infrastructure/http/http-server-options';

interface IncomingMessageWithRawBody extends IncomingMessage {
  rawBody?: Buffer;
}

const bootstrapLogger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const rawBodyBuffer = (
    request: IncomingMessageWithRawBody,
    _response: unknown,
    buffer: Buffer,
  ) => {
    request.rawBody = buffer;
  };

  app.use(json({ verify: rawBodyBuffer }));
  app.use(urlencoded({ extended: true, verify: rawBodyBuffer }));
  app.useStaticAssets(join(process.cwd(), 'public'));
  app.enableShutdownHooks();

  let httpServerOptions: HttpServerOptions | null = null;

  try {
    httpServerOptions = resolveHttpServerOptions();
    await app.listen(httpServerOptions.port, httpServerOptions.host);
    bootstrapLogger.log(
      `HTTP server listening on ${httpServerOptions.host}:${httpServerOptions.port}`,
    );
  } catch (error: unknown) {
    const errorMessage =
      httpServerOptions == null
        ? error instanceof Error
          ? error.message
          : 'Unexpected bootstrap error while reading HTTP server options.'
        : formatHttpStartupError(error, httpServerOptions);

    bootstrapLogger.error(
      errorMessage,
      error instanceof Error ? error.stack : undefined,
    );
    await app.close();
    process.exitCode = 1;
  }
}

void bootstrap().catch((error: unknown) => {
  bootstrapLogger.error(
    error instanceof Error
      ? error.message
      : 'Unexpected bootstrap error while starting the Nest application.',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
