// 汎用UIコンポーネント（Btn/Eyebrow）。Phase 3で main.jsx から分離。
import React from "react";
import { C, FONT_D } from "../data/theme.js";

export function Btn({ children, onClick, disabled, color = C.yellow, small, outline, style }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        fontFamily: FONT_D, letterSpacing: "0.05em",
        background: disabled ? C.panel2 : outline ? "transparent" : color,
        color: disabled ? "#6b7386" : outline ? color : "#14171d",
        border: outline ? `1.5px solid ${disabled ? "#6b7386" : color}` : "none",
        borderRadius: 6, padding: small ? "6px 12px" : "12px 18px",
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: disabled ? "default" : "pointer",
        width: small ? "auto" : "100%", ...style,
      }}>{children}</button>
  );
}

export function Eyebrow({ children, color = C.yellow }) {
  return <div style={{ fontFamily: FONT_D, color, fontSize: 12, letterSpacing: "0.2em", fontWeight: 700 }}>{children}</div>;
}
