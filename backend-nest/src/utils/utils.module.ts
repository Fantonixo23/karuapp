import { Module } from '@nestjs/common';
import { UtilsController } from './utils.controller';

@Module({
  controllers: [UtilsController],
})
export class UtilsModule {}
