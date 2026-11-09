import React, { useState } from 'react';
import { useBook } from '../bookContext.js';
import { useLang } from '../i18n.jsx';
import { Icon, cx } from '../ui.jsx';
import Write from './Write.jsx';
import { SignModal } from './Ink.jsx';
import {
  INTEREST_DOMAINS,
  interestDomainOptions,
  interestProgress,
  itemElectiveOptions,
  levelsOf,
  splitLevelRef,
  toBookId,
  today,
} from '@shared/book.js';

/**
 * AwardBlock — 進度性獎章細項表（對齊紙本「項目｜主考｜日期」三欄）。
 * 只顯示官方綱要細項名稱；詳細考驗內容可逐項展開，避免手機表格被文字塞爆。
 * 已由 cubbadge 核實的項目會標示金色「已核實」印記，不重複要求領袖簽名。
 */
export default function AwardBlock({ award, showDetail = false }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const [signItem, setSignItem] = useState(null);
  const [openDetail, setOpenDetail] = useState({});

  const setEntry = (id, patch) => {
    if (readOnly) return;
    update((b) => ({
      ...b,
      progress: {
        ...(b.progress || {}),
        [id]: { ...(b.progress?.[id] || {}), ...patch, at: new Date().toISOString() },
      },
    }));
  };

  const awardInterest = book.interest?.[award.id] || { chosen: [], badges: {} };
  const setInterestState = (patch) => {
    if (readOnly) return;
    update((b) => ({
      ...b,
      interest: { ...(b.interest || {}), [award.id]: { ...awardInterest, ...patch } },
    }));
  };
  const toggleInterestDomain = (code) => {
    if (readOnly) return;
    const chosen = awardInterest.chosen || [];
    setInterestState({
      chosen: chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code].slice(0, 2),
    });
  };
  const setInterestBadge = (code, patch) => {
    if (readOnly) return;
    const prevRow = awardInterest.badges?.[code] || {};
    const nextRow = { ...prevRow, ...patch };
    if (patch.badgeId && !nextRow.date) {
      const { id: rawId, level } = splitLevelRef(patch.badgeId);
      const baseId = toBookId(rawId);
      const otherEntry = book.otherBadges?.[baseId];
      const existingDate = level ? levelsOf(otherEntry)?.[level]?.date || otherEntry?.date : otherEntry?.date;
      if (existingDate) nextRow.date = existingDate;
    }
    const chosen = awardInterest.chosen || [];
    const nextChosen =
      patch.badgeId && !chosen.includes(code) && chosen.length < 2
        ? [...chosen, code]
        : chosen;
    setInterestState({
      chosen: nextChosen,
      badges: { ...(awardInterest.badges || {}), [code]: nextRow },
    });
  };

  const toggleDetail = (id) => setOpenDetail((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="awardblock">
      {award.segments.map((segment) => {
        const interest = segment.activityRequirement ? interestProgress(book, segment) : null;
        return (
          <section className="awardseg" key={segment.code}>
            <header className="awardseg__head">
              <h3>
                {isEn && segment.en ? segment.en : segment.name}
                {!isEn && segment.en && <em>{segment.en}</em>}
              </h3>
              {segment.part && <span className="awardseg__part">{isEn ? `Part ${segment.part}` : `${segment.part}部`}</span>}
              {segment.items.length > 0 && (
                <span className="awardseg__count">
                  {segment.items.filter((i) => book.progress?.[i.id]?.date).length}/{segment.items.length}
                </span>
              )}
            </header>

            {segment.items.length > 0 && (
              <div className="asstable">
                <div className="asstable__head">
                  <span className="asstable__c-item">{isEn ? 'Items' : '項目'}</span>
                  <span className="asstable__c-init">{isEn ? 'Assessor' : '主考'}</span>
                  <span className="asstable__c-date">{isEn ? 'Date' : '日期'}</span>
                </div>
                {segment.items.map((item, index) => {
                  const st = book.progress?.[item.id] || {};
                  const done = Boolean(st.date);
                  const detailOpen = openDetail[item.id] ?? showDetail;
                  const electiveOpts = itemElectiveOptions(item);
                  const selectedElective =
                    st.elective ||
                    (electiveOpts.length === 1 ? electiveOpts[0].id : '') ||
                    electiveOpts.find((o) => o.badgeId && book.otherBadges?.[o.badgeId]?.date)?.id ||
                    '';
                  return (
                    <div className={cx('assrow', done && 'is-done')} key={item.id}>
                      <div className="assrow__item">
                        <div className="assrow__text">
                          <span>
                            <b className="assrow__no">{isEn ? `${index + 1}.` : `${item.badgeId}`}</b>{' '}
                            {isEn && item.en ? item.en : item.name}
                            {Array.isArray(item.markers) &&
                              item.markers.map((m) => (
                                <sup className="assrow__mark" key={m} title={m === '*' ? '中途加入必修基礎' : '小草蜢章豁免指定內容'}>
                                  {m}
                                </sup>
                              ))}
                          </span>
                          {!isEn && item.en && <em>{item.en}</em>}
                          {st.confirmedByBadge && (
                            <span className="assrow__verified" title="cubbadge 領袖已核實">
                              <Icon name="verified" size={11} /> cubbadge · {isEn ? 'verified' : '已核實'}
                            </span>
                          )}
                        </div>
                        {electiveOpts.length > 0 && (
                          <div className="assrow__elective">
                            <span className="offselect">
                              <select
                                value={selectedElective}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const pickedOpt = electiveOpts.find((o) => o.id === val);
                                  const badgeDate = pickedOpt?.badgeId ? book.otherBadges?.[pickedOpt.badgeId]?.date : '';
                                  setEntry(item.id, {
                                    elective: val,
                                    ...(!st.date && badgeDate ? { date: badgeDate } : {}),
                                  });
                                }}
                                disabled={readOnly}
                                aria-label={`${item.name} 選修項目`}
                              >
                                <option value="">{isEn ? '— Select option —' : '— 請選擇完成方式／徽章 —'}</option>
                                {electiveOpts.map((opt) => (
                                  <option key={opt.id} value={opt.id}>
                                    {isEn ? opt.en : opt.zh}
                                  </option>
                                ))}
                              </select>
                            </span>
                          </div>
                        )}
                        {item.detail && (
                          <>
                            <button
                              type="button"
                              className="assrow__detailbtn no-print"
                              onClick={() => toggleDetail(item.id)}
                              aria-expanded={detailOpen}
                            >
                              {detailOpen ? (isEn ? 'Hide' : '收起內容') : isEn ? 'Contents' : '考驗內容'}
                            </button>
                            {detailOpen && <p className="assrow__detail">{item.detail}</p>}
                          </>
                        )}
                      </div>

                      <div className="assrow__init" data-label={isEn ? 'Assessor' : '主考'}>
                        {st.signature?.png ? (
                          <button
                            type="button"
                            className="assrow__sigbtn"
                            disabled={readOnly}
                            onClick={() => !readOnly && setSignItem(item)}
                            title={st.assessor || '主考簽名'}
                          >
                            <img src={st.signature.png} alt="簽名" />
                            {st.assessor && <small>{st.assessor}</small>}
                          </button>
                        ) : (
                          <div className="assrow__initwrap">
                            <Write
                              value={st.assessor || ''}
                              onChange={(v) => setEntry(item.id, { assessor: v })}
                              compact
                              placeholder={isEn ? 'Initials' : '主考'}
                              label={`${item.name} 主考`}
                            />
                            {!readOnly && (
                              <button
                                type="button"
                                className="assrow__pen no-print"
                                onClick={() => setSignItem(item)}
                                title={isEn ? 'Handwrite signature' : '手寫簽名'}
                                aria-label={isEn ? 'Sign' : '主考手寫簽名'}
                              >
                                <Icon name="pen" size={11} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="assrow__date" data-label={isEn ? 'Date' : '日期'}>
                        <Write
                          value={st.date || ''}
                          onChange={(d) => setEntry(item.id, { date: d })}
                          type="date"
                          compact
                          label={`${item.name} 日期`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {interest && (
              <div className="interestbox">
                <p className="interestbox__req">{isEn && segment.requirementEn ? segment.requirementEn : segment.requirement}</p>
                <p className={cx('interestbox__state', interest.satisfied && 'is-ok')}>
                  <Icon name={interest.satisfied ? 'check' : 'info'} size={13} />{' '}
                  {interest.satisfied
                    ? isEn
                      ? 'Interest requirement met'
                      : '興趣範疇要求已達成'
                    : isEn
                      ? `Choose ${interest.needed} listed activity badges from different areas`
                      : `尚需在指定清單中，於兩個不同範疇各完成 ${segment.activityRequirement.badgesPerCategory} 個活動徽章`}
                </p>
                <div className="offexam interestbox__exam">
                  {INTEREST_DOMAINS.map((d) => {
                    const picked = awardInterest.chosen?.includes(d.code);
                    const row = awardInterest.badges?.[d.code] || {};
                    const options = interestDomainOptions(award.id, d.category);
                    return (
                      <div className={cx('offexam__row', picked && 'is-picked')} key={d.code}>
                        <span className="offexam__no">
                          <button
                            type="button"
                            className={cx('offtick', picked && 'is-on')}
                            onClick={() => toggleInterestDomain(d.code)}
                            aria-pressed={picked}
                            aria-label={d.zh}
                          >
                            {picked ? '✓' : ''}
                          </button>
                          ({d.no})
                        </span>
                        <span className="offexam__name">
                          {isEn ? d.en : d.zh}
                          {!isEn && <em>{d.en}</em>}
                          <span className="offselect">
                            <select
                              value={row.badgeId || ''}
                              onChange={(e) => setInterestBadge(d.code, { badgeId: e.target.value })}
                              disabled={readOnly}
                              aria-label={`${d.zh} 徽章`}
                            >
                              <option value="">{isEn ? '— Select badge —' : '— 請選擇活動徽章 —'}</option>
                              {options.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {isEn ? b.en : b.zh || b.name}
                                </option>
                              ))}
                            </select>
                          </span>
                        </span>
                        <span className="offexam__cell">
                          <Write
                            value={row.examiner || ''}
                            onChange={(v) => setInterestBadge(d.code, { examiner: v })}
                            compact
                            placeholder={isEn ? 'Name' : '姓名'}
                            label={`${d.zh} 主考人`}
                          />
                        </span>
                        <span className="offexam__cell">
                          <Write
                            value={row.date || ''}
                            onChange={(v) => setInterestBadge(d.code, { date: v })}
                            type="date"
                            compact
                            label={`${d.zh} 日期`}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="interestbox__list">
                  {(interest.completedBadges || [])
                    .map((b) => (isEn ? b.en : b.zh))
                    .filter(Boolean)
                    .join('、') || (isEn ? 'None yet' : '尚未記錄')}
                </p>
              </div>
            )}
          </section>
        );
      })}

      <SignModal
        open={Boolean(signItem)}
        onClose={() => setSignItem(null)}
        title={signItem ? `${isEn ? 'Assessor Sign-off' : '主考簽核'} · ${signItem.name}` : ''}
        defaultName={signItem ? book.progress?.[signItem.id]?.assessor || '' : ''}
        defaultTitle=""
        onSave={(sig) => {
          if (signItem) {
            setEntry(signItem.id, {
              assessor: sig.name || book.progress?.[signItem.id]?.assessor || '',
              date: book.progress?.[signItem.id]?.date || sig.at || today(),
              signature: sig,
            });
          }
          setSignItem(null);
        }}
      />
    </div>
  );
}

/** 獎章頒發列：日期 + 證書編號 + 團長簽署（紙本「頒發」欄）。 */
export function AwardPresentation({ awardId, title, en }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const [signOpen, setSignOpen] = useState(false);
  const key = `award_${awardId}`;
  const row = book.pages?.[key] || {};
  const set = (patch) => {
    if (readOnly) return;
    update((b) => ({ ...b, pages: { ...(b.pages || {}), [key]: { ...(b.pages?.[key] || {}), ...patch } } }));
  };

  return (
    <div className="presentbox">
      <span className="presentbox__title">
        {isEn && en ? en : title}
        {!isEn && en && <em>{en}</em>}
      </span>
      <div className="presentbox__row">
        <label>
          <span>{isEn ? 'Date awarded' : '頒發日期'}</span>
          <Write value={row.date || ''} onChange={(v) => set({ date: v })} type="date" compact label="頒發日期" />
        </label>
        <label>
          <span>{isEn ? 'Certificate No.' : '證書編號'}</span>
          <Write value={row.certNo || ''} onChange={(v) => set({ certNo: v })} compact label="證書編號" />
        </label>
        <label>
          <span>{isEn ? 'Presented by' : '頒發人'}</span>
          <Write value={row.presentedBy || ''} onChange={(v) => set({ presentedBy: v })} compact label="頒發人" />
        </label>
        <div className="presentbox__sig">
          {row.signature?.png ? (
            <button type="button" className="assrow__sigbtn" onClick={() => !readOnly && setSignOpen(true)} disabled={readOnly}>
              <img src={row.signature.png} alt="簽名" />
              <small>{row.signature.name || (isEn ? 'Signed' : '已簽署')}</small>
            </button>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm no-print" onClick={() => setSignOpen(true)} disabled={readOnly}>
              <Icon name="pen" size={12} /> {isEn ? 'Leader signature' : '團長簽署'}
            </button>
          )}
        </div>
      </div>
      <SignModal
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title={isEn ? 'Presenting Leader' : '頒發領袖簽署'}
        defaultName={row.signature?.name || book.member?.csl || ''}
        defaultTitle=""
        onSave={(sig) => {
          set({ signature: sig, presentedBy: row.presentedBy || sig.name || '' });
          setSignOpen(false);
        }}
      />
    </div>
  );
}
