import { CONTACT_EMAIL, LEGAL_UPDATED } from "@fr/shared";

// The privacy policy and terms of use, as plain static HTML. Everything here describes what the code does
// today: when a feature adds data collection (Sentry, saved stories, analytics), update these pages first.

const mail = `<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>`;

function page(title: string, body: string) {
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title} · FirstReport</title>
<style>
  :root { --bg: #F4F4F2; --card: #FFFFFF; --ink: #0A0A0A; --muted: #5C5C5C; --line: #E6E6E6; --accent: #1B7A4B; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0B0B0B; --card: #171717; --ink: #F2F2F2; --muted: #A3A3A3; --line: #2A2A2A; --accent: #3FA674; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 20px 64px; }
  .brand { font-weight: 600; color: var(--accent); text-decoration: none; letter-spacing: 0.2px; }
  h1 { font: 600 34px/1.15 Georgia, "Times New Roman", serif; letter-spacing: -0.5px; margin: 20px 0 6px; }
  .updated { color: var(--muted); font-size: 14px; margin: 0 0 28px; }
  h2 { font-size: 18px; line-height: 1.35; margin: 32px 0 8px; }
  p, li { margin: 0 0 10px; }
  ul { padding-left: 22px; margin: 0 0 10px; }
  a { color: var(--accent); }
  .box { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 16px 18px; margin: 20px 0; }
  footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid var(--line); color: var(--muted); font-size: 14px; }
  footer a { margin-right: 16px; }
</style>
</head>
<body>
<main>
<a class="brand" href="/privacy">FirstReport</a>
<h1>${title}</h1>
<p class="updated">Last updated ${LEGAL_UPDATED}</p>
${body}
<footer><a href="/privacy">Privacy policy</a><a href="/terms">Terms of use</a>${mail}</footer>
</main>
</body>
</html>
`;
}

export const privacyPage = page(
  "Privacy policy",
  `
<p>FirstReport is a news app that shows short summaries of news from Indian outlets. This policy explains what
information FirstReport ("we", "us") handles when you use the app, why, and the choices you have. It is written
with India's Digital Personal Data Protection Act, 2023 in mind.</p>

<div class="box"><strong>In short:</strong> you can read FirstReport without an account, and then we hold no
personal information about you on our servers. If you choose to sign in with Google, we store your name, email
address and profile photo until you delete your account. We do not sell your data, show ads, or use analytics or
tracking tools.</div>

<h2>1. Reading without an account</h2>
<p>You do not need an account to read FirstReport. When the app loads news, our servers receive the request,
which includes your device's IP address and basic technical details (such as app version and the time of the
request). We use these only to deliver the news, keep the service secure and fix problems, and we do not link them
to a person.</p>

<h2>2. If you sign in with Google</h2>
<p>Signing in is optional. If you sign in, Google shares with us, and we store:</p>
<ul>
  <li>your Google account ID, email address, name and profile photo link;</li>
  <li>when your account was created and when you last signed in;</li>
  <li>a session record so you stay signed in. We store only a scrambled (hashed) form of your session key.</li>
</ul>
<p>We use this to keep you signed in and to show your profile on the Account page. We may also use your email
address to tell you about important changes to FirstReport, such as new features for signed-in readers. We do not
receive your Google password. Google's handling of your data is covered by
<a href="https://policies.google.com/privacy">Google's privacy policy</a>.</p>

<h2>3. What stays on your phone</h2>
<p>The app keeps a few things only on your device: your appearance setting (light, dark or system), your recent
searches, a count of cards you have seen (used to decide when to offer sign-in) and, if you sign in, your session
key in the phone's secure storage. These are not sent to us. Uninstalling the app removes them.</p>

<h2>4. Other services the app connects to</h2>
<ul>
  <li><strong>News outlets.</strong> Photos on cards are loaded directly from the outlet that published them, and
  opening a source takes you to the outlet's website. The outlet can see your IP address, as with any website you
  visit, and its own privacy policy applies.</li>
  <li><strong>Google.</strong> Outlet logos are loaded from Google's public website icon service, and sign-in uses
  Google Sign-In.</li>
  <li><strong>Cloudflare.</strong> Our servers sit behind Cloudflare, which carries and protects the traffic
  between the app and our servers.</li>
  <li><strong>Google Gemini.</strong> We use Google's Gemini AI to write news summaries from published news
  articles. Only the articles are sent to it, never information about you.</li>
</ul>

<h2>5. What we do not do</h2>
<ul>
  <li>We do not sell, rent or trade personal information.</li>
  <li>We do not show advertising or use advertising identifiers.</li>
  <li>We do not use analytics or tracking tools, and we do not build a profile of what you read on our servers.</li>
