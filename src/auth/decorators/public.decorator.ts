import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_USER_KEY = 'isUSER';
export const isUser = () => SetMetadata(IS_USER_KEY, true);

export const IS_ADMIN_KEY = 'isADMIN';
export const isAdmin = () => SetMetadata(IS_ADMIN_KEY, true);

export const IS_CUSTOM_KEY = 'isCustom';
export const isCustom = (value: string) => SetMetadata(IS_CUSTOM_KEY, value);
