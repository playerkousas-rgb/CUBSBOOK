// 測試用「一般成員」紀錄冊（非示範）：只完成部分項目，部分已由領袖在 cubbadge 核實。
// 示範紀錄冊（`demoBook()`）一律不可同步或核簽，所以同步／核簽／匯出邏輯改用這本固定樣本測試。
// SCOUT ID 為測試專用假號碼，不是保留的示範編號（全零）。
import { newBook } from '../../shared/book.js';

export const SAMPLE_SCOUT_ID = '0012345678';
export const SAMPLE_CONFIRMED_AT = '2025-06-01T00:00:00.000Z';

export function sampleBook() {
  const book = newBook();
  book.member = {
    ...book.member,
    nameZh: '陳小狼',
    nameEn: 'CHAN Siu-long',
    scoutId: SAMPLE_SCOUT_ID,
    gender: 'M',
    dob: '2016-04-12',
    primaryLevel: '小四',
    school: '沙田第一小學',
    region: '新界東地域',
    district: '沙田北區',
    group: '沙田第 12 旅',
    pack: '沙田第 12 旅幼童軍團',
    csl: '陳志軒',
    cslPhone: '9123 4567',
    six: '棕狼隊',
    pob: '香港',
    dateJoined: '2023-09-01',
    dateInvestiture: '2023-11-25',
    groupAddress: '沙田新城市中央廣場 1 座 12 樓',
    hkidPrefix: 'A123',
    dateOfIssue: '2023-09-01',
    addressZh: '沙田禾輋邨康和樓 1203 室',
    parentName: '陳大文',
    parentPhone: '9876 5432',
    emergencyName: '陳大文（父）',
    emergencyPhone: '9876 5432',
  };
  const seed = [
    ['L1-A', '2023-09-16'],
    ['L1-B', '2023-09-23'],
    ['L1-C', '2023-09-30'],
    ['L1-D', '2023-10-07'],
    ['L1-E', '2023-10-14'],
    ['L1-F', '2023-10-21'],
    ['L1-G', '2023-10-28'],
    ['L1-H', '2023-11-04'],
    ['L1-I', '2023-11-11'],
    ['L2-SKILLS-01', '2024-01-13'],
    ['L2-SKILLS-02', '2024-01-20'],
    ['L2-CARING-01', '2024-02-03'],
    ['L3-SKILLS-01', '2025-01-11'],
    ['L3-SKILLS-02', '2025-01-18'],
  ];
  seed.forEach(([id, date]) => {
    book.progress[id] = { date, confirmedByBadge: true, confirmedAt: SAMPLE_CONFIRMED_AT };
  });
  book.otherBadges['OT-A01'] = { date: '2025-03-15', cert: 'ACT/2025/0181', confirmedByBadge: true };
  book.otherBadges['OT-A22'] = { date: '2025-05-10', cert: 'ACT/2025/0244' };
  book.otherBadges['OT-A26'] = { levels: { E: { date: '2025-03-15' } }, date: '2025-03-15' };
  book.pages.award_L1 = { date: '2023-11-25', certNo: 'MB/2023/0912', presentedBy: '陳志軒' };
  book.personalProgress = {
    ...book.personalProgress,
    membership: '2023-11-25',
    experience: '2024-06-15',
  };
  book.serviceStars = { ...book.serviceStars, y1: '2024-09-01', y2: '2025-09-01' };
  book.domains = {
    'L2-SKILLS': { examiner: '陳志軒', date: '2024-03-09' },
    'L2-CARING': { examiner: '陳志軒', date: '2024-04-13' },
    'L2-COUNTRY': { examiner: '陳志軒', date: '2024-05-11' },
    'L2-FAMILY': { examiner: '陳志軒', date: '2024-06-08' },
    'L3-SKILLS': { examiner: '陳志軒', date: '2025-01-11' },
    'SL-1': { examiner: '陳志軒', date: '2025-06-14' },
  };
  book.interest = {
    L3: {
      chosen: ['CREATIVE', 'SPORTS'],
      badges: {
        CREATIVE: { badgeId: 'OT-A12', examiner: '陳志軒', date: '2025-02-08' },
        SPORTS: { badgeId: 'OT-A28', examiner: '陳志軒', date: '2025-03-08' },
      },
    },
  };
  book.activities = [
    { date: '2025-10-04', text: '旅團大會操' },
    { date: '2025-11-15', text: '沙田區幼童軍大會操' },
    { date: '2025-12-20', text: '社區長者中心服務' },
  ];
  book.renewals = [
    { from: '2024-01-01', validUntil: '2024-12-31', leaderName: '陳志軒' },
    { from: '2025-01-01', validUntil: '2025-12-31', leaderName: '陳志軒' },
    { from: '2026-01-01', validUntil: '2027-12-31', leaderName: '陳志軒' },
  ];
  book.transfers = [{ date: '2025-08-01', group: '沙田第 15 旅' }];
  book.addressChanges = [{ date: '2025-08-15', address: '沙田石門安群街 3 號' }];
  return book;
}
