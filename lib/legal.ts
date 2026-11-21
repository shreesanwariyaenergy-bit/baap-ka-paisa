// Policy pages: Terms, Privacy, Refunds, Community Guidelines and Grievance.
// Based on the operator's (VEXOR LABS) supplied text, corrected wherever it differed from what the product actually
// does (checked against lib/engine, lib/season, lib/profile-rules, app/auth-actions and the Supabase migrations).
// Pending legal review. Business details that have not been supplied (Grievance Officer, email, address, effective
// date) are null and show as "to be published"; none is ever made up.
export interface LegalSection { heading: string; paragraphs: string[]; }
export interface LegalContact { label: string; value: string | null; }
export interface LegalDoc {
  slug: string; title: string; summary: string; sections: LegalSection[];
  contact?: LegalContact[];
  /** Effective date, set on publication after legal review. Null until then. */
  effective: string | null;
}

const GRIEVANCE_LINE = 'For assistance, please use the Grievance section of our website.';

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: 'terms', title: 'Terms and Conditions', effective: null,
    summary: 'The terms that apply when you access or use BAAP KA PAISA.',
    sections: [
      { heading: 'About these Terms', paragraphs: [
        'Welcome to BAAP KA PAISA, operated under the business name VEXOR LABS. By accessing or using our website and services, you agree to these Terms and Conditions.',
      ] },
      { heading: 'Eligibility and accounts', paragraphs: [
        'The Platform is intended for individuals aged 18 years or older. Members must provide accurate information, maintain the security of their accounts and must not create duplicate or misleading accounts. Each person may hold only one member profile.',
      ] },
      { heading: 'Rankings and Season Score', paragraphs: [
        'BAAP KA PAISA provides locality, city, state and national ranking boards. A member’s Season Score is the total of their successful ranking payments credited in the current season, and every board is ordered by Season Score under the published ranking rules. The initial qualifying entry is ₹1,000, with subsequent rank-up payments in multiples of ₹500, as displayed before payment.',
        'A member must reach at least ₹500 above another member’s Season Score to overtake them. If two members have the same Season Score, the member who reached that score first ranks higher. A payment does not guarantee a particular position or prevent another member from overtaking them.',
        'Respect, backing and declarations are free. They never change a Season Score or a rank.',
      ] },
      { heading: 'Seasons', paragraphs: [
        'Each season runs for one calendar month in Indian Standard Time (IST), from 00:00 on the 1st to 23:59 on the last day of the month. If a member takes #01 on any board in the last 15 minutes of a season, the close is extended by 15 minutes, up to a maximum of 2 hours after the scheduled close.',
        'Season Scores reset when a new season begins, while Lifetime Scores and verified historical records are retained. A payment counts only towards the season in which it is completed. A payment that cannot be counted towards that season is refunded under the Refund and Cancellation Policy and is never carried into the next season.',
      ] },
      { heading: 'No prizes or cash value', paragraphs: [
        'Members do not receive cash prizes, withdrawable balances or transferable monetary credits through the current ranking system. Scores and rankings represent participation records within the Platform.',
      ] },
      { heading: 'Conduct and enforcement', paragraphs: [
        'Members must not manipulate rankings, misuse payment systems, impersonate others, harass users or interfere with the Platform. VEXOR LABS may investigate suspicious activity, correct verified errors and restrict accounts involved in fraud, abuse or violations of these Terms.',
      ] },
      { heading: 'Transactions and changes to the service', paragraphs: [
        'Completed ranking transactions are generally final, subject to the Refund and Cancellation Policy and applicable consumer rights. VEXOR LABS may modify or suspend features where reasonably necessary for security, operational or legal reasons.',
      ] },
      { heading: 'Intellectual property and governing law', paragraphs: [
        'The Platform’s content, software, name and branding may not be copied or commercially exploited without permission. These Terms are governed by applicable Indian law, without limiting statutory consumer rights.',
      ] },
      { heading: 'Contact', paragraphs: [GRIEVANCE_LINE] },
    ],
  },
  {
    slug: 'privacy', title: 'Privacy Policy', effective: null,
    summary: 'What VEXOR LABS collects when you use BAAP KA PAISA, what is public and the choices you have.',
    sections: [
      { heading: 'Introduction', paragraphs: [
        'BAAP KA PAISA respects the privacy of its members. This Policy explains how VEXOR LABS collects and uses information when you use our Platform.',
      ] },
      { heading: 'Information we collect', paragraphs: [
        'When you create an account, we collect your email address and password, username, display name, date of birth (to confirm that you are 18 or older), city and locality, and any optional title, flex line and Instagram or Snapchat handle you add. Your password is handled by our authentication provider and is not stored by us in readable form.',
        'We also record your Mystery Mode and social-visibility choices, the member who invited you (if any), your activity on the Platform (such as Respect, follows, rivals, backing, declarations and blocks), support communications and the technical information needed to operate and secure the service, such as sign-in session data. Once payments open, we will also record payment amounts, times and transaction references.',
        'We do not collect your mobile number, residential address or live location.',
      ] },
      { heading: 'How we use information', paragraphs: [
        'This information is used to manage accounts, calculate rankings, maintain season records, process and reconcile payments, prevent fraud, improve the Platform and respond to customer requests.',
      ] },
      { heading: 'What is shown publicly', paragraphs: [
        'Your username, display name, title, flex line, city and locality, ranks, Season Score, Lifetime tier, member number, achievements, backing counts and declarations may be publicly visible. Your social handles are shown only to the audience you choose: everyone, your followers or nobody.',
        'Mystery Mode hides your name, social handles and member number behind an anonymous label. Only you can unmask yourself; nobody is unmasked automatically. Your email address and date of birth are never displayed publicly.',
      ] },
      { heading: 'Cookies', paragraphs: [
        'We use only the cookies needed to run the Platform: to keep you signed in, to secure your session and to remember certain site settings. We do not use advertising or analytics cookies.',
      ] },
      { heading: 'Sharing with service providers', paragraphs: [
        'We share necessary information with the providers that run the Platform: Vercel (website hosting) and Supabase (database and account sign-in). When payments open, the payment provider will receive the information needed to process your payment. Information may also be disclosed where required by law or necessary to address fraud, security incidents or legal claims. We do not sell members’ personal information.',
      ] },
      { heading: 'Storage, security and retention', paragraphs: [
        'Our member database is hosted in India (Mumbai region). We take reasonable measures to protect stored information against unauthorised access, misuse or disclosure. Information is retained only for as long as reasonably necessary for service delivery, security, financial records and legal obligations.',
      ] },
      { heading: 'Your choices and rights', paragraphs: [
        'You can edit your profile details and turn Mystery Mode on or off at any time from your account page.',
        'You may request access to, correction of or deletion of your personal information, subject to applicable legal retention requirements. Further details or requests may be submitted through our Grievance section.',
      ] },
      { heading: 'Changes to this Policy', paragraphs: [
        'We may update this Policy when our services or legal requirements change. The latest version will be published on this page.',
      ] },
    ],
  },
  {
    slug: 'refunds', title: 'Refund and Cancellation Policy', effective: null,
    summary: 'When a payment is refunded or reversed, and how to ask for help.',
    sections: [
      { heading: 'Before you pay', paragraphs: [
        'Please review your selected ranking action and payment amount carefully before confirming a transaction on BAAP KA PAISA.',
      ] },
      { heading: 'Completed transactions', paragraphs: [
        'Successfully completed and correctly credited ranking transactions are generally final. Refunds are not ordinarily provided merely because a member changes their mind, is overtaken by another member, loses a ranking position or does not achieve their desired result.',
      ] },
      { heading: 'Duplicate payments', paragraphs: [
        'A duplicate payment for the same transaction will be reviewed and the verified duplicate amount will be refunded through the original payment method.',
      ] },
      { heading: 'Failed payments', paragraphs: [
        'Where an amount is debited but the payment fails, we will verify the transaction with the payment provider and arrange an appropriate reversal or refund when the amount has been collected.',
      ] },
      { heading: 'Missing ranking credit', paragraphs: [
        'Where payment succeeds but the corresponding ranking credit is missing, VEXOR LABS will investigate the transaction and correct the ranking record or provide an appropriate refund where the service cannot be delivered.',
      ] },
      { heading: 'Payments after a season closes', paragraphs: [
        'A payment counts only towards the season in which it is completed. If a payment is completed after the season has closed, or otherwise cannot be credited to that season, it is refunded and is never carried into the next season.',
      ] },
      { heading: 'Investigations', paragraphs: [
        'Unauthorised transactions, payment errors and technical failures will be investigated using the available transaction records. Members may be asked to provide the order reference and relevant payment confirmation.',
      ] },
      { heading: 'How refunds are paid', paragraphs: [
        'Approved refunds will ordinarily be initiated through the original payment method. The time taken for the amount to appear in the member’s account may depend on the bank, payment gateway or payment network.',
      ] },
      { heading: 'Your consumer rights', paragraphs: [
        'Nothing in this Policy removes any refund or remedy available under applicable consumer law.',
        'For refund assistance, contact us through the Grievance section of the website.',
      ] },
    ],
  },
  {
    slug: 'community', title: 'Community Guidelines', effective: null,
    summary: 'Competition and rivalry, with respect for the safety and privacy of others.',
    sections: [
      { heading: 'Our approach', paragraphs: [
        'BAAP KA PAISA is built around competition, recognition and public status. We encourage confidence and rivalry, but every member must respect the safety and privacy of others.',
      ] },
      { heading: 'Genuine accounts and fair play', paragraphs: [
        'Members must use genuine accounts and must not impersonate others, manipulate rankings, create duplicate profiles, use automated tools to gain unfair advantages or interfere with payment and ranking systems.',
      ] },
      { heading: 'Safety and privacy', paragraphs: [
        'Harassment, threats, hate speech, discrimination, doxxing, stalking and disclosure of another person’s private information are prohibited. Mystery Mode and other privacy preferences must be respected.',
      ] },
      { heading: 'What you post', paragraphs: [
        'Usernames, display names, titles, flex lines, social handles and any other content you submit must not be unlawful, abusive or misleading, or infringe another person’s rights. Flex lines are limited to 40 characters and may not contain phone numbers, links, email addresses or social handles.',
        'Spam, fraudulent activity, malicious links, unauthorised advertising and attempts to compromise the Platform are not permitted.',
      ] },
      { heading: 'Reporting and blocking', paragraphs: [
        'Members may report inappropriate content or suspicious activity through the Grievance section. A member who holds a throne can also block a specific challenger from declaring against them.',
      ] },
      { heading: 'Enforcement and review', paragraphs: [
        'VEXOR LABS may investigate reports, remove violating content, issue warnings or restrict and terminate accounts where necessary to protect members and the integrity of the Platform. Serious or repeated violations may result in permanent account suspension.',
        'Where appropriate, affected members may request a review through the Grievance process.',
      ] },
    ],
  },
  {
    slug: 'grievance', title: 'Grievance Redressal', effective: null,
    summary: 'How to raise a complaint and how it is handled.',
    sections: [
      { heading: 'Our commitment', paragraphs: [
        'BAAP KA PAISA aims to provide a fair and accessible process for resolving member complaints.',
      ] },
      { heading: 'What you can raise', paragraphs: [
        'Members may contact us regarding account access, incorrect rankings, payment failures, duplicate charges, refunds, privacy concerns, inappropriate content or technical problems.',
      ] },
      { heading: 'How to make a complaint', paragraphs: [
        'Please provide your username or member ID, the relevant transaction reference where applicable and a clear description of the issue. Supporting screenshots or payment confirmations may help us investigate the complaint.',
      ] },
      { heading: 'How complaints are handled', paragraphs: [
        'Each complaint will be reviewed by the appropriate support personnel. We will acknowledge and address complaints within the timelines prescribed by applicable law.',
        'Payment and ranking disputes may require verification of transaction records, payment confirmations and ranking history. Where necessary, disputed entries may be temporarily reviewed or restricted while an investigation is conducted.',
      ] },
      { heading: 'Further review', paragraphs: [
        'Members who are dissatisfied with a decision may request a further review or use the appropriate statutory consumer or regulatory remedies available to them.',
      ] },
    ],
    contact: [
      { label: 'Business', value: 'VEXOR LABS' },
      { label: 'Grievance Officer', value: null },
      { label: 'Email', value: null },
      { label: 'Address', value: null },
    ],
  },
];
