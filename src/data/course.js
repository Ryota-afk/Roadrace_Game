// 静的データ（Phase 1で src/main.jsx から分離）。純粋な定数のみ。

export const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];

// v50(第11弾Phase1・1-D): シーズンのポイントが「上位10位内の全選手合算」へ変わり、
// 旧式（自チーム最上位1人分だけ）より1レースあたりの獲得ptが増えた。ただし増え方は
// 実力に比例して非線形（弱いチームほど複数選手が上位10位に食い込みにくく、伸びが小さい）。
// 実測（scratchpad/relegate_calib2.mjs・AI中心比のability帯で11ヶ月分の獲得ptをシミュレート）：
// AI中心-15（明確に力不足）→平均pt約3、AI中心-7（やや力不足）→平均pt約18。この間に
// 「際どく残留/降格し得る」帯を置く値として25を採用（Season専用。RELEGATE_LINE自体は
// マイライフ側からは参照されない＝この定数はSeason専用で共有していないため直接改定できる）。
export const RELEGATE_LINE = 25;

export const ROSTER_MAX_BY_CLASS = [12, 14, 16];

export const SCOUT_COUNT_BY_CLASS = [5, 7, 9];

export const PRODIGY_CHANCE_BY_CLASS = [0.28, 0.38, 0.5];

export const ROLES = {
  lead:      { label: "第一アシスト", desc: "エースを最後まで牽引" },
  sub:       { label: "第二アシスト", desc: "第一アシストを支援。脚がなくなると離脱" },
  mountain:  { label: "山岳アシスト", desc: "山岳まで脚を温存し、山岳区間でエースを牽引" },
  flat:      { label: "平坦アシスト", desc: "平坦・丘陵のみ牽引。山岳では牽引せず自然消滅的に遅れる" },
  breakaway: { label: "逃げ要員", desc: "序盤に飛び出し逃げ集団を形成。ローテーションで牽引し合う" },
};

// v35(バランス): シーズン作戦の説明を実測（Node・エース着順比較）に合わせて正直化。
// 検証＝push:集団を保ちわずかに上位（集団ゴールに強いエース向き。SPR@クリテでTOP3 79%→85%）／
// hold:ほぼ中立〜やや不利の守り（エースが集団で勝てるなら不要）。
// ace_early は同v35で「勝負を賭けた逃げ」に強化：登坂・山岳では集団が組織的に追えず逃げが決まりやすく
// （ヒルクライムで最善手・着順1.04）、平坦・スプリント決着では従来どおり吸収されて着順を落とす。
export const CHASE_MODES = {
  normal:    { label: "通常", desc: "標準的なローテーションペース。迷ったらこれ" },
  push:      { label: "追走強化", desc: "牽引を増やしてペースを上げ、集団を保つ。逃げを潰して集団ゴールに持ち込みたい強いエース向き（脚の消耗は早い）" },
  hold:      { label: "静観", desc: "牽引の脚を温存し先頭を追わない守りの選択。展開が向くのを待つ（エースが集団で勝てるなら不要）" },
  ace_early: { label: "エース早期発射", desc: "エースが単独で飛び出す勝負の逃げ。登坂・山岳の激しいコースでは集団が追いつけず逃げ切りやすい一方、平坦・スプリント決着では吸収されて大失速しやすい（1レースにつき1回限りなので、地形を選んで使いたい）" },
};

export const SEG_COMMENTARY = {
  flat: ["平坦区間、集団は一団となってハイスピードで進む", "風を切る平坦路、隊列が長く伸びていく", "平坦の巡航、アシストが前を固めてペースを作る", "平坦基調、脚を溜めながらの我慢比べだ"],
  hill: ["丘陵に差しかかる、パンチャーがそわそわし始める", "細かなアップダウンで集団にじわじわ負荷がかかる", "起伏の連続、脚のある者が徐々に前へ上がる", "丘陵区間、ここで無理をすると後半に響く"],
  climb: ["本格的な登坂開始、クライマーの独壇場だ", "勾配がきつくなり、早くも千切れる選手が出る", "山岳区間、じりじりとタイム差が生まれていく", "登りに入った、パワーウェイトレシオがものを言う"],
  sprint: ["最終スプリント区間へ、隊列が一気に凝縮する", "ゴールスプリントの位置取り争いが激化してきた", "スプリンターが車列の前方へ殺到する", "ラスト、トレインが発進態勢に入る"],
  mtn: ["山頂フィニッシュへ、最後の急坂が待ち受ける", "頂上決戦、ここまでの疲労がすべて出る", "最後の登り、まさに勝負どころだ", "山頂ゴールへの激坂、脚が残っているのは誰だ"],
  tt: ["個人TT、孤独な独走のはじまり", "エアロポジションを保ち一定ペースを刻む", "独走力の真価が問われる区間だ", "タイムトライアル、己との戦いが続く"],
};

