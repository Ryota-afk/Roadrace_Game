// 選手フレーバーテキスト（戦績パターンから語り口を選ぶ純関数群）。
// Phase 4-1後の support.js から分離（Step 4: view層）。main.jsx/screens/*.jsx からは
// riderFlavorText のみが直接使われる。他は本ファイル内の内部ヘルパー／データテーブル。
import { ASSIST_ROLES, mulberry } from "../core/core.js";
import { MONTHS } from "../data/course.js";

export const FLAVOR_PERSONA = [
  "オフの日は決まって近所の定食屋に顔を出す、気さくな一面を持つ。",
  "移動中のバスや車内では誰よりも早く眠りに落ちるタイプ。",
  "自転車以外にも将棋を嗜み、盤面を読む集中力には定評がある。",
  "機材の整備は人任せにせず、隅々まで自分の手で行う几帳面な性格。",
  "地元の後輩たちからは兄貴分・姉御肌として慕われている。",
  "レース前は決まって同じルーティンで気持ちを整える。",
  "甘いものに目がなく、補給食のストックはいつも自前で用意している。",
  "寡黙だが、チームメイトの誕生日は必ず覚えている。",
  "オフシーズンは登山に出かけ、脚力よりも景色を楽しむ派。",
  "SNSでの発信はほとんどせず、黙々と練習に打ち込む職人肌。",
  "移動中の車内ではいつも同じプレイリストを聴いている。",
  "地元では意外にも人見知りとして知られている。",
  "インタビューでは飾らない本音がついつい出てしまう。",
  "雨の日のレースでも表情ひとつ変えない胆力の持ち主。",
  "練習後のストレッチには人一倍時間をかける。",
  "実は大の猫好きで、遠征先でも野良猫を見つけると必ず声をかける。",
  "料理が趣味で、遠征中も自炊にこだわっている。",
  "幼い頃からこの土地で育ち、地元愛は人一倍。",
  "几帳面な性格で、練習ノートを欠かさずつけている。",
  "案外な負けず嫌いで、練習の順位付けにも本気になる。",
  "チーム内のムードメーカーとして、重い空気を和ませる存在。",
  "高校時代は別競技をしていたが、この道に転向してきた変わり種。",
  "早起きが得意で、誰よりも早く練習に出てくる。",
  "実は方向音痴で、遠征先ではよく道に迷うと本人談。",
  "声援を受けると急に力が湧いてくるタイプ。",
  "自分の走りを分析するのが好きで、映像を何度も見返す。",
  "家族思いで、レースの合間にはよく実家に連絡を入れている。",
  "意外にも手先が器用で、機材の細かい調整も自分でこなす。",
  "普段は物静かだが、レースになると人が変わったように闘志を燃やす。",
  "新しい土地でのレースを何より楽しみにしている旅好き。",
];

export const ROLE_CLAUSE = {
  ace: "エースとして先頭に立ち、",
  lead: "第一アシストとして脚を使いながらも、",
  sub: "第二アシストの立場ながら、",
  mountain: "山岳アシストとして山を駆け上がりながら、",
  flat: "平坦アシストとして集団を牽引しながら、",
  breakaway: "逃げ要員として早々に飛び出し、",
  breakthrough: "自由な走りを許され、",
  support: "アシスト役に徹しながらも、",
  experience: "経験を積む一戦の中で、",
};

export function roleClause(role) { return ROLE_CLAUSE[role] || ""; }

export const FLAVOR_EPISODE_WIN = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で圧巻の逃げ切りを見せ、今も語り草になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を制した走りは、本人いわく会心の一戦だったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のゴールスプリントを制した瞬間はチーム内でも語り継がれている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で初優勝を飾って以来、勝負どころでの強さに定評がある。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた独走勝利は、今も本人の自信の源になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で終盤の集団を突き放し、そのまま押し切った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}制覇を境に、周囲の見る目が変わったという。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での勝利は本人にとって忘れられない一戦。`,
];

export const FLAVOR_EPISODE_PODIUM = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で表彰台に上がり、確かな手応えをつかんだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで優勝争いに加わり、僅差で表彰台に踏みとどまった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での表彰台は本人にとって大きな自信になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた粘りの走りが、表彰台という結果につながった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}のラストで踏ん張り、表彰台をつかみ取った。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では、最後まで諦めない走りで表彰台に食い込んだ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での好走は今もチーム内で話題に上る。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}、あと一歩及ばず優勝は逃したが、表彰台という結果を残した。`,
];

