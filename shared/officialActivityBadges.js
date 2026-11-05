/**
 * 官方《幼童軍紀錄冊》第 21–27 頁「活動徽章紀錄」的逐頁編排。
 *
 * 依 2026 年版官方紀錄冊實際排版：
 *   21  童軍技能（2）＋ 關己愛人（7）
 *   22  關己愛人（4）＋ 國家與社區（1）＋ 多元創藝（3）
 *   23  多元創藝（8 行）＋ 科學與大自然（2）
 *   24  科學與大自然（5）＋ 運動與愛好（5 行）
 *   25  運動與愛好（11 行）
 *   26  運動與愛好（10 行）
 *   27  運動與愛好（世界友誼章）＋ 其他徽章（宗教章）
 *
 * 徽章本身仍以 shared/syllabus.js 的官方編號（A01…A41）為單一真相；
 * 本檔只描述「哪一頁、哪一範疇、哪幾個級別」，不新增徽章。
 */

export const ACTIVITY_DOMAINS = {
  SCOUT_SKILLS: { zh: '童軍技能', en: 'Scoutcraft', tone: 'green' },
  CARING: { zh: '關己愛人', en: 'Caring for Self and Others', tone: 'red' },
  COUNTRY: { zh: '國家與社區', en: 'Country and Community', tone: 'blue' },
  CREATIVE: { zh: '多元創藝', en: 'Diverse Creativity', tone: 'orange' },
  NATURE: { zh: '科學與大自然', en: 'Science and Nature', tone: 'teal' },
  SPORTS: { zh: '運動與愛好', en: 'Sports and Hobbies', tone: 'amber' },
  OTHER: { zh: '其他徽章', en: 'Other Badges', tone: 'purple' },
};

/** 設初／中／高級的徽章（官方以三行分列） */
export const LEVELED = {
  'OT-A18': { key: 'MUS', levels: ['E', 'I', 'A'] },
  'OT-A26': { key: 'ARC', levels: ['E', 'I', 'A'] },
  'OT-A27': { key: 'ATH', levels: ['E', 'I', 'A'] },
  'OT-A29': { key: 'CAN', levels: ['E', 'I', 'A'] },
  'OT-A33': { key: 'PARK', levels: ['E', 'I', 'A'] },
  'OT-A35': { key: 'PF', levels: ['E', 'I', 'A'] },
  'OT-A39': { key: 'SWIM', levels: ['E', 'I', 'A'] },
};

export const LEVEL_LABEL = {
  E: { zh: '初級', en: 'Elementary lv.' },
  I: { zh: '中級', en: 'Intermediate lv.' },
  A: { zh: '高級', en: 'Advanced lv.' },
};

/** 官方逐頁編排；`levels` 省略＝單一行，否則逐級一行 */
export const ACTIVITY_PAGE_PLAN = {
  21: [
    { domain: 'SCOUT_SKILLS', rows: [{ id: 'OT-A01' }, { id: 'OT-A02' }] },
    {
      domain: 'CARING',
      rows: [
        { id: 'OT-A03' },
        { id: 'OT-A04' },
        { id: 'OT-A05' },
        { id: 'OT-A06' },
        { id: 'OT-A07' },
        { id: 'OT-A08' },
        { id: 'OT-A09-CHILD-PROTECTION' },
      ],
    },
  ],
  22: [
    {
      domain: 'CARING',
      rows: [
        { id: 'OT-A09-ANTI-DECEPTION' },
        { id: 'OT-A09-ANTI-DRUG' },
        { id: 'OT-A09-COMMUNITY-EMERGENCY' },
        { id: 'OT-A09-GREEN-PIONEER' },
      ],
    },
    { domain: 'COUNTRY', rows: [{ id: 'OT-A10' }] },
    { domain: 'CREATIVE', rows: [{ id: 'OT-A12' }, { id: 'OT-A13' }, { id: 'OT-A14' }] },
  ],
  23: [
    {
      domain: 'CREATIVE',
      rows: [
        { id: 'OT-A15', zh: '資料科技章', en: 'Information Technology' },
        { id: 'OT-A16' },
        { id: 'OT-A17' },
        { id: 'OT-A18' },
        { id: 'OT-A19' },
        { id: 'OT-A20' },
      ],
    },
    { domain: 'NATURE', rows: [{ id: 'OT-A21' }, { id: 'OT-A22' }] },
  ],
  24: [
    {
      domain: 'NATURE',
      rows: [
        { id: 'OT-A23' },
        { id: 'OT-A24' },
        { id: 'OT-A25-PLASTIC' },
        { id: 'OT-A25-NATURE' },
        { id: 'OT-A25-SOLAR' },
      ],
    },
    {
      domain: 'SPORTS',
      rows: [
        { id: 'OT-A26' },
        { id: 'OT-A27', levels: ['E', 'I'] },
      ],
    },
  ],
  25: [
    {
      domain: 'SPORTS',
      rows: [
        { id: 'OT-A27', levels: ['A'] },
        { id: 'OT-A28' },
        { id: 'OT-A29' },
        { id: 'OT-A30' },
        { id: 'OT-A31' },
        { id: 'OT-A32' },
        { id: 'OT-A33' },
      ],
    },
  ],
  26: [
    {
      domain: 'SPORTS',
      rows: [
        { id: 'OT-A34' },
        { id: 'OT-A35' },
        { id: 'OT-A36' },
        { id: 'OT-A37' },
        { id: 'OT-A38' },
        { id: 'OT-A39' },
      ],
    },
  ],
  27: [
    { domain: 'SPORTS', rows: [{ id: 'OT-A40' }] },
    { domain: 'OTHER', rows: [{ id: 'OT-A41' }] },
  ],
};

/** 只出現在附錄（不屬本版官方紀錄冊） */
export const APPENDIX_ONLY_BADGES = ['OT-A11', 'OT-A09-EM-PIONEER', 'OT-A42'];

/** 展開一頁的所有行（含級別行），供頁面與統計使用 */
export function expandActivityPlan(planNo) {
  const sections = ACTIVITY_PAGE_PLAN[planNo] || [];
  return sections.map((sec) => ({
    domain: sec.domain,
    ...ACTIVITY_DOMAINS[sec.domain],
    rows: sec.rows.flatMap((row) => {
      const levels = row.levels || LEVELED[row.id]?.levels || [];
      if (!levels.length) return [{ ...row, level: null }];
      return levels.map((level) => ({ ...row, level }));
    }),
  }));
}

/** 所有官方頁面上的行（統計用） */
export function allOfficialActivityRows() {
  return Object.keys(ACTIVITY_PAGE_PLAN)
    .map(Number)
    .flatMap((no) => expandActivityPlan(no).flatMap((sec) => sec.rows.map((r) => ({ ...r, domain: sec.domain }))));
}
