#!/usr/bin/env node
/**
 * build_syllabus.mjs — 由幼童軍旅團進度系統（cubbadge）`data/items.json` 生成
 * CUBBOOK 的單一真相題庫 `shared/syllabus.js`，同時輸出離線對齊測試用的
 * 精簡 ID 快照 `tests/fixtures/cubbadge-ids.json`。
 *
 * 用法（需要先 clone cubsbadge）：
 *   node scripts/build_syllabus.mjs ../cubsbadge/data/items.json
 *   CUBBADGE_DIR=../cubsbadge node scripts/build_syllabus.mjs
 *
 * 鐵律：本檔只「映射」官方編號，不新增、不改寫、不排序、不合併任何官方項目。
 *   - `L1-*` / `L2-*` / `L3-*` / `L4-*` = 會員章及三個箭章（體驗／歷奇／高級歷奇）
 *   - `OT-*` = 活動徽章、專科徽章及金紫荊獎章（`OT-GB`）
 *   每個項目同時保留 `badgeId`（= cubsbadge 官方編號 `a`…`i`、`1.1.1`…`4.4.2`、`A01`…），
 *   因此 BOOK ⇄ BADGE 同步零重打、零改名。
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 獎章鍵 → 紀錄冊前綴（BADGE 的內部鍵不作改動，只作映射） */
const BADGE_PREFIX = {
  MEMBERSHIP: 'L1',
  P1: 'L2',
  P2: 'L3',
  P3: 'L4',
  P4: 'OT-GB',
};

/** 舊制箭章名稱：紙本《幼童軍紀錄冊》沿用，BOOK 必須同時標示 */
const LEGACY_NAMES = {
  L1: { zh: '會員章', en: 'Membership Badge' },
  L2: { zh: '銅箭章', en: 'Bronze Arrow' },
  L3: { zh: '銀箭章', en: 'Silver Arrow' },
  L4: { zh: '金箭章', en: 'Gold Arrow' },
  'OT-GB': { zh: '金紫荊獎章', en: 'Golden Bauhinia Award' },
};

/** 官方段名英文（對齊 cubsbadge 綱要四個範疇） */
const SEGMENT_EN = {
  SKILLS: 'Scoutcraft',
  CARING: 'Caring for Self and Others',
  COUNTRY: 'Country and Community',
  FAMILY: 'Scout Family',
  INTEREST: 'Interest Areas',
};

/** 官方興趣範疇要求（中文原文摘要）＋英文工作譯本 */
const INTEREST_TEXT = {
  zh:
    '從「多元創藝」、「科學與大自然」、「運動與愛好」中選取兩個不同類別，各完成一個指定活動徽章；' +
    '已用於較低階獎章的徽章不得重複（三級制徽章可用更高級別）。',
  en:
    'Choose two different areas from “Creative Arts”, “Science & Nature” and “Sports & Hobbies”, and complete one listed activity badge in each. ' +
    'A badge already used for a lower award may not be reused (a higher level of a three-level badge may be).',
};