export const FLAVOR_EPISODE_OTHER = [
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では先頭集団に食らいつき、力の片鱗を見せた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では終盤まで粘り、確かな成長を感じさせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での走りは結果以上に評価されている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}で見せた積極的な仕掛けは、今後への期待を抱かせた。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では苦しい展開ながらも最後まで足を止めなかった。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}を経て、レース勘を着実に磨いている最中だ。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}での経験は今の走りの土台になっている。`,
  e => `${e.year}年目${MONTHS[e.month]}、${roleClause(e.role)}${e.name}では悔しい結果に終わったが、その後の糧にしている。`,
];

export function raceLogWinStreak(log) {
  let streak = 0;
  for (let i = log.length - 1; i >= 0; i--) { if (log[i].rank === 1) streak++; else break; }
  return streak;
}

export const ACE_TYPE_LABEL = {
  SPR: "エーススプリンター", CLM: "エースクライマー", RUL: "オールラウンドエース",
  PUN: "エースパンチャー", TT: "エースタイムトライアリスト",
};

export const FLAVOR_UNDEFEATED = [
  n => `${n}戦${n}勝、デビュー以来まだ黒星がない完全無敗を貫いている。`,
  n => `無敗街道驀進中——${n}戦して一度も負けたことがない。`,
  n => `${n}戦全勝という圧倒的な戦績で、負けを知らない走りを続けている。`,
  n => `ここまで${n}戦無敗。誰にも負ける気がしないという自信がにじみ出ている。`,
];

export const FLAVOR_STREAK = [
  n => `現在${n}連勝中。勢いに乗ったこの選手を止めるのは容易ではない。`,
  n => `直近${n}戦を勝ち続け、波に乗っている真っ最中だ。`,
  n => `${n}連勝と絶好調で、次のレースでも警戒される存在になっている。`,
  n => `破竹の${n}連勝中——誰もこの勢いに逆らえずにいる。`,
];

export const FLAVOR_ACE_ARCHETYPE = [
  label => `幾多のレースでエースを任され続けた、チームの絶対的${label}。`,
  label => `迷わずエースの座を託される、押しも押されもせぬ${label}。`,
  label => `チームメイトの誰もが認める、揺るぎない${label}としての地位を築いている。`,
  label => `他の追随を許さぬ結果を積み重ね、名実ともにチームの${label}になった。`,
];

export const FLAVOR_ASSIST_ARCHETYPE = [
  () => "己の勝利より仲間を活かす道を選び続けた、チーム随一の名アシスト。",
  () => "目立たぬ働きでエースを何度も勝たせてきた、縁の下の名アシスト。",
  () => "献身的な牽引でチームを支え続け、いぶし銀の名アシストと評されている。",
  () => "自らの結果より仲間のゴールを優先する、信頼厚い名アシスト。",
];

export const FLAVOR_BREAKAWAY_ARCHETYPE = [
  () => "序盤から果敢に飛び出す走りを繰り返す、逃げのスペシャリスト。",
  () => "集団任せにせず自ら仕掛け続ける、逃げ屋としての矜持を持つ選手。",
  () => "番狂わせを演出する逃げの名手として、レースを何度も面白くしてきた。",
];

export const STAGE_DAY_ROLE_LABEL = {
  ace: "エース", lead: "第一アシスト", sub: "第二アシスト", mountain: "山岳アシスト", flat: "平坦アシスト", breakaway: "逃げ要員",
};

export function stageDayPhrase(d) {
  const roleLabel = STAGE_DAY_ROLE_LABEL[d.role] || "アシスト";
  const rankLabel = d.rank === 1 ? "優勝" : `${d.rank}位`;
  return `${d.day}日目は${roleLabel}で${rankLabel}`;
}

export function stageOverallPhrase(e) {
  return e.rank === 1 ? "見事総合優勝を飾った" : e.rank <= 3 ? `総合${e.rank}位で表彰台に上がった` : `総合${e.rank}位でフィニッシュした`;
}

export const FLAVOR_STAGE_TEMPLATES = [
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}では、${e.stageBreakdown.map(stageDayPhrase).join("、")}という走りを見せ、${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}を振り返ると——${e.stageBreakdown.map(stageDayPhrase).join("、")}。最終的には${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}の${e.name}、その道のりは${e.stageBreakdown.map(stageDayPhrase).join("、")}というものだった。結果は${stageOverallPhrase(e)}。`,
  e => `${e.year}年目${MONTHS[e.month]}、${e.name}では日替わりで役割を変えながら${e.stageBreakdown.map(stageDayPhrase).join("、")}。${stageOverallPhrase(e)}。`,
];

