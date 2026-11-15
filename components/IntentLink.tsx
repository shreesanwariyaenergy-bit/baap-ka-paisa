'use client';
// A link that fetches its page in full (data included) when a mouse pointer (not a finger) enters it or it gets
// keyboard focus, so the page is usually ready by the time the click lands. Used where prefetching every link in
// view would cost too many server renders (45 city cards, board view tabs). Touch is deliberately left to the
// default prefetch: a tap follows touchstart, the browser's compatibility mouse events and tap focus within a few
// milliseconds, and an in-flight full prefetch would hold the old page on screen instead of showing the loading
// skeleton straight away.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';
import { PrefetchKind } from 'next/dist/client/components/router-reducer/router-reducer-types';

export function IntentLink({ href, onPointerEnter, onFocus, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();
  const warm = () => router.prefetch(href, { kind: PrefetchKind.FULL });
  return (
    <Link href={href} {...rest}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') warm(); onPointerEnter?.(e); }}
      onFocus={(e) => { if (e.currentTarget.matches(':focus-visible')) warm(); onFocus?.(e); }} />
  );
}
