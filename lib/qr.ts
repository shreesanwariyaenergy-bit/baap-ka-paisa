import 'server-only';
import QRCode from 'qrcode';
import { siteUrl } from './site';

/**
 * QR for a member's public profile. Until the production domain is confirmed (BKP_SITE_URL unset),
 * it encodes a placeholder on the reserved .example domain, which can never resolve.
 */
export async function profileQr(username: string): Promise<{ svg: string; url: string; placeholder: boolean }> {
  const site = siteUrl();
  const placeholder = !site;
  const url = `${placeholder ? 'https://baapkapaisa.example' : site}/u/${encodeURIComponent(username)}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#202725', light: '#E7E6DC' } });
  return { svg, url, placeholder };
}