export function raceLogSlumpBeforeLast(log) {
  if (log.length < 3) return 0;
  let n = 0;
  for (let i = log.length - 2; i >= 0; i--) { if (log[i].rank >= 5) n++; else break; }
  return n;
}

export const FLAVOR_COMEBACK = [
  e => `一時は${roleClause(e.role)}不振に沈んだが、${e.year}年目${MONTHS[e.month]}の${e.name}で見事な復活を遂げた。`,
  e => `苦しい時期を乗り越え、${e.year}年目${MONTHS[e.month]}の${e.name}では${roleClause(e.role)}会心の走りでカムバックを果たした。`,
  e => `不調の連鎖を断ち切ったのが、${e.year}年目${MONTHS[e.month]}の${e.name}。${roleClause(e.role)}這い上がる走りで存在感を示した。`,
  e => `低迷期を経て、${e.year}年目${MONTHS[e.month]}の${e.name}で${roleClause(e.role)}見違えるような走りを取り戻した。`,
];

export function findCourseSpecialty(log) {
  const groups = {};
  log.forEach(e => { (groups[e.name] = groups[e.name] || []).push(e); });
  let best = null;
  Object.keys(groups).forEach(name => {
    const arr = groups[name];
    if (arr.length >= 2 && arr.every(e => e.rank <= 3)) {
      if (!best || arr.length > best.arr.length) best = { name, arr };
    }
  });
  return best;
}

export const FLAVOR_COURSE_SPECIALTY = [
  (name, n) => `${name}には${n}度出走して${n}度とも表彰台に上がっている、勝手知ったる得意のコース。`,
  (name, n) => `${name}となると俄然強さを増すタイプで、${n}戦${n}回とも表彰台を外していない。`,
  (name, n) => `${name}の道筋を知り尽くしているのか、${n}度の出走すべてで表彰台に食い込んでいる。`,
  (name, n) => `${name}との相性は抜群で、出走した${n}戦すべてで好結果を残している。`,
];

export const FLAVOR_GT_SPECIALIST = [
  n => `グランツールとなるとひときわ輝きを増す選手で、これまで${n}度表彰台に上っている。`,
  n => `長丁場のグランツールを得意とし、${n}度の総合表彰台がその適性を物語っている。`,
  n => `グランツール巧者として知られ、通算${n}度の総合表彰台を築き上げてきた。`,
];

export const FLAVOR_PRODIGY = [
  () => "若くしてすでに複数の勝利を手にしている、将来を嘱望される逸材。",
  () => "同年代を大きく引き離す結果を残し続ける、早熟の才能の持ち主。",
  () => "デビューから間もないながら勝ち方を知っている、期待の若手。",
];

export const FLAVOR_VETERAN = [
  () => "ベテランと呼ばれる年齢になってもなお、第一線で結果を残し続けている。",
  () => "年齢を感じさせない走りで、若手相手にも一歩も引かない意地を見せる。",
  () => "長いキャリアを積みながら衰えを知らず、今も好走を重ねている。",
];

export const FLAVOR_MURA = [
  () => "絶好調かと思えば急失速もある、振れ幅の大きさが持ち味の選手。",
  () => "波に乗ればどこまでも強いが、崩れる時は大きく崩れる読めないタイプ。",
  () => "会心の走りと不本意な結果が同居する、良くも悪くもムラのある選手。",
];

