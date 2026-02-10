const BRAND_LOGO_VERSION = '20260210-4';

function withVersion(url: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${BRAND_LOGO_VERSION}`;
}

export const brandName = 'ZapVender';
export const brandLogoUrl = withVersion('/img/logo-zapvender.svg');