// 監督指示・シーズン中期目標の静的データ（Phase 4-1後の support.js から分離）。

export const MANAGER_DIRECTIVES = {
  ace: { key: "ace", label: "エースとして表彰台を狙え", desc: "チームの主力として3位以内でフィニッシュせよ",
    evalGain: 7, evalPenalty: 5, check: (rank) => rank <= 3 },
  breakthrough: { key: "breakthrough", label: "積極的な走りで上位進出せよ", desc: "上位30%以内でのフィニッシュを目指せ",
    evalGain: 5, evalPenalty: 2, check: (rank, total) => rank <= Math.max(3, Math.ceil(total * 0.3)) },
  support: { key: "support", label: "アシストとしてチームを支えよ", desc: "先頭集団に食らいついて完走せよ",
    evalGain: 3, evalPenalty: 1, check: (rank, total) => rank <= Math.max(5, Math.ceil(total * 0.6)) },
  experience: { key: "experience", label: "経験を積むために出走せよ", desc: "とにかく最後まで走り切れ",
    evalGain: 2, evalPenalty: 0, check: () => true },
};

// ── シーズン中期目標（スポンサーの約束）─────────────────────────────
// v40 第1候補②：単月の「指定レース」（見せ場ボーナス）や年間ノルマ（総pt）とは別に、シーズンの
// 複数レースにまたがる「中期目標」をスポンサーが提示する。達成すれば臨時ボーナス（資金＋ノルマ加算pt）、
// 期限月までに未達なら違約金。監督指示カードと同様、関数（match/desc）はセーブに載らないため id で引き直す。
export const SEASON_OBJECTIVES = {
  wins: {
    icon: "🏆", label: "常勝軍団",
    narr: "とにかく勝ち星を積み上げ、チームの名を轟かせてほしい。",
    desc: n => `種目を問わず通算${n}勝を挙げる`,
    match: ev => ev.won,
  },
  climb: {
    icon: "⛰", label: "山岳の覇者",
    narr: "険しい山でこそ、我が社の名を刻んでほしい。",
    desc: n => `登坂系レース（山岳ロード／ヒルクライム等）で通算${n}勝`,
    match: ev => ev.won && ev.favors === "CLM",
  },
  sprint: {
    icon: "🚀", label: "平坦の常勝",
    narr: "華やかなスプリント決着で観客を沸かせてほしい。",
    desc: n => `平坦系レース（クリテリウム等）で通算${n}回の表彰台`,
    match: ev => ev.podium && ev.favors === "SPR",
  },
  bigstage: {
    icon: "👑", label: "大舞台の栄光",
    narr: "格の高い大レースでの結果こそ、我が社の看板になる。",
    desc: n => `★★★グレードの大レースで通算${n}回の表彰台`,
    match: ev => ev.podium && ev.grade >= 3,
  },
  youth: {
    icon: "🌱", label: "新星の証明",
    narr: "若きスターを勝たせる姿勢を、世に示してほしい。",
    desc: n => `25歳以下の選手をエースに通算${n}勝`,
    match: ev => ev.won && ev.aceAge != null && ev.aceAge <= 25,
  },
};