export function riderFlavorText(r) {
  const log = r.raceLog || [];
  if (log.length >= 3 && log.every(e => e.rank === 1)) {
    const idx = Math.floor(mulberry((r.id || 0) * 211 + log.length)() * FLAVOR_UNDEFEATED.length);
    return FLAVOR_UNDEFEATED[idx](log.length);
  }
  const streak = raceLogWinStreak(log);
  if (streak >= 3) {
    const idx = Math.floor(mulberry((r.id || 0) * 311 + streak)() * FLAVOR_STREAK.length);
    return FLAVOR_STREAK[idx](streak);
  }
  const last = log[log.length - 1];
  const slump = raceLogSlumpBeforeLast(log);
  if (last && last.rank <= 3 && slump >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 823 + slump)() * FLAVOR_COMEBACK.length);
    return FLAVOR_COMEBACK[idx](last);
  }
  const roled = log.filter(e => e.role);
  if (log.length >= 5 && roled.length / log.length >= 0.6) {
    const aceCount = roled.filter(e => e.role === "ace").length;
    const assistCount = roled.filter(e => ASSIST_ROLES.has(e.role)).length;
    const breakawayCount = roled.filter(e => e.role === "breakaway").length;
    const wins = log.filter(e => e.rank === 1).length;
    if (aceCount / roled.length >= 0.7 && wins >= 2) {
      const label = ACE_TYPE_LABEL[r.type] || "絶対的エース";
      const idx = Math.floor(mulberry((r.id || 0) * 419 + aceCount)() * FLAVOR_ACE_ARCHETYPE.length);
      return FLAVOR_ACE_ARCHETYPE[idx](label);
    }
    if (assistCount / roled.length >= 0.7) {
      const idx = Math.floor(mulberry((r.id || 0) * 523 + assistCount)() * FLAVOR_ASSIST_ARCHETYPE.length);
      return FLAVOR_ASSIST_ARCHETYPE[idx]();
    }
    if (breakawayCount / roled.length >= 0.5) {
      const idx = Math.floor(mulberry((r.id || 0) * 617 + breakawayCount)() * FLAVOR_BREAKAWAY_ARCHETYPE.length);
      return FLAVOR_BREAKAWAY_ARCHETYPE[idx]();
    }
  }
  const spec = findCourseSpecialty(log);
  if (spec) {
    const idx = Math.floor(mulberry((r.id || 0) * 929 + spec.arr.length)() * FLAVOR_COURSE_SPECIALTY.length);
    return FLAVOR_COURSE_SPECIALTY[idx](spec.name, spec.arr.length);
  }
  const gtPodiums = log.filter(e => e.name.includes("グランツール") && e.rank <= 3).length;
  if (gtPodiums >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 1031 + gtPodiums)() * FLAVOR_GT_SPECIALIST.length);
    return FLAVOR_GT_SPECIALIST[idx](gtPodiums);
  }
  const totalWins = log.filter(e => e.rank === 1).length;
  if (r.age <= 22 && totalWins >= 2) {
    const idx = Math.floor(mulberry((r.id || 0) * 1129 + totalWins)() * FLAVOR_PRODIGY.length);
    return FLAVOR_PRODIGY[idx]();
  }
  if (r.age >= 32 && log.length >= 5 && log.slice(-3).some(e => e.rank <= 3)) {
    const idx = Math.floor(mulberry((r.id || 0) * 1237 + r.age)() * FLAVOR_VETERAN.length);
    return FLAVOR_VETERAN[idx]();
  }
  if (log.length >= 5) {
    const bestRank = Math.min(...log.map(e => e.rank));
    const worstRank = Math.max(...log.map(e => e.rank));
    if (bestRank <= 3 && worstRank - bestRank >= 6) {
      const idx = Math.floor(mulberry((r.id || 0) * 1327 + worstRank)() * FLAVOR_MURA.length);
      return FLAVOR_MURA[idx]();
    }
  }
  let notable = null;
  log.forEach(e => {
    if (!notable || e.rank < notable.rank || (e.rank === notable.rank && (e.year > notable.year || (e.year === notable.year && e.month > notable.month)))) notable = e;
  });
  if (notable) {
    if (notable.stageBreakdown && notable.stageBreakdown.length) {
      const idx = Math.floor(mulberry((r.id || 0) * 719 + notable.year * 13 + notable.month)() * FLAVOR_STAGE_TEMPLATES.length);
      return FLAVOR_STAGE_TEMPLATES[idx](notable);
    }
    const pool = notable.rank === 1 ? FLAVOR_EPISODE_WIN : notable.rank <= 3 ? FLAVOR_EPISODE_PODIUM : FLAVOR_EPISODE_OTHER;
    const idx = Math.floor(mulberry((r.id || 0) * 131 + notable.year * 37 + notable.month * 11 + notable.rank * 5)() * pool.length);
    return pool[idx](notable);
  }
  const idx = Math.floor(mulberry((r.id || 0) * 977 + 3)() * FLAVOR_PERSONA.length);
  return FLAVOR_PERSONA[idx];
}