/** 72 項官方核心細項英文工作譯本（官方中文原文為準） */
const ITEM_EN = {
  'L1-A': 'Origins of the Scout Movement',
  'L1-B': 'Know the Scout Family',
  'L1-C': 'Promise, Law and Motto',
  'L1-D': 'Know the Cub Scout Badges',
  'L1-E': 'The Jungle Book Story',
  'L1-F': 'Calls and Hand Signs',
  'L1-G': 'Scout Ceremonies and Courtesy',
  'L1-H': 'Know Your Group and Pack',
  'L1-I': 'Safe from Harm',

  'L2-SKILLS-01': 'Sensory nature exploration',
  'L2-SKILLS-02': 'Looking after your own kit',
  'L2-SKILLS-03': 'Weather watch',
  'L2-CARING-01': 'A healthy daily routine',
  'L2-CARING-02': 'Helping hands at home and school',
  'L2-CARING-03': 'A healthy snack box',
  'L2-COUNTRY-01': 'My community map',
  'L2-COUNTRY-02': 'A visit to a community facility',
  'L2-COUNTRY-03': 'Chinese festivals and their origins',
  'L2-FAMILY-01': 'Working together in the Six',
  'L2-FAMILY-02': 'Scarves, badges and equipment',
  'L2-FAMILY-03': 'Pack call and formation',

  'L3-SKILLS-01': 'Tracking',
  'L3-SKILLS-02': 'Knots',
  'L3-SKILLS-03': 'Countryside Code',
  'L3-CARING-01': 'Keeping fit and healthy',
  'L3-CARING-02': 'Personal cleanliness',
  'L3-CARING-03': 'Home safety',
  'L3-CARING-04': 'A good turn every day',
  'L3-CARING-05': 'First aid and protecting yourself',
  'L3-COUNTRY-01': 'Hong Kong and the Nation',
  'L3-COUNTRY-02': 'National and Regional Flags, Emblems and Anthem',
  'L3-COUNTRY-03': 'Flag-raising and anthem etiquette',
  'L3-COUNTRY-04': 'Chinese-style drill',
  'L3-COUNTRY-05': 'Know your community',
  'L3-FAMILY-01': 'Know the Scout Family',
  'L3-FAMILY-02': 'The Jungle Book Story',
  'L3-FAMILY-03': 'The Promise and Law',

  'L4-SKILLS-01': 'Knots and lashings',
  'L4-SKILLS-02': 'Maps and compass',
  'L4-SKILLS-03': 'Hiking',
  'L4-SKILLS-04': 'Holiday camp or camping',
  'L4-CARING-01': 'Keeping in good shape',
  'L4-CARING-02': 'Caring for the injured',
  'L4-CARING-03': 'Special good turns',
  'L4-CARING-04': 'Protecting yourself',
  'L4-CARING-05': 'Safety knowledge',
  'L4-COUNTRY-01': 'Understanding national identity',
  'L4-COUNTRY-02': 'Community facilities',
  'L4-COUNTRY-03': 'School and Pack',
  'L4-COUNTRY-04': 'Places of worship and museums',
  'L4-COUNTRY-05': 'Chinese culture',
  'L4-COUNTRY-06': 'Chinese-style drill',
  'L4-FAMILY-01': 'Know the Scout Family',
  'L4-FAMILY-02': 'Jungle dance',
  'L4-FAMILY-03': 'The Promise and Law',

  'OT-GB-SKILLS-01': 'Fire lighting and backwoods cooking',
  'OT-GB-SKILLS-02': 'Knots and pioneering',
  'OT-GB-SKILLS-03': 'Camping',
  'OT-GB-SKILLS-04': 'Maps and compass',
  'OT-GB-SKILLS-05': 'Hiking',
  'OT-GB-CARING-01': 'First aid knowledge',
  'OT-GB-CARING-02': 'Special good turns',
  'OT-GB-CARING-03': 'Assisting the Cub Scout Leader',
  'OT-GB-CARING-04': 'Understanding emotions',
  'OT-GB-CARING-05': 'Caring for the community',
  'OT-GB-COUNTRY-01': 'The Nation, law and civic duty',
  'OT-GB-COUNTRY-02': 'Community emergency services',
  'OT-GB-COUNTRY-03': 'District and Headquarters',
  'OT-GB-COUNTRY-04': 'Hong Kong heritage',
  'OT-GB-COUNTRY-05': 'Chinese-style drill',
  'OT-GB-FAMILY-01': 'Know the Scout Family',
  'OT-GB-FAMILY-02': 'The Promise and Law',
};

const CATEGORY_ORDER = ['SCOUT_SKILLS', 'CARING', 'CREATIVE', 'COUNTRY', 'SCIENCE', 'SPORTS', 'OTHER'];

function pickSourcePath() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const candidates = [];
  if (process.env.CUBBADGE_DIR) candidates.push(path.join(path.resolve(process.env.CUBBADGE_DIR), 'data', 'items.json'));
  // 常見的本地 clone 位置：與 CUBBOOK 並排、或 repo 內 vendor 目錄
  candidates.push(path.join(ROOT, '..', 'cubsbadge', 'data', 'items.json'));
  candidates.push(path.join(ROOT, 'vendor', 'cubbadge-items.json'));
  candidates.push(path.join(ROOT, 'node_modules', '.cache', 'cubbadge-items.json'));
  const hit = candidates.find((p) => fs.existsSync(p));
  return hit || candidates[0];
}