</ul>

<h2>6. How long we keep information</h2>
<p>Account information is kept until you delete your account. Server request logs are kept only as long as
needed to run the service securely and fix problems. Copies in backups are removed as those backups expire.</p>

<h2 id="delete-account">7. Deleting your account</h2>
<p>You can delete your account at any time in the app: <strong>Account → Delete account</strong>. This removes
your account and signs you out on every device straight away. You can also ask us to delete it by emailing ${mail}
from the email address on your account. We will do so within 30 days and confirm by email.</p>

<h2>8. Your rights</h2>
<p>You can ask us to tell you what personal information we hold about you, to correct it, or to delete it. You can
also withdraw your consent at any time by deleting your account. To do any of these, or to raise a complaint, email
${mail}. We aim to reply within 30 days. If you are not satisfied with our answer, you may approach the Data
Protection Board of India.</p>

<h2>9. Children</h2>
<p>Anyone may read FirstReport. Signing in is meant for people aged 18 or over. If you believe a child has signed
in, email ${mail} and we will delete the account.</p>

<h2>10. Security</h2>
<p>Traffic between the app and our servers is encrypted, session keys are stored only in hashed form, and access to
our servers is restricted. No system is completely secure, but we work to protect the information we hold.</p>

<h2>11. Changes to this policy</h2>
<p>If we change what we collect or how we use it, we will update this page and the date above before the change
takes effect, and tell signed-in readers about significant changes.</p>

<h2>12. Contact</h2>
<p>Questions or requests about privacy: ${mail}.</p>
`,
);

export const termsPage = page(
  "Terms of use",
  `
<p>These terms apply when you use the FirstReport app and website ("FirstReport", "we", "us"). By using
FirstReport you agree to them. If you do not agree, please do not use it.</p>

<h2>1. What FirstReport is</h2>
<p>FirstReport gathers news published by Indian outlets and shows each news event as a short summary, with links
to the original reports. FirstReport is free to use.</p>

<h2>2. AI-written summaries</h2>
<p>Summaries, headlines, timelines and "story so far" overviews are written automatically by AI, using only the
reports of the outlets we link to. We work to keep them accurate, but they can contain mistakes or miss context,
and news can change after a summary is written. Always check the original reports before relying on a story, and
do not treat FirstReport as financial, legal, medical or other professional advice.</p>

<h2>3. Content from news outlets</h2>
<p>Articles, photos and logos belong to the outlets that published them. FirstReport shows its own short
summaries, credits the outlet, and links back to the original article. Photos are shown from the outlet's own
website. If you are a publisher and have a concern about how your content appears, email ${mail} and we will
respond promptly.</p>

<h2>4. Your account</h2>
<p>You can read FirstReport without an account. If you sign in with Google, you are responsible for your Google
account, and you must be 18 or over. You can delete your account at any time in the app (Account → Delete
account). We may suspend or close accounts that misuse the service.</p>

<h2>5. Acceptable use</h2>
<p>Please do not:</p>
<ul>
  <li>copy, scrape or republish FirstReport's content in bulk, or use automated tools to collect it;</li>
  <li>try to disrupt, overload or gain unauthorised access to FirstReport or its servers;</li>
  <li>use FirstReport for anything unlawful.</li>
</ul>
<p>Sharing individual stories with friends using the app's Share button is welcome.</p>

<h2>6. FirstReport's own content</h2>
<p>The FirstReport name, app design and the summaries we write belong to FirstReport. You may read and share them
for personal, non-commercial use.</p>

<h2>7. No guarantee</h2>
<p>FirstReport is provided "as is". We do not promise that it will always be available, complete, accurate or
free of errors, and we may change or stop features at any time.</p>

<h2>8. Limitation of liability</h2>
<p>To the extent the law allows, FirstReport is not liable for any loss or damage that comes from using, or being
unable to use, the service, or from relying on any summary. Nothing in these terms limits liability that cannot be
limited by law.</p>

<h2>9. Privacy</h2>
<p>How we handle personal information is explained in our <a href="/privacy">Privacy policy</a>.</p>

<h2>10. Changes to these terms</h2>
<p>We may update these terms. We will change the date above when we do, and tell signed-in readers about
significant changes. Continuing to use FirstReport after a change means you accept the new terms.</p>

<h2>11. Governing law</h2>
<p>These terms are governed by the laws of India.</p>

<h2>12. Contact</h2>
<p>Questions about these terms: ${mail}.</p>
`,
);
