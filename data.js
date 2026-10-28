// Static reference data: avatar palette, status config, built-in templates.
// Templates are seed data — once copied into state.db.templates on first unlock,
// the user can edit them without this file being touched again.

export const AVATAR_COLORS = [
  { bg: '#e8e5ff', fg: '#3730a3' },
  { bg: '#d1fae5', fg: '#064e3b' },
  { bg: '#fee2e2', fg: '#991b1b' },
  { bg: '#fef3c7', fg: '#78350f' },
  { bg: '#e0f2fe', fg: '#0c4a6e' },
  { bg: '#ede9fe', fg: '#4c1d95' },
  { bg: '#fdf4ff', fg: '#581c87' },
  { bg: '#fff7ed', fg: '#7c2d12' },
  { bg: '#f0fdf4', fg: '#14532d' },
  { bg: '#f0f9ff', fg: '#0c4a6e' }
];

export const STATUSES = {
  lead:   { label: 'Lead',      cls: 'st-lead' },
  active: { label: 'Active',    cls: 'st-active' },
  review: { label: 'In Review', cls: 'st-review' },
  hold:   { label: 'On Hold',   cls: 'st-hold' },
  done:   { label: 'Completed', cls: 'st-done' },
  paused: { label: 'Paused',    cls: 'st-paused' }
};

export const STATUS_ORDER = ['lead', 'active', 'review', 'hold', 'done', 'paused'];

export const PRIORITIES = {
  high:   { label: 'High',   cls: 'p-h' },
  medium: { label: 'Medium', cls: 'p-m' },
  low:    { label: 'Low',    cls: 'p-l' }
};

// Phase palette — each phase picks a color token used in CSS as var(--<name>).
export const PHASE_COLORS = ['indigo', 'vio', 'sky', 'or', 'teal', 'rose', 'amber', 'em'];