function segmentSuffix(code) {
  const parts = String(code || '').split('-');
  return parts.length > 1 ? parts.slice(1).join('-') : 'MAIN';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function buildSegment(prefix, segment, badgePrefix) {
  const suffix = segmentSuffix(segment.code);
  const items = (segment.items || []).map((item, index) => {
    const canonical =
      prefix === 'L1' ? `${prefix}-${suffix}` : `${prefix}-${suffix}-${pad(index + 1)}`;
    const en = ITEM_EN[canonical];
    if (!en) throw new Error(`缺少英文工作譯本：${canonical}（${item.name}）`);
    return {
      id: canonical,
      badgeId: String(item.id),
      name: String(item.name || '').trim(),
      en,
      detail: String(item.detail || '').trim(),
      ...(Array.isArray(item.markers) && item.markers.length ? { markers: item.markers.slice() } : {}),
      ...(item.requiredBadgeId ? { requiredBadgeId: `OT-${item.requiredBadgeId}` } : {}),
      ...(Array.isArray(item.alternativeBadgeIds) && item.alternativeBadgeIds.length
        ? { alternativeBadgeIds: item.alternativeBadgeIds.map((id) => `OT-${id}`) }
        : {}),
    };
  });

  const isInterest = suffix === 'INTEREST';
  const requirement = isInterest ? INTEREST_TEXT : null;

  return {
    code: `${prefix}-${suffix}`,
    name: String(segment.name || '').trim(),
    en: isInterest ? SEGMENT_EN.INTEREST : SEGMENT_EN[suffix] || '',
    ...(segment.part ? { part: String(segment.part) } : {}),
    ...(requirement ? { requirement: requirement.zh, requirementEn: requirement.en } : {}),
    ...(segment.activityRequirement
      ? {
          activityRequirement: {
            categories: (segment.activityRequirement.categories || []).slice(),
            distinctCategories: Number(segment.activityRequirement.distinctCategories || 2),
            badgesPerCategory: Number(segment.activityRequirement.badgesPerCategory || 1),
            allowedBadgeIds: (segment.activityRequirement.allowedBadgeIds || []).map((id) => `OT-${id}`),
          },
        }
      : {}),
    items,
  };
}

function buildGroup(badge, prefix) {
  const legacy = LEGACY_NAMES[prefix] || { zh: badge.name, en: badge.name_en || '' };
  return {
    id: prefix,
    badgeKey: String(badge.id),
    icon: badge.icon || '🏅',
    name: String(badge.name).trim(),
    en: String(badge.name_en || '').trim(),
    legacyZh: legacy.zh,
    legacyEn: legacy.en,
    color: prefix === 'L1' ? '#1f4d2b' : prefix === 'L2' ? '#8a5a00' : prefix === 'L3' ? '#41597a' : prefix === 'L4' ? '#7a3410' : '#5b3f7a',
    purpose: String(badge.description || '').trim(),
    description: String(badge.completionNote || badge.description || '').trim(),
    eligibility: String(badge.eligibility || '').trim(),
    segments: (badge.segments || []).map((segment) => buildSegment(prefix, segment, badge.id)),
  };
}

function main() {
  const sourcePath = pickSourcePath();
  if (!fs.existsSync(sourcePath)) {
    console.error(`找不到 cubsbadge 題庫：${sourcePath}`);
    console.error('請先 clone playerkousas-rgb/cubsbadge 至與本 repo 並排的位置，或：');
    console.error('  CUBBADGE_DIR=/path/to/cubsbadge npm run syllabus');
    console.error('  node scripts/build_syllabus.mjs /path/to/cubsbadge/data/items.json');
    process.exit(1);
  }

  const raw = fs.readFileSync(sourcePath);
  const sha256 = crypto.createHash('sha256').update(raw).digest('hex');
  const data = JSON.parse(raw.toString('utf8'));
  const byKey = Object.fromEntries((data.badges || []).map((b) => [b.id, b]));
  for (const key of Object.keys(BADGE_PREFIX)) {
    if (!byKey[key]) throw new Error(`cubadge items.json 缺少獎章鍵 ${key}`);
  }

  const groups = ['MEMBERSHIP', 'P1', 'P2', 'P3'].map((key) =>
    buildGroup(byKey[key], BADGE_PREFIX[key]),
  );
  const gold = buildGroup(byKey.P4, 'OT-GB');

  const otherBadges = (data.otherBadges || [])
    .slice()
    .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    .map((b) => ({
      id: `OT-${b.id}`,
      badgeId: String(b.id),
      catalogueNo: String(b.catalogueNo || ''),
      name: String(b.name || '').trim(),
      en: String(b.name_en || '').trim(),
      category: String(b.category || ''),
      categoryName: String(b.categoryName || '').trim(),
      categoryNameEn: String(b.categoryName_en || '').trim(),
      icon: b.icon || '⭐',
      description: String(b.desc || '').trim(),
    }));

  const allItems = [...groups, gold].flatMap((g) =>
    g.segments.flatMap((s) => s.items.map((i) => ({ ...i, badge: g.id }))),
  );

  const payload = {
    meta: {
      version: '1.0.0',
      app: 'CUBBOOK',
      scheme: String(data.meta?.scheme || '幼童軍訓練綱要'),
      schemeEdition: String(data.meta?.schemeEdition || ''),
      effectiveDate: String(data.meta?.effectiveDate || ''),
      badgeSource: 'cubbadge · data/items.json',
      badgeSourceSha256: sha256,
      itemCount: allItems.length,
      otherBadgeCount: otherBadges.length,
      note:
        'BOOK 內部鍵為 L1-*／L2-*／L3-*／L4-*／OT-*；每個項目同時保留 cubsbadge 官方 badgeId，' +
        '同步時以 badgeId 對照，零改名、零重打。官方中文原文為準，英文為工作譯本。',
    },
    groups,
    gold,
    otherBadges,
  };

  const body = `// ==========================================================================
// CUBBOOK — shared/syllabus.js（自動生成，請勿手改）
// 生成指令：node scripts/build_syllabus.mjs <cubsbadge>/data/items.json
// 單一真相：cubbadge · data/items.json（sha256 ${sha256.slice(0, 16)}…）
// 內部項目編號 L1-* / L2-* / L3-* / L4-* / OT-*，每項附 badgeId 對照官方編號。
// 官方中文原文為準；英文為工作譯本。
// ==========================================================================

export const SYLLABUS_META = ${JSON.stringify(payload.meta, null, 2)};

/** 進度性獎章：會員章 → 銅箭章（體驗章）→ 銀箭章（歷奇章）→ 金箭章（高級歷奇章） */
export const BADGE_SYLLABUS = ${JSON.stringify(payload.groups, null, 2)};

/** 金紫荊獎章：OT-GB-* 細項（統一歸入 OT-* 系列） */
export const GOLD_AWARD = ${JSON.stringify(payload.gold, null, 2)};

/** 活動徽章／專科徽章：OT-A01…（單一完成紀錄：日期＋證書編號） */
export const OTHER_BADGES = ${JSON.stringify(payload.otherBadges, null, 2)};

export const ALL_AWARDS = [...BADGE_SYLLABUS, GOLD_AWARD];

/** 所有細項（L1–L4 及金紫荊） */
export const SYLLABUS_ITEMS = ALL_AWARDS.flatMap((badge) =>
  badge.segments.flatMap((segment) =>
    segment.items.map((item) => ({ ...item, badgeIdGroup: badge.id, segmentCode: segment.code })),
  ),
);

export const ITEM_INDEX = Object.fromEntries(SYLLABUS_ITEMS.map((item) => [item.id, item]));

/** BOOK 鍵 → cubsbadge 官方編號 */
export const BOOK_TO_BADGE_ID = Object.fromEntries([
  ...SYLLABUS_ITEMS.map((item) => [item.id, item.badgeId]),
  ...OTHER_BADGES.map((badge) => [badge.id, badge.badgeId]),
]);

/** cubsbadge 官方編號 → BOOK 鍵（同時接受已遷移至 L1–L4／OT 系列的新舊兩種寫法） */
export const BADGE_ID_TO_BOOK = (() => {
  const out = {};
  for (const [bookId, badgeId] of Object.entries(BOOK_TO_BADGE_ID)) {
    out[badgeId] = bookId;
    out[bookId] = bookId;
  }
  return out;
})();

const norm = (value) => String(value ?? '').trim();

/** 任何來源的項目編號 → BOOK 內部鍵（未知編號原樣回傳，不靜默改寫）。 */
export function toBookId(id) {
  const key = norm(id);
  if (!key) return '';
  return BADGE_ID_TO_BOOK[key] || key;
}

/** BOOK 內部鍵 → cubsbadge 官方編號。 */
export function toBadgeId(id) {
  const key = norm(id);
  if (!key) return '';
  return BOOK_TO_BADGE_ID[key] || key;
}

/** 該項目是否屬於本紀錄冊的現行綱要（用於同步時丟棄未知／他人資料）。 */
export function isKnownItem(id) {
  const key = norm(id);
  return Boolean(key) && (Boolean(ITEM_INDEX[key]) || OTHER_BADGES.some((b) => b.id === key));
}

/** 給定 BOOK 鍵，找回獎章群組（L1–L4 / OT-GB / 其他徽章）。 */
export function awardOfItem(id) {
  const key = norm(id);
  const badge = ALL_AWARDS.find((b) => b.segments.some((s) => s.items.some((i) => i.id === key)));
  if (badge) return badge;
  return OTHER_BADGES.find((b) => b.id === key) || null;
}
`;

  const outPath = path.join(ROOT, 'shared', 'syllabus.js');
  fs.writeFileSync(outPath, body, 'utf8');

  const fixture = {
    meta: {
      source: 'cubbadge · data/items.json',
      sha256,
      scheme: payload.meta.scheme,
      generatedBy: 'scripts/build_syllabus.mjs',
    },
    progressIds: allItems.map((i) => i.badgeId),
    otherBadgeIds: otherBadges.map((b) => b.badgeId),
    badgeKeys: Object.keys(BADGE_PREFIX),
  };
  const fixturePath = path.join(ROOT, 'tests', 'fixtures', 'cubbadge-ids.json');
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

  console.log(`✓ shared/syllabus.js — ${allItems.length} 項細項、${otherBadges.length} 個活動徽章`);
  console.log(`✓ tests/fixtures/cubbadge-ids.json — 對齊快照（sha256 ${sha256.slice(0, 16)}…）`);
}

main();
