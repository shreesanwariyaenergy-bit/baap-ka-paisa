import 'server-only';
// The finalised logo for server-rendered share images (ImageResponse). Read from assets/ (bundled with the server
// functions, like the fonts) as a data URL; width follows the artwork's own 747 x 760 ratio, so it is never stretched.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const RATIO = 747 / 760;
const logo = readFile(path.join(process.cwd(), 'assets', 'brand', 'baap-ka-paisa-logo-480.png')).then((b) => `data:image/png;base64,${b.toString('base64')}`);

/** The logo (dark lettering, transparent background) at a given height, for light share-image surfaces. */
export async function shareLogo(height: number): Promise<{ src: string; width: number; height: number }> {
  return { src: await logo, width: Math.round(height * RATIO), height };
}