// Built-in WordPress build template.
// Shape: { id, name, phases: [ { id, label, icon, color, tasks: [ { title, hint, priority } ] } ] }
export const BUILTIN_TEMPLATES = [
  {
    id: 'wp_build',
    name: 'WordPress Build',
    description: 'Full WordPress site build from discovery through launch & growth.',
    phases: [
      {
        id: 'discovery', label: 'Discovery & Brief', icon: '🔍', color: 'indigo',
        tasks: [
          { title: 'Initial client intake form sent & received', hint: 'Niche, audience, competitors, goals, 3-word brand feel', priority: 'high' },
          { title: 'Competitor websites analysed (min 3)', hint: 'Screenshot what works — layout patterns, CTAs, messaging', priority: 'medium' },
          { title: 'Content audit of existing site', hint: 'What pages, copy & media can be reused vs rebuilt', priority: 'medium' },
          { title: 'Project scope defined and agreed', hint: 'Pages list, features, integrations, number of revisions', priority: 'high' },
          { title: 'Contract signed by client', hint: 'Scope, timeline, payment terms, late payment clause', priority: 'high' },
          { title: '50% deposit payment received', hint: 'No work starts until deposit clears — no exceptions', priority: 'high' },
          { title: 'Project timeline shared with client', hint: 'Day-by-day milestones, review checkpoints, launch date', priority: 'medium' }
        ]
      },
      {
        id: 'design', label: 'Design & Wireframe', icon: '🎨', color: 'vio',
        tasks: [
          { title: 'Inspiration board assembled', hint: '3–5 references from Godly / Land-book that match the vibe', priority: 'medium' },
          { title: 'Brand colour palette defined (60-30-10)', hint: 'Primary, secondary, neutral — approved by client', priority: 'high' },
          { title: 'Typography pair selected and locked', hint: 'Display + body — max 2 families from Google Fonts', priority: 'high' },
          { title: 'Page wireframes created for all pages', hint: 'Figma boxes or v0.dev — layout map per page', priority: 'high' },
          { title: 'Client wireframe approval received', hint: 'Written sign-off before building — prevents scope creep', priority: 'high' },
          { title: 'Icon / illustration set sourced', hint: 'Phosphor, Heroicons, Lucide, or custom', priority: 'low' },
          { title: 'Design system documented', hint: 'Colors, fonts, button styles, spacing scale', priority: 'low' }
        ]
      },
      {
        id: 'setup', label: 'WordPress Setup', icon: '⚙️', color: 'sky',
        tasks: [
          { title: 'Hosting environment provisioned', hint: 'Cloudways/GridPane staging — PHP 8.1+, SSL ready', priority: 'high' },
          { title: 'WordPress installed — default content deleted', hint: 'Remove Hello World post, Sample Page, default plugins', priority: 'high' },
          { title: 'Elementor Pro installed & activated', hint: 'License activated, safe mode off, performance mode on', priority: 'high' },
          { title: 'ACF Pro installed & activated', hint: 'License key entered and verified active', priority: 'high' },
          { title: 'WP Compress installed & configured', hint: 'API key connected, bulk compression settings saved', priority: 'high' },
          { title: 'WP Rocket installed', hint: 'Basic caching ON — fine-tune after full build', priority: 'high' },
          { title: 'RankMath Pro installed', hint: 'Setup wizard done, GSC connected', priority: 'high' },
          { title: 'Elementor Kit imported', hint: 'Personal kit loaded, globals updated to project palette', priority: 'high' },
          { title: 'Staging → Live workflow tested', hint: 'WP Migrate DB or Duplicator push tested on dummy', priority: 'medium' }
        ]
      },
      {
        id: 'build', label: 'Build & Development', icon: '⚡', color: 'or',
        tasks: [
          { title: 'Elementor Global Site Settings locked in', hint: 'Site-wide system before building', priority: 'high' },
          { title: 'Header built via Theme Builder', hint: 'Logo, nav, mobile hamburger, sticky scroll', priority: 'high' },
          { title: 'Footer built via Theme Builder', hint: 'Links, contact info, socials, copyright', priority: 'high' },
          { title: 'Homepage complete', hint: 'Hero / USP / Services / Proof / CTA / FAQ', priority: 'high' },
          { title: 'About page complete', hint: 'Story, team, values, mission, trust elements', priority: 'high' },
          { title: 'Services / Products pages complete', hint: 'Individual service pages with CTAs and schema', priority: 'high' },
          { title: 'Contact page with working form', hint: '3–4 fields max, delivery confirmed, spam protection', priority: 'high' },
          { title: 'Blog archive & single post template', hint: 'Loop + single — even if no posts yet', priority: 'medium' },
          { title: 'Privacy Policy & Terms pages', hint: 'Required for GDPR and cookie compliance', priority: 'medium' },
          { title: 'ACF repeater fields configured', hint: 'Testimonials, services, team — editable from WP admin', priority: 'medium' },
          { title: 'Custom 404 page built', hint: 'Branded with search field and homepage link', priority: 'low' },
          { title: 'All copy finalised and placed', hint: 'Client-approved — placeholders replaced', priority: 'high' },
          { title: 'All images placed with alt text', hint: 'WebP format, alt on every image element', priority: 'high' },
          { title: 'Popup / lead magnet (if required)', hint: 'Elementor Popup Builder — exit intent or delay', priority: 'low' }
        ]
      },
      {
        id: 'perf', label: 'Performance', icon: '🚀', color: 'teal',
        tasks: [
          { title: 'All images bulk-optimised via WP Compress', hint: 'WebP ON, lossless for logos, lossy for photos', priority: 'high' },
          { title: 'Hero image pre-compressed to <150KB', hint: 'Squoosh.app — WebP at 75% before upload', priority: 'high' },
          { title: 'WP Rocket page caching enabled', hint: 'Separate mobile cache, preload sitemap', priority: 'high' },
          { title: 'CSS & JS minification + concatenation ON', hint: 'Test each setting — can break Elementor widgets', priority: 'high' },
          { title: 'Lazy load for images & iframes ON', hint: 'Exclude hero image — LCP penalty', priority: 'high' },
          { title: 'Unused CSS removal enabled', hint: 'Per-page, test carefully', priority: 'medium' },
          { title: 'Google Fonts loaded locally', hint: 'OMGF plugin — eliminates external DNS lookup', priority: 'medium' },
          { title: 'Database optimised and cleaned', hint: 'WP-Optimize: drafts, spam, revisions, transients', priority: 'low' },
          { title: 'PageSpeed 85+ mobile confirmed', hint: 'pagespeed.web.dev — screenshot result', priority: 'high' },
          { title: 'PageSpeed 95+ desktop confirmed', hint: 'LCP <2.5s, CLS <0.1, INP <200ms', priority: 'high' }
        ]
      },
      {
        id: 'sec_hosting', label: 'Security — Hosting', icon: '🖥️', color: 'rose',
        tasks: [
          { title: 'Hosting has built-in malware scanning', hint: 'Server-level scanning for malware', priority: 'high' },
          { title: 'Automatic daily backups enabled at hosting level', hint: 'Separate from plugin backups — enable both', priority: 'high' },
          { title: 'SSL certificate active and HTTPS forced', hint: 'Force HTTP → HTTPS redirect in hosting panel', priority: 'high' },
          { title: 'ModSecurity enabled if available', hint: 'WAF at server level', priority: 'medium' },
          { title: 'File permissions correct — folders 755, files 644', hint: 'wp-config.php must be 600', priority: 'high' },
          { title: 'Dedicated database user per site — never root', hint: 'Minimum permissions only', priority: 'high' },
          { title: 'Minimum database permissions granted only', hint: 'SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP', priority: 'high' },
          { title: 'Strong unique database password set', hint: 'Store in password manager — never reuse', priority: 'high' },
          { title: 'Offsite backups via UpdraftPlus', hint: 'Google Drive — never only on same server', priority: 'high' },
          { title: 'Backup restoration test completed', hint: 'Restore on staging to confirm it works', priority: 'medium' },
          { title: 'Resource usage monitoring active', hint: 'Spikes often indicate active attack', priority: 'medium' },
          { title: 'PHP updated to latest stable version', hint: 'Outdated PHP has unpatched vulnerabilities', priority: 'high' }
        ]
      },
      {
        id: 'sec_cloudflare', label: 'Security — Cloudflare', icon: '🟠', color: 'or',
        tasks: [
          { title: 'Cloudflare proxy enabled — orange cloud ON', hint: 'All A records must be proxied, not grey', priority: 'high' },
          { title: 'HTTPS forced in Cloudflare SSL settings', hint: 'Always Use HTTPS → ON', priority: 'high' },
          { title: 'Bot Fight Mode enabled', hint: 'Blocks automated scrapers', priority: 'high' },
          { title: 'Automatic HTTPS rewrites enabled', hint: 'Edge Certificates → Automatic HTTPS Rewrites', priority: 'medium' },
          { title: 'Security level set to Medium minimum', hint: 'Security → Settings → Security Level', priority: 'medium' },
          { title: 'OWASP managed ruleset enabled', hint: 'WAF → Managed Rules → OWASP Core', priority: 'high' },
          { title: 'Rate limit wp-login.php to 5 req/min', hint: 'WAF Custom Rule — aggressive on login', priority: 'high' },
          { title: 'Block xmlrpc.php completely', hint: 'Custom WAF rule — URI contains xmlrpc.php → Block', priority: 'high' },
          { title: 'Block readme.html access', hint: 'Custom WAF rule — URI contains readme.html → Block', priority: 'medium' },
          { title: 'Block wp-config.php direct access', hint: 'Custom WAF rule — URI contains wp-config.php → Block', priority: 'high' },
          { title: 'wp-admin restricted to your IP', hint: 'Static IP WAF rule for admin access', priority: 'medium' },
          { title: 'Cloudflare analytics reviewed monthly', hint: 'Check for traffic spikes', priority: 'low' }
        ]
      },
      {
        id: 'sec_wordfence', label: 'Security — Wordfence', icon: '🛡️', color: 'indigo',
        tasks: [
          { title: 'Firewall set to Extended Protection mode', hint: 'Wordfence → Firewall → Manage', priority: 'high' },
          { title: 'Rate limiting enabled — not Unlimited', hint: 'Set limits for all categories', priority: 'high' },
          { title: 'Crawler and human request limits set', hint: 'Crawlers 240/min, humans 480/min', priority: 'medium' },
          { title: 'IPs blocked (not throttled) after rate limit', hint: 'Block > throttle for stronger protection', priority: 'medium' },
          { title: 'Brute force protection enabled', hint: 'Login Security → Brute Force Protection', priority: 'high' },
          { title: 'Lockout after 3 failed login attempts', hint: 'Both username and password', priority: 'high' },
          { title: 'Lockout duration 60 minutes minimum', hint: 'Longer is safer', priority: 'high' },
          { title: 'reCAPTCHA enabled on login page', hint: 'Login Security → reCAPTCHA', priority: 'high' },
          { title: 'reCAPTCHA enabled on registration', hint: 'Protects user creation form', priority: 'medium' },
          { title: '2FA enabled for all admin accounts', hint: 'Enforce for admin role', priority: 'high' },
          { title: 'Weekly automated scans scheduled', hint: 'Minimum weekly, daily preferred', priority: 'high' },
          { title: 'File change detection enabled', hint: 'Scan Options', priority: 'high' },
          { title: 'Plugin vulnerability alerts enabled', hint: 'Scan plugin files for CVEs', priority: 'high' },
          { title: 'Unknown core files detection enabled', hint: 'Scan vs WordPress.org repo', priority: 'medium' },
          { title: 'Manual full scan after every plugin update', hint: 'Scan immediately after updates', priority: 'medium' },
          { title: 'Alert ON: new admin user created', hint: 'Email alerts', priority: 'high' },
          { title: 'Alert ON: plugin installed or updated', hint: 'Email alerts', priority: 'high' },
          { title: 'Alert ON: file modifications detected', hint: 'Email alerts', priority: 'high' },
          { title: 'Alert ON: lost password used for admin', hint: 'Email alerts', priority: 'high' },
          { title: 'Alert ON: admin login with known device', hint: 'Email alerts', priority: 'medium' },
          { title: 'Activity log retention set to 30 days', hint: 'Not unlimited — causes DB bloat', priority: 'low' },
          { title: 'Live Traffic disabled if not monitoring', hint: 'Saves database space', priority: 'low' },
          { title: 'Scan data cleaned monthly', hint: 'Prevent DB bloat', priority: 'low' },
          { title: 'wfhits and wflogins tables truncated monthly', hint: 'Diagnostics → truncate', priority: 'low' }
        ]
      },
      {
        id: 'sec_wpghost', label: 'Security — WP Ghost', icon: '👻', color: 'vio',
        tasks: [
          { title: 'Login URL changed from /wp-admin', hint: 'Custom login URL — reduces bot traffic', priority: 'high' },
          { title: 'wp-content path changed to custom name', hint: 'Change Paths', priority: 'medium' },
          { title: 'wp-includes path changed to custom name', hint: 'Change Paths', priority: 'medium' },
          { title: 'WordPress version removed from source', hint: 'Hide WordPress → Remove version', priority: 'high' },
          { title: 'Generator meta tag removed', hint: 'Hide WordPress → Remove generator', priority: 'high' },
          { title: 'Theme/plugin names obfuscated', hint: 'Hide WordPress → Obfuscate', priority: 'medium' },
          { title: 'Security headers enabled', hint: 'All recommended headers', priority: 'high' },
          { title: 'Clickjacking protection enabled', hint: 'X-Frame-Options → SAMEORIGIN', priority: 'high' },
          { title: 'XSS protection headers enabled', hint: 'X-XSS-Protection → ON', priority: 'high' },
          { title: 'xmlrpc.php access blocked', hint: 'Block → Block XML-RPC', priority: 'high' },
          { title: '/wp-admin redirect removed for strangers', hint: 'Disable redirect for unknown users', priority: 'medium' }
        ]
      },
      {
        id: 'sec_manual', label: 'Security — Manual Hardening', icon: '🔧', color: 'amber',
        tasks: [
          { title: 'DISALLOW_FILE_EDIT = true in wp-config', hint: 'Prevents dashboard file editing', priority: 'high' },
          { title: 'DISALLOW_FILE_MODS = true in wp-config', hint: 'Blocks plugin installs from dashboard', priority: 'high' },
          { title: 'Fresh secret keys generated', hint: 'wordpress.org/secret-key — all 8 lines', priority: 'high' },
          { title: 'WP_DEBUG = false on live site', hint: 'Never expose PHP errors publicly', priority: 'high' },
          { title: 'Database table prefix changed from wp_', hint: 'Custom prefix e.g. site7x_', priority: 'medium' },
          { title: 'Secret keys rotated every 3 months', hint: 'Forces users to re-authenticate', priority: 'medium' },
          { title: '.htaccess: xmlrpc.php access blocked', hint: 'Deny rule in root .htaccess', priority: 'high' },
          { title: '.htaccess: wp-config.php protected', hint: 'order allow,deny / deny from all', priority: 'high' },
          { title: '.htaccess: directory browsing disabled', hint: 'Options -Indexes', priority: 'high' },
          { title: '.htaccess: .htaccess itself blocked', hint: 'Protect the protector file', priority: 'high' },
          { title: 'PHP execution blocked in /uploads/', hint: '.htaccess: deny *.php in uploads', priority: 'high' },
          { title: 'PHP execution blocked in /upgrade/', hint: '.htaccess: deny *.php in upgrade', priority: 'high' },
          { title: 'readme.html deleted from root', hint: 'Exposes WP version', priority: 'high' },
          { title: 'license.txt deleted from root', hint: 'Unnecessary file', priority: 'medium' },
          { title: 'wp-config-sample.php deleted', hint: 'Reveals DB structure', priority: 'high' },
          { title: 'xmlrpc.php deleted from root', hint: 'If not needed — strongest protection', priority: 'high' },
          { title: '/upgrade folder kept empty', hint: 'Clean after every update', priority: 'medium' },
          { title: 'No PHP files inside uploads folder', hint: 'Any .php in uploads = investigate', priority: 'high' },
          { title: 'File modification dates checked monthly', hint: 'Unexpected changes = red flag', priority: 'medium' }
        ]
      },
      {
        id: 'seo', label: 'SEO & Schema', icon: '📈', color: 'em',
        tasks: [
          { title: 'Unique title tag on every page', hint: 'Primary Keyword — Business Name | City', priority: 'high' },
          { title: 'Meta description on every page', hint: '150–160 chars, natural CTA', priority: 'high' },
          { title: 'H1 on every page (one only)', hint: 'Contains primary keyword', priority: 'high' },
          { title: 'Heading hierarchy correct (H1→H2→H3)', hint: 'No skipped levels', priority: 'medium' },
          { title: 'Local Business schema configured', hint: 'RankMath: NAP, hours, geo', priority: 'high' },
          { title: 'FAQ schema on relevant pages', hint: 'Eligible for rich results', priority: 'medium' },
          { title: 'XML sitemap submitted', hint: 'GSC and Bing', priority: 'high' },
          { title: 'Robots.txt correct', hint: 'Block wp-admin, staging noindex', priority: 'high' },
          { title: 'Internal linking structure set', hint: 'Homepage → Services → Contact flow', priority: 'medium' },
          { title: 'Google Search Console verified', hint: 'HTML tag via RankMath', priority: 'high' },
          { title: 'Google Analytics 4 installed', hint: 'GA4 property + data stream', priority: 'high' },
          { title: 'Open Graph meta images set', hint: '1200×630 OG image on key pages', priority: 'medium' },
          { title: 'Image file names are descriptive', hint: 'e.g. dental-clinic-sydney.webp', priority: 'low' }
        ]
      },
      {
        id: 'qa', label: 'QA & Testing', icon: '🧪', color: 'amber',
        tasks: [
          { title: 'Mobile responsiveness — every page', hint: 'Tablet (768px) and mobile (480px)', priority: 'high' },
          { title: 'Chrome desktop tested', hint: 'All pages, interactions, forms, hovers', priority: 'high' },
          { title: 'Safari (macOS + iOS) tested', hint: 'Most common browser differences', priority: 'high' },
          { title: 'Firefox tested', hint: 'Font rendering and flexbox', priority: 'medium' },
          { title: 'All forms tested end-to-end', hint: 'Submit each, check email + spam folder', priority: 'high' },
          { title: 'All internal links working — no 404s', hint: 'Screaming Frog or Broken Link Checker', priority: 'high' },
          { title: 'All CTA buttons link correctly', hint: 'Right destination for every button', priority: 'high' },
          { title: 'All images loading on all pages', hint: 'No missing or broken srcset', priority: 'high' },
          { title: 'Animations and motion effects working', hint: 'Elementor motion on all breakpoints', priority: 'medium' },
          { title: 'Cookie consent banner working', hint: 'GDPR compliant, blocks until consent', priority: 'medium' },
          { title: 'Accessibility basics checked', hint: 'Contrast, alt text, keyboard nav', priority: 'medium' },
          { title: 'Spelling and grammar reviewed', hint: 'Grammarly pass', priority: 'medium' },
          { title: 'Client review session completed', hint: 'Collect feedback in one session', priority: 'high' },
          { title: 'All revision requests implemented', hint: 'Document extras beyond contract', priority: 'high' }
        ]
      },
      {
        id: 'launch', label: 'Launch & Handoff', icon: '🚀', color: 'rose',
        tasks: [
          { title: 'Domain DNS pointed to live server', hint: 'Allow 24–48h propagation', priority: 'high' },
          { title: 'SSL certificate active and verified', hint: 'No mixed-content warnings', priority: 'high' },
          { title: 'Staging noindex confirmed before go-live', hint: 'Staging must not appear in Google', priority: 'high' },
          { title: 'Live site search indexing enabled', hint: 'Uncheck "Discourage search engines"', priority: 'high' },
          { title: '301 redirects from old URLs configured', hint: 'No broken inbound links', priority: 'medium' },
          { title: 'Live site smoke test completed', hint: '10 min: homepage, form, nav, mobile, SSL', priority: 'high' },
          { title: 'Loom client walkthrough recorded', hint: '5 min: editing, posts, forms', priority: 'high' },
          { title: 'Client WP admin training done', hint: 'Screen-share or Loom', priority: 'high' },
          { title: 'Final invoice sent', hint: '50% balance + late payment terms', priority: 'high' },
          { title: 'Final payment received', hint: 'Project closed on receipt', priority: 'high' },
          { title: 'All credentials handed over securely', hint: 'Via Bitwarden Send or 1Password', priority: 'high' },
          { title: 'Maintenance retainer offered', hint: '$99–149/mo: hosting, updates, backups', priority: 'medium' }
        ]
      },
      {
        id: 'post', label: 'Post-Launch & Growth', icon: '🌱', color: 'indigo',
        tasks: [
          { title: 'Day 7 check-in message sent', hint: 'Builds goodwill, catches bugs early', priority: 'high' },
          { title: 'Google review requested (Day 7–10)', hint: 'Direct link in message', priority: 'high' },
          { title: 'Written testimonial + photo collected', hint: 'Quote + name + role + headshot', priority: 'high' },
          { title: 'LinkedIn Before/After post published', hint: 'Tag the client', priority: 'medium' },
          { title: 'Portfolio case study published', hint: 'Screenshots + results + tech stack', priority: 'medium' },
          { title: 'Referral program communicated', hint: '$150 for referred business', priority: 'high' },
          { title: '30-day performance report sent', hint: 'GSC + GA4 + form submissions as PDF', priority: 'medium' },
          { title: 'SEO content roadmap offered (upsell)', hint: 'Monthly blog posts for local SEO', priority: 'low' }
        ]
      }
    ]
  }
];