export const FINISH_COMMENTARY = [
  "🎙 フィニッシュ！歓声が競技場を包む",
  "🎙 ゴール！長い戦いに決着がついた",
  "🎙 フィニッシュライン通過！勝者が決まる",
];

export const TEMPLATES = [
  { kind: "クリテリウム", favors: "SPR", squadMin: 1, squadMax: 5, laps: 6, segs: [["flat", 300, 18], ["flat", 260, 15], ["sprint", 90, 4]] },
  { kind: "サーキットレース", favors: "SPR", squadMin: 1, squadMax: 5, laps: 4, segs: [["flat", 380, 20], ["hill", 260, 12], ["flat", 320, 16], ["sprint", 110, 4]] },
  // 第77弾(devlog/wave75.md「第77弾」・TODO#28): 決着をsprintからhillへ変更した。第74弾で
  // グラベルレース(favors:"PUN")に入れた修正と同じもので、丘陵ロードには入っていなかった。
  // 決着がスプリント力勝負になっていたためSPRが69〜79%で勝っていた（実測。グラベルは
  // hill決着に直した後PUNが最上位になっている）。丘のパンチ力（決着式のhill: cl0.55+sp0.30+fl0.15）
  // で決まるようにする。
  { kind: "丘陵ロード", favors: "PUN", squadMin: 1, squadMax: 5, segs: [["flat", 480, 26], ["hill", 450, 17], ["hill", 450, 17], ["hill", 130, 4]] },
  // 第77弾(devlog/wave75.md「第77弾」・TODO#28): 平坦の距離比率が47%と高く、純登坂の
  // ヒルクライム（climb87%・CLM優勝率43〜51%）に対して山岳ロードはPUNに負けていた
  // （CLM31〜34%）。平坦を短縮し登坂区間を伸ばして、山岳としての性格を強める。
  { kind: "山岳ロード", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["flat", 320, 16], ["climb", 620, 14], ["climb", 680, 13], ["mtn", 200, 5]] },
  { kind: "ヒルクライム", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["climb", 560, 14], ["climb", 600, 12], ["mtn", 190, 4]] },
  // v46(#34): soloTTフラグを追加。個人TTは駆け引きの無い競技のため観戦を廃止する
  // （チームTTのteamTTフラグと対になる形。squadMin===squadMax===1という魔法数字での
  // 判定はやめ、呼び出し側は明示的にこのフラグを見る）。
  { kind: "個人TT", favors: "TT", soloTT: true, squadMin: 1, squadMax: 1, segs: [["tt", 520, 22], ["tt", 520, 22]] },
  // 第74弾(devlog/wave74.md・TODO#27-d): 決着をsprintからhillへ変更し、地形もhill優勢
  // （hill63.5%/flat23.1%/climb13.5%）に組み直した。旧segsは実地形がflat
  // （favors:"PUN"の宣言と食い違う＝出走計画m_plan2の実効が偶然この不整合の
  // 埋め合わせだけになっていた）。丘陵ロード（平坦→丘2連→スプリント決着）とは
  // 「丘→山→丘のままゴール」で差別化する。実測：PUNの平均順位16.9位→10.4位
  // （n=80・scratchpad/w74_gravel.mjs）。
  // 第80弾(devlog/wave75.md「第79・80弾」): climb区間を撤去しhillへ統合した。地形別
  // ふるい落とし（TERRAIN_KEEP_TIGHTEN）導入後、たとえ距離比率が小さくてもclimb区間が
  // あるとCLMが有利に生き残り続け、PUNが得意なはずのhill決着に辿り着く前にPUN/RUL/TTが
  // 脱落してCLMが最上位になってしまっていた（実測：climb距離を7→3に半減させても
  // CLM32%で変わらず）。climb区間を完全に無くすとPUNが最上位に戻る（実測28%・n=180で安定）。
  { kind: "グラベルレース", favors: "PUN", squadMin: 1, squadMax: 5, segs: [["flat", 420, 12], ["hill", 400, 15], ["hill", 300, 7], ["hill", 380, 18]] },
  // v35(チームTT): チーム単位の合算タイム。squadMinを4に上げ「層の厚さ」を要求。teamTTフラグで専用エンジンへ分岐。
  { kind: "チームTT", favors: "TT", teamTT: true, squadMin: 4, squadMax: 6, segs: [["tt", 480, 22], ["flat", 300, 14], ["tt", 480, 22]] },
  // 第72弾(devlog/wave72.md): RUL（ルーラー）専用コース。5脚質中RULだけ専用コースが無く、
  // controllers/mylife/raceStart.jsのラストレースでPUNと同じ丘陵ロードを割り当てられる
  // 機能的な欠落だった。最終区間をtt（独走）にすることで、finish.jsの決着計算が
  // solo*0.6+flat*0.4（独走決着）になり、SPR系コースのsprint決着（純スプリント力）と
  // 明確に差別化される＝「平坦を高速で押し切る」というルーラーの定義がそのまま形になる。
  { kind: "平坦ロード", favors: "RUL", squadMin: 1, squadMax: 5, segs: [["flat", 520, 30], ["flat", 480, 26], ["tt", 420, 18]] },
];

