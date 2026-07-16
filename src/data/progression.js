// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const CLASSES = [
  { id: "B1", label: "クラス B1", prizeMul: 1.0, need: 45, scout: 58 },
  { id: "A",  label: "クラス A",  prizeMul: 2.0, need: 50, scout: 66 },
  { id: "PRO", label: "PRO", prizeMul: 3.5, need: 60, scout: 74 },
];

export const DIFFICULTIES = [
  { id: "easy", label: "イージー", desc: "他チームはかなり控えめ。まずはここでクリアを目指そう", aiMul: 0.80, growthCap: 88, needCP: 0 },
  { id: "normal", label: "ノーマル", desc: "標準的な強さ。歯応えのある本来のバランス", aiMul: 1.0, growthCap: 94, needCP: 4 },
  { id: "hard", label: "ハード", desc: "他チームは強豪揃い。選手の成長上限も上がるが、相手はさらに本気を出してくる", aiMul: 1.25, growthCap: 102, needCP: 10 },
  { id: "oni", label: "鬼", desc: "完全な無理ゲー。成長上限は大幅に上がるが、他チームは化け物揃い。生半可な覚悟でクリアできると思うな", aiMul: 1.55, growthCap: 112, needCP: 20 },
];

export const TITLE_DEFS = [
  { key: "grandTour", label: "グランツール総合優勝", icon: "🌍" },
  { key: "grandFinal", label: "グランファイナル制覇", icon: "🏆" },
  { key: "worlds", label: "世界選手権優勝", icon: "🌐" },
  { key: "olympics", label: "オリンピック優勝", icon: "🥇" },
];
