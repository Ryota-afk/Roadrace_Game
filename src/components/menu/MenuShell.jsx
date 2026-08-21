// カイロソフト式メニューの見た目（右下トグルボタン＋左スライドパネル＋大ジャンル/小ジャンルの
// 2階層ドリルダウン）。Step13第2弾。ゲーム固有の描画先（各セクションの実体）には一切依存しない
// 純粋な提示コンポーネント——categoriesとコールバックだけを受け取る。
// 第13弾Phase3-D-4-a: 新トークンTへ移行。角丸・影・枠線を撤去し面の濃淡のみで区切る。
// 開閉ボタンの「✕/☰」だけは開閉状態を表す記号として機能しているため残す。
import React from "react";
import { T, FONT_DOT } from "../../data/theme.js";

export function MenuShell({ categories, menuState, openMenu, closeMenu, selectCategory, backToCategories, selectSection }) {
  const { open, cat } = menuState;
  const activeCat = cat ? categories.find(c => c.key === cat) : null;

  return (
    <>
      <button onClick={open ? closeMenu : openMenu} aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 1100, width: 52, height: 52,
          background: T.color.accent, color: T.color.bg, border: "none", cursor: "pointer",
          fontSize: 20, fontFamily: FONT_DOT,
        }}>
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1050 }} onClick={closeMenu}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 260, maxWidth: "78vw",
              background: T.color.surface, display: "flex", flexDirection: "column", fontFamily: FONT_DOT,
            }}>
            <div style={{ padding: `${T.space.md}px ${T.space.md}px ${T.space.sm}px`, borderBottom: `1px solid ${T.color.rule}` }}>
              <div style={{ fontSize: T.size.head, color: T.color.text }}>
                {activeCat ? activeCat.label : "メニュー"}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: T.space.sm }}>
              {!activeCat && categories.map(c => (
                <button key={c.key} onClick={() => c.sections ? selectCategory(c.key) : selectSection(c.key)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    background: "none", border: "none", borderTop: `1px solid ${T.color.rule}`, padding: `${T.space.sm}px ${T.space.xs}px`,
                    cursor: "pointer", color: T.color.text, fontSize: T.size.body, fontFamily: FONT_DOT,
                  }}>
                  {c.label}
                </button>
              ))}
              {activeCat && (
                <>
                  <button onClick={backToCategories}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: "none", border: "none", padding: `${T.space.xs}px`, marginBottom: T.space.xs,
                      cursor: "pointer", color: T.color.sub, fontSize: T.size.caption, fontFamily: FONT_DOT,
                    }}>
                    ← 戻る
                  </button>
                  {activeCat.sections.map(sec => (
                    <button key={sec.key} onClick={() => selectSection(sec.key)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: T.color.surfaceUp, border: "none", padding: `${T.space.sm}px ${T.space.sm}px`, marginBottom: 2,
                        cursor: "pointer", color: T.color.text, fontSize: T.size.body, fontFamily: FONT_DOT,
                      }}>
                      {sec.label}
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
