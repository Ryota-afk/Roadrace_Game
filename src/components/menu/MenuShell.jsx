// カイロソフト式メニューの見た目（右下トグルボタン＋左スライドパネル＋大ジャンル/小ジャンルの
// 2階層ドリルダウン）。Step13第2弾。ゲーム固有の描画先（各セクションの実体）には一切依存しない
// 純粋な提示コンポーネント——categoriesとコールバックだけを受け取る。
import React from "react";
import { C, FONT_D, FONT_B } from "../../data/theme.js";

export function MenuShell({ categories, menuState, openMenu, closeMenu, selectCategory, backToCategories, selectSection }) {
  const { open, cat } = menuState;
  const activeCat = cat ? categories.find(c => c.key === cat) : null;

  return (
    <>
      <button onClick={open ? closeMenu : openMenu} aria-label={open ? "メニューを閉じる" : "メニューを開く"}
        style={{
          position: "fixed", right: 18, bottom: 18, zIndex: 1100, width: 56, height: 56, borderRadius: "50%",
          background: open ? C.red : C.yellow, color: "#14171d", border: "none", cursor: "pointer",
          fontSize: 22, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
        }}>
        {open ? "✕" : "☰"}
      </button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1050 }} onClick={closeMenu}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", left: 0, top: 0, bottom: 0, width: 260, maxWidth: "78vw",
              background: C.panel, borderRight: `1px solid ${C.line}`, boxShadow: "4px 0 20px rgba(0,0,0,0.4)",
              display: "flex", flexDirection: "column", fontFamily: FONT_B,
            }}>
            <div style={{ padding: "16px 16px 10px", borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_D, fontSize: 16, fontWeight: 700, color: C.text }}>
                {activeCat ? activeCat.label : "メニュー"}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
              {!activeCat && categories.map(c => (
                <button key={c.key} onClick={() => selectCategory(c.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                    background: "none", border: "none", borderRadius: 8, padding: "12px 10px", marginBottom: 2,
                    cursor: "pointer", color: C.text, fontSize: 14.5, fontFamily: FONT_B,
                  }}>
                  <span style={{ fontSize: 20 }}>{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
              {activeCat && (
                <>
                  <button onClick={backToCategories}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left",
                      background: "none", border: "none", borderRadius: 8, padding: "10px", marginBottom: 6,
                      cursor: "pointer", color: C.sub, fontSize: 13, fontFamily: FONT_B,
                    }}>
                    ← 戻る
                  </button>
                  {activeCat.sections.map(sec => (
                    <button key={sec.key} onClick={() => selectSection(sec.key)}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 12px", marginBottom: 6,
                        cursor: "pointer", color: C.text, fontSize: 13.5, fontFamily: FONT_B,
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
