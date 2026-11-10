'use client';
// Home board preview with the prototype's Locality / City / State / India tabs.
// All four boards are ranked on the server; the tabs only choose which one to show.
import { useState } from 'react';
import type { Board } from '@/lib/data/types';
import type { Level } from '@/lib/geo';
import { BoardList } from './BoardList';
import { CITY_NAMES } from './cityNames';

const LABEL: Record<Level, string> = { locality: 'Locality', city: 'City', state: 'State', india: 'India' };

export function HomeBoard({ boards, names, initial, note }: { boards: Record<Level, Board>; names: Record<Level, string>; initial: Level; note: string }) {
  const [level, setLevel] = useState<Level>(initial);
  const board = boards[level];
  return (
    <div className="board-panel">
      <div className="panel-head"><h3>{names[level]} / {LABEL[level]} board</h3><span>{note}</span></div>
      <div className="board-tabs" role="tablist" aria-label="Board level">
        {(Object.keys(LABEL) as Level[]).map((l) => (
          <button key={l} type="button" role="tab" id={`home-tab-${l}`} aria-selected={l === level} aria-controls="home-board" onClick={() => setLevel(l)}>{LABEL[l]}</button>
        ))}
      </div>
      <div id="home-board" role="tabpanel" aria-labelledby={`home-tab-${level}`}>
        <BoardList board={board} scopeLabel={names[level]} metaMode={level === 'locality' || level === 'city' ? 'flex' : 'city'} cityNames={CITY_NAMES} limit={4}
          emptyTitle={`No one rules ${names[level]} yet.`} emptyText="Be the first. Rankings appear here as soon as the season has ranked members." />
      </div>
    </div>
  );
}
