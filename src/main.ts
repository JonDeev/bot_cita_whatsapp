import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { IncomingMessage } from 'http';
import { AppModule } from './app.module';

interface IncomingMessageWithRawBody extends IncomingMessage {
  rawBody?: Buffer;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const rawBodyBuffer = (
    request: IncomingMessageWithRawBody,
    _response: unknown,
    buffer: Buffer,
  ) => {
    request.rawBody = buffer;
  };

  app.use(json({ verify: rawBodyBuffer }));
  app.use(urlencoded({ extended: true, verify: rawBodyBuffer }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
