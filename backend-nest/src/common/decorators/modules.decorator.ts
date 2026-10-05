import { SetMetadata } from '@nestjs/common';

export const MODULE_KEY = 'requiredModule';
export const RequireModule = (module: string) => SetMetadata(MODULE_KEY, module);
