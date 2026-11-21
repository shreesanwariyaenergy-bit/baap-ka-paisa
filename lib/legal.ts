// The five policy pages linked from the footer: Terms, Privacy, Refunds, Guidelines and Grievance.
// Every statement matches what the product does (lib/engine, lib/season, lib/profile-rules, app/auth-actions).
// Business details that have not been supplied (Grievance Officer, contact email and address) are left out, never invented.
export interface LegalSection { heading: string; paragraphs: string[]; }
export interface LegalDoc { slug: string; title: string; fullTitle: string; summary: string; sections: LegalSection[]; }

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms', title: 'Terms', fullTitle: 'Terms and Conditions',
    summary: 'The rules for using BAAP KA PAISA and competing on the boards.',
    sections: [
      { heading: 'Using BAAP KA PAISA', paragraphs: [
        'BAAP KA PAISA is operated by VEXOR LABS. By using this website, you agree to these Terms. You must be 18 or older, give accurate information, keep your account secure and hold only one profile.',
      ] },
      { heading: 'Rankings', paragraphs: [
        'Members are ranked on locality, city, state and India boards by Season Score, which is the total of their successful ranking payments in the current season. The first entry is ₹1,000 and each later payment is a multiple of ₹500.',
        'To overtake a member, you must reach at least ₹500 above their Season Score. If two scores are equal, the member who reached that score first ranks higher. A payment does not guarantee or protect any position. Respect, backing and declarations are free and never affect rank.',
      ] },
      { heading: 'Seasons', paragraphs: [
        'Each season runs for one calendar month, from 00:00 IST on the 1st to 23:59 IST on the last day. Taking #01 on any board in the final 15 minutes extends the season by 15 minutes, up to 2 hours in total. Season Scores reset every month, while Lifetime Scores and season records are kept. A payment counts only for the season in which it is completed.',
      ] },
      { heading: 'Payments and prizes', paragraphs: [
        'Rank purchases are not currently available. When they open, completed ranking payments are generally final, subject to our Refund Policy and your rights under consumer law. BAAP KA PAISA offers no prizes, cash-outs, withdrawable balances or transferable credits; scores and ranks are records of participation only.',
      ] },
      { heading: 'Conduct', paragraphs: [
        'You must not manipulate rankings, misuse payments, impersonate others, harass members or interfere with the website. VEXOR LABS may investigate suspicious activity, correct verified errors and restrict accounts that break these Terms. We may change or suspend features where needed for security, operational or legal reasons.',
      ] },
      { heading: 'General', paragraphs: [
        'The BAAP KA PAISA name, branding, content and software may not be copied or used commercially without permission. These Terms are governed by the laws of India and do not limit your statutory consumer rights. For help, contact us through the Grievance page.',
      ] },
    ],
  },
  {
    slug: 'privacy', title: 'Privacy', fullTitle: 'Privacy Policy',
    summary: 'What we collect, what others can see and the choices you have.',
    sections: [
      { heading: 'What we collect', paragraphs: [
        'When you create a profile, we collect your email address, password, username, display name, date of birth, city and locality, and any title, flex line or social handle you choose to add. We also keep a record of your activity on the website, such as Respect, follows, backing and declarations, and the technical data needed to keep you signed in and secure. When payments open, we will also keep payment records.',
        'We do not collect your mobile number, home address or live location. Your password is managed by our sign-in provider and is never stored by us in readable form.',
      ] },
      { heading: 'How we use it', paragraphs: [
        'We use your information to run your account, calculate rankings, keep season records, process payments, prevent fraud, improve the website and respond to you.',
      ] },
      { heading: 'What others can see', paragraphs: [
        'Your username, display name, title, flex line, city, locality, ranks, scores, member number, achievements and declarations may be public. Your social handles are shown only to the audience you choose. Mystery Mode hides your name, social handles and member number, and only you can unmask yourself. Your email address and date of birth are never shown publicly.',
      ] },
      { heading: 'Sharing and storage', paragraphs: [
        'We share information only with the providers that run the website, Vercel for hosting and Supabase for our database and sign-in, and, when payments open, our payment provider. We may also disclose information where the law requires it or to deal with fraud or security incidents. We never sell personal information. Our database is hosted in India, and we keep information only for as long as it is needed for the service, security, financial records and legal obligations.',
      ] },
      { heading: 'Cookies', paragraphs: [
        'We use only essential cookies, which keep you signed in and the website secure. We do not use advertising or analytics cookies.',
      ] },
      { heading: 'Your choices', paragraphs: [
        'You can edit your profile and switch Mystery Mode on or off from your account page. To request access to, correction of or deletion of your information, contact us through the Grievance page. Any changes to this policy will be published on this page.',
      ] },
    ],
  },
  {
    slug: 'refunds', title: 'Refunds', fullTitle: 'Refund and Cancellation Policy',
    summary: 'When a ranking payment is refunded and how to ask for help.',
    sections: [
      { heading: 'Before you pay', paragraphs: [
        'Rank purchases are not currently available; this policy applies once they open. Please check the ranking action and amount before you pay. Completed and correctly credited ranking payments are generally final and are not refunded because you change your mind, are overtaken or do not reach the rank you wanted.',
      ] },
      { heading: 'When we refund', paragraphs: [
        'We refund a verified duplicate payment, an amount debited for a payment that failed, and a payment that cannot be credited to the season in which it was made; such a payment is never carried into the next season. If a payment succeeds but your ranking credit is missing, we will either correct your record or refund you.',
      ] },
      { heading: 'How refunds are paid', paragraphs: [
        'Refunds are made to the original payment method. We may ask for your order reference and payment confirmation. The time the amount takes to reach your account depends on your bank or payment provider.',
        'Nothing in this policy affects your rights under consumer law. For help with a refund, contact us through the Grievance page.',
      ] },
    ],
  },
  {
    slug: 'community', title: 'Guidelines', fullTitle: 'Community Guidelines',
    summary: 'Compete hard, and treat every member with respect.',
    sections: [
      { heading: 'Fair play', paragraphs: [
        'Use one genuine account. Do not impersonate others, create duplicate profiles, use automated tools or tamper with payments or rankings.',
      ] },
      { heading: 'Safety and privacy', paragraphs: [
        'Harassment, threats, hate speech, discrimination, stalking, doxxing and sharing someone’s private information are not allowed. Respect every member’s Mystery Mode and privacy choices.',
      ] },
      { heading: 'What you post', paragraphs: [
        'Names, titles, flex lines and social handles must not be unlawful, abusive or misleading, or infringe anyone’s rights. Flex lines are limited to 40 characters and may not include phone numbers, links, email addresses or handles. Spam, scams, malicious links and unauthorised advertising are not allowed.',
      ] },
      { heading: 'Reports and enforcement', paragraphs: [
        'Report a problem through the Grievance page. A member who holds a throne can also block a specific challenger from declaring against them. We may remove content, issue warnings, or suspend or close accounts that break these guidelines, and serious or repeated violations may lead to a permanent ban. You can ask for a review of any decision through the Grievance page.',
      ] },
    ],
  },
  {
    slug: 'grievance', title: 'Grievance', fullTitle: 'Grievance Redressal',
    summary: 'How to raise a complaint and what happens next.',
    sections: [
      { heading: 'Raising a complaint', paragraphs: [
        'You can raise a complaint about account access, rankings, payments, refunds, privacy, member content or technical problems. Please include your username or member ID, any transaction reference and a clear description of the problem. Screenshots or payment confirmations help us investigate.',
      ] },
      { heading: 'What happens next', paragraphs: [
        'We will acknowledge and resolve complaints within the time limits set by law. Payment and ranking disputes may require us to check transaction records and ranking history, and a disputed entry may be placed under review while we investigate. If you are not satisfied with our decision, you may ask for a further review or use the remedies available under consumer law.',
      ] },
      { heading: 'Operator', paragraphs: [
        'BAAP KA PAISA is operated by VEXOR LABS.',
      ] },
    ],
  },
];
