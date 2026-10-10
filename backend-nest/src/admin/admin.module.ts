import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminOnlyGuard } from './admin-only.guard';

@Module({
  controllers: [AdminController],
  providers: [AdminOnlyGuard],
})
export class AdminModule {}
