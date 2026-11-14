// Draft policy outlines built only from the Product Blueprint's stated rules.
// They are not legal text. Every page is marked DRAFT — LEGAL REVIEW REQUIRED until counsel approves it.
export interface LegalDoc { slug: string; title: string; summary: string; sections: { heading: string; points: string[] }[]; }

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms', title: 'Terms of use', summary: 'What BAAP KA PAISA is, who can use it, and the rules of the boards.',
    sections: [
      { heading: 'What the service is', points: [
        'A public status register: members appear on locality, city, state and India boards in monthly seasons.',
        'Season Score decides rank. It resets at the start of each season. Lifetime Score is kept across seasons.',
        'There are no prizes, no cash-outs, no wallet, no user-to-user transfers and no automatic spending.',
      ] },
      { heading: 'Who can use it', points: ['Members must be 18 or older.', 'One member profile per person.'] },
      { heading: 'Ranking rules', points: [
        'What decides order is the moment the register records your payment, by the register\'s own clock. If two members reach the same score, the one the register recorded first ranks higher.',
        'When your payment provider took the money decides only whether the payment counts for the season: it must be taken before the season closes. It never changes the order of ranks.',
        'A payment taken before the close but confirmed to us within 10 minutes after it still counts for that season. A payment that cannot be counted is refunded; it is never carried into the next season.',
        'Entering a season starts at ₹1,000; later payments are multiples of ₹500.',
        'To pass someone, your Season Score must reach their score plus ₹500. Ties go to whoever reached the score first.',
        'Every successful payment is recorded in an append-only ledger. Ranks are calculated from that ledger; an admin cannot change a rank without a logged adjustment.',
      ] },
      { heading: 'Status of payments', points: ['Payments are not open. Rank purchases stay off until legal review, payment-provider approval and tax confirmation are complete.'] },
    ],
  },
  {
    slug: 'privacy', title: 'Privacy notice', summary: 'What is shown publicly, what is never shown, and the controls you have.',
    sections: [
      { heading: 'Shown publicly', points: ['Display name and @username, title, flex line, city and locality, ranks, Season Score, lifetime tier and member number.'] },
      { heading: 'Never shown', points: ['Phone number, exact address, date of birth and live location.'] },
      { heading: 'Mystery mode', points: ['Free for everyone. Hides your name, photo, socials and member number behind an ANON label. Only you can unmask yourself; nobody is unmasked automatically.'] },
      { heading: 'Consent and rights (DPDP)', points: ['Consent wording, retention periods, data-principal rights and the contact for privacy requests will be published here after legal review.'] },
    ],
  },
  {
    slug: 'refunds', title: 'Refund policy', summary: 'When money is returned and how the boards are corrected.',
    sections: [
      { heading: 'When refunds apply', points: ['Refunds are only for failed or duplicate payments.'] },
      { heading: 'How the board is corrected', points: ['A refunded payment is reversed with a new ledger entry. The original record is never edited or deleted, and ranks are recalculated from the ledger.'] },
      { heading: 'Status', points: ['Payments are not open, so no refunds can arise yet. Timelines and the request process will be published after legal and payment-provider review.'] },
    ],
  },
  {
    slug: 'grievance', title: 'Grievance officer', summary: 'How to raise a complaint (IT Rules).',
    sections: [
      { heading: 'Contact', points: ['The Grievance Officer’s name and contact details will be published here before launch.'] },
      { heading: 'What you can report', points: ['Impersonation, harassment, doxxing, offensive flex lines or throne messages, and errors in your own record.'] },
    ],
  },
  {
    slug: 'community', title: 'Community guidelines', summary: 'Keeping the competition friendly and safe.',
    sections: [
      { heading: 'Rules', points: [
        'Flex lines are limited to 40 characters, filtered and reportable.',
        'Overtake receipts are preset phrases only; there is no open free text.',
        'No impersonation, harassment, threats, doxxing or attempts to reveal a Mystery mode member.',
      ] },
      { heading: 'Safety', points: ['Only city and locality are shown, never an exact address or live location. Block, report and privacy controls will be available to every member.'] },
    ],
  },
];
