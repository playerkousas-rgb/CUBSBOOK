import React, { useMemo, useState } from 'react';
import { useBook } from '../bookContext.js';
import { useLang } from '../i18n.jsx';
import { Icon, cx } from '../ui.jsx';
import Write from './Write.jsx';
import { SignModal } from './Ink.jsx';
import { today, interestProgress } from '@shared/book.js';

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
                            <span className="assrow__verified" title="cubadge 領袖已核實">
                              <Icon name="verified" size={11} /> cubbadge · {isEn ? 'verified' : '已核實'}
                            </span>
                          )}
                        </div>
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
                <p className="interestbox__list">
                  {(segment.activityRequirement.allowedBadgeIds || [])
                    .map((id) => book.otherBadges?.[id]?.date && id)
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
        defaultTitle={isEn ? 'Assessor / Cub Scout Leader' : '主考／幼童軍領袖'}
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
        defaultTitle={isEn ? 'Cub Scout Leader' : '幼童軍團長'}
        onSave={(sig) => {
          set({ signature: sig, presentedBy: row.presentedBy || sig.name || '' });
          setSignOpen(false);
        }}
      />
    </div>
  );
}
