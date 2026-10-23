// Demo alerts for mock mode. Made up for the prototype — not real events.
// Shape matches what the live service returns.

const min = 60_000;
const hour = 60 * min;

const sec = (cik, title) => ({
  title,
  url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=4`,
  publisher: 'SEC EDGAR',
});
const news = (publisher, title, slug) => ({ title, url: `https://example.com/${slug}`, publisher });

// [ticker, kind, headline, why, ageMs, sources]
const SEED = [
  ['ENB', 'threat', 'Guidance cut 15%, stock barely moved yet',
    'Enbridge lowered its full-year EBITDA guidance by 15%, citing delays on two pipeline projects. Shares are down only 0.4%, so the market may not have priced in the lower earnings yet.',
    35 * min,
    [news('Reuters', 'Enbridge cuts 2026 guidance 15% on pipeline delays', 'reuters/enb-guidance'),
     news('Bloomberg', 'Enbridge cuts guidance 15% as pipeline delays bite', 'bloomberg/enb-guidance'),
     news('Globe and Mail', 'Enbridge cuts 2026 guidance 15%, cites pipeline delays', 'globe/enb-guidance')]],
  ['META', 'opportunity', '3 insiders bought $4.1M this week',
    'Two directors and one officer bought $4.1M of Meta shares on the open market this week. Insiders sell for many reasons but usually buy for one: they think the shares are undervalued.',
    2 * hour,
    [sec('0001326801', 'Form 4: Director open-market purchase'),
     sec('0001326801', 'Form 4: Officer open-market purchase')]],
  ['STN.TO', 'threat', 'CEO departure announced, no successor named',
    'Stantec’s CEO resigned effective immediately and the board has begun a search without naming a successor. Sudden exits often stall strategy and can signal problems the market hasn’t seen yet.',
    75 * min,
    [news('Canadian Press', 'Stantec CEO resigns effective immediately', 'cp/stantec-ceo')]],
  ['AAPL', 'opportunity', 'Overreaction: -9% on news hitting <2% of revenue',
    'Shares fell 9% after a regulator blocked one accessory line that the company reports as under 2% of revenue. The core iPhone and services businesses are unaffected, so the drop may be larger than the impact.',
    5 * hour,
    [news('CNBC', 'Apple shares slide 9% after accessory ruling', 'cnbc/aapl-ruling'),
     news('Financial Times', 'Ruling hits Apple accessory unit, under 2% of sales', 'ft/aapl-accessory')]],
  ['NVDA', 'opportunity', 'Full-year outlook raised on data-center demand',
    'Nvidia raised its full-year forecast after another record data-center quarter. Raised guidance usually leads analysts to lift estimates over the following days.',
    26 * hour,
    [news('CNBC', 'Nvidia raises full-year outlook on data-center demand', 'cnbc/nvda-outlook')]],
  ['TSLA', 'threat', 'Regulator opens probe into driver-assist crashes',
    'A federal safety regulator opened an investigation covering the company’s driver-assist software. Outcomes range from no action to a recall or restrictions on a feature central to its valuation.',
    3 * 24 * hour,
    [news('Reuters', 'US regulator opens probe into Tesla driver-assist crashes', 'reuters/tsla-probe')]],
  ['SHOP.TO', 'opportunity', '2 insiders bought $1.2M after selloff',
    'Two executives bought $1.2M of shares on the open market after last week’s selloff. Buying into weakness is one of the stronger insider signals.',
    2 * 24 * hour,
    [news('SEDI summary', 'Shopify insiders report open-market purchases', 'sedi/shop')]],
];

// "New" alerts that appear while the app is open, to demo notifications.
const INCOMING = [
  ['META', 'threat', 'EU opens antitrust case into ad business',
    'The European Commission opened formal proceedings into how Meta uses data in its ad business. Fines can reach 10% of global revenue, though cases usually take years to resolve.',
    [news('Politico Europe', 'EU opens antitrust case into Meta advertising', 'politico/meta-eu')]],
  ['ENB', 'opportunity', 'Insider bought $2.3M two days after guidance cut',
    'A director bought $2.3M of Enbridge shares on the open market two days after the guidance cut. That suggests at least one insider thinks the selloff went too far.',
    [news('SEDI summary', 'Enbridge director reports open-market purchase', 'sedi/enb')]],
  ['AAPL', 'threat', 'Supplier warns of iPhone component shortage',
    'A key supplier warned that a component shortage could limit iPhone shipments next quarter. The stock has not reacted yet.',
    [news('Nikkei Asia', 'Apple supplier flags component shortage', 'nikkei/aapl-supplier')]],
];

let counter = 0;
function build([ticker, kind, headline, whyItMatters, ageMs, sources], now) {
  const createdAt = new Date(now - ageMs).toISOString();
  return {
    id: `demo_${ticker}_${counter++}`,
    ticker,
    kind,
    headline,
    whyItMatters,
    createdAt,
    sources: sources.map((s) => ({ ...s, publishedAt: createdAt })),
  };
}

export function seedAlerts(now = Date.now()) {
  return SEED.map((row) => build(row, now));
}

export function incomingAlertFor(watchlist, usedIds) {
  const row = INCOMING.find((r) => watchlist.includes(r[0]) && !usedIds.has(r[2]));
  if (!row) return null;
  usedIds.add(row[2]);
  const [ticker, kind, headline, why, sources] = row;
  return build([ticker, kind, headline, why, 0, sources], Date.now());
}