export const ML_MONUMENTS = [
  { id: "pave", month: 1, name: "石畳の古典《春の地獄》", grade: 3, tmpl: { kind: "石畳クラシック", favors: "RUL", squadMin: 1, squadMax: 5, segs: [["flat", 520, 30], ["hill", 300, 14], ["flat", 500, 26], ["hill", 260, 12], ["sprint", 120, 4]] } },
  { id: "ardennes", month: 4, name: "丘陵の古典《アルデンヌ》", grade: 3, tmpl: { kind: "丘陵クラシック", favors: "PUN", squadMin: 1, squadMax: 5, segs: [["flat", 420, 24], ["hill", 420, 16], ["hill", 440, 16], ["hill", 300, 12], ["sprint", 120, 4]] } },
  { id: "autumn", month: 6, name: "山岳の古典《秋の女王》", grade: 3, tmpl: { kind: "山岳クラシック", favors: "CLM", squadMin: 1, squadMax: 5, segs: [["flat", 360, 22], ["climb", 560, 13], ["hill", 300, 12], ["climb", 420, 12], ["mtn", 160, 4]] } },
];

export const VENUES = ["房総", "飛騨", "阿蘇", "蔵王", "琵琶湖", "瀬戸内", "津軽", "日光", "富士", "美濃", "丹波", "石鎚"];

export const REGIONS = ["東日本", "中部", "西日本"];

export const VENUE_REGION = {
  "房総": "東日本", "蔵王": "東日本", "津軽": "東日本", "日光": "東日本",
  "飛騨": "中部", "富士": "中部", "美濃": "中部", "琵琶湖": "中部",
  "阿蘇": "西日本", "瀬戸内": "西日本", "丹波": "西日本", "石鎚": "西日本",
};

export const HOME_ABILITY_BONUS = 3;

export const OVERSEAS_VENUES = ["アルプス", "ピレネー", "ドロミテ", "フランドル", "ロンバルディア", "アンダルシア", "トスカーナ", "プロヴァンス"];

export const GRAND_TOURS = [
  { month: 1, season: "春季", stageTmpls: [TEMPLATES[0], TEMPLATES[1], TEMPLATES[2]] },
  { month: 3, season: "夏季", stageTmpls: [TEMPLATES[2], TEMPLATES[3], TEMPLATES[4]] },
  { month: 5, season: "秋季", stageTmpls: [TEMPLATES[3], TEMPLATES[4], TEMPLATES[1]] },
];

export const SEG_LABEL = { flat: "平坦", hill: "丘陵", climb: "山岳", sprint: "ゴールスプリント", mtn: "山頂フィニッシュ", tt: "TT区間" };

export const SEG_COLOR = { flat: "#4f8fe8", hill: "#c98bf0", climb: "#e8544f", sprint: "#35c07e", mtn: "#e8544f", tt: "#e8a13c" };

export const SEG_AB = { flat: "flat", hill: "climb", climb: "climb", sprint: "sprint", mtn: "climb", tt: "solo" };
