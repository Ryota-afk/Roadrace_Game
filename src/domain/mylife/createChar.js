// マイライフの新規キャラクター作成（mlCreateChar）を抽出した純粋な生成器。Step7第9弾。
// main.jsxのApp()内に237行そのまま残っていた最大の未抽出ブロック。mlGenRace（第3弾）と同じ理由で
// controllers/ではなくdomain/へ配置（レース/選手を組み立てる純粋なジェネレータのため）。
// 注意：cpMeta（生涯CP特典の元データ）はloadMeta()の戻り値をApp側から引数で受け取る
// （呼び出し側でlocalStorageを読み、本関数自体はlocalStorageに一切触れない。詳細はDEVLOG §9参照）。
import { AB_KEYS, AB_LABEL, ABILITIES } from "../../data/abilities.js";
import { ML_BACKGROUNDS } from "../../data/events.js";
import { ML_BADGE_SLOTS_BY_CLASS } from "../../data/gear.js";
import { SUB_STAT_KEYS, mulberry, newRider, overall, pickRiderName } from "../../core/core.js";
import { legendAncestorSet, legendBloodId, mlBloodlineBonus, mlBreedBonus, protegeInherit } from "../../breeding/breeding.js";
import { deriveBloodMarks, matchBloodRecipe } from "../../breeding/recipes.js";
import { GROWTHPOW_ORDER } from "../../data/progression.js";
import { MYLIFE_TEAMS, mlTeammatesFromRoster, sharedWorldRosters, cpShopMylifePerks } from "../../state/state.js";
import { bumpGrowthPow, mlBadgeKind, mlCpPerks, mlCreateRival, mlGenDirective } from "../../logic/support.js";
import { mlGenRaceCandidates } from "./race.js";

export function mlCreateChar(s, type, background, master, partner, cpMeta) {
  const rng = mulberry(Date.now() % 999983);
  // v38: 所属チームの割り当てを見直し。従来は全チームから完全ランダムで、B1デビューなのに
  // PRO강호に所属して始まる不整合があり、また脚質と無関係で「毎回ほぼ同じ」に感じられた。
  // 開始クラス（B1）相応の下位〜中堅チーム（tier<=1）に限定し、自分の脚質に合うチームを
  // 当たりやすく重み付け＝キャリアごとに顔ぶれが変わりつつ、脚質に沿った所属先になる。
  const startPool = MYLIFE_TEAMS.filter(t => t.tier <= 1);
  const weightedPool = [...startPool, ...startPool.filter(t => t.spec === type)];
  const team = weightedPool[Math.floor(Math.random() * weightedPool.length)];
  const bg = ML_BACKGROUNDS[background];
  // v27: 教え子（プロテジェ）。師匠を選んでいれば、その最終能力・特殊能力・成長力を
  // 一部引き継いだ状態でデビューする
  const inh = master ? protegeInherit(master) : null;
  const player = newRider(bg.powerBase, rng, { type, age: bg.age, growth: bg.growth, powDist: bg.powDist, banned: new Set(), abBonus: inh ? inh.abBonus : undefined });
  player.background = background;
  player.vitality = 100; // v38(#9 B-2): 活力（長期の伸びしろの芯）。満タンでデビュー
  // v36(#4): 経歴ごとの固有メリット。高校卒＝成長力アップ抽選、大学卒／実業団卒＝出自らしい
  // 特殊能力を持ってデビュー（人気・評価・資金の初期ボーナスは後段の state 初期化で反映）。
  const perk = bg.perk || {};
  // v37: 生涯CPによるマイライフ特典（支度金・人気・評価・成長力抽選・当たり特能抽選の強化）。
  const cpPerks = mlCpPerks(cpMeta.totalEarnedCP);
  const cpShop = cpShopMylifePerks(cpMeta); // v37: CPショップで購入済みの特典
  const growthLottery = (perk.growthLottery || 0) + cpPerks.growthLottery;
  if (growthLottery && rng() < growthLottery) player.growthPow = bumpGrowthPow(player.growthPow, 1);
  if (cpShop.growthUp) player.growthPow = bumpGrowthPow(player.growthPow, 1); // ショップ：成長力+1確定
  if (cpShop.statBoost) AB_KEYS.forEach(k => { player[k] = Math.min(94, (player[k] || 0) + cpShop.statBoost); }); // ショップ：初期能力+6
  if (perk.startAbility && ABILITIES[perk.startAbility] && !(player.abilities || []).includes(perk.startAbility)) {
    player.abilities = [...(player.abilities || []), perk.startAbility];
  }
  // v36(#5リセマラ): デビュー素質の当たり抽選。稀に「天啓（金特）」「天賦の才（特能+1）」
  // 「才能の片鱗（成長力+1）」を持って生まれ、リセマラで狙う価値を作る。配合キャラは後段で
  // 特能枠を使い切るため素質ボーナスは配合なしのときのみ（生い立ちの素質＝叩き上げの物語）。
  let debutBoon = null;
  if (!(master && partner)) {
    const goodPool = Object.keys(ABILITIES).filter(id => {
      const a = ABILITIES[id];
      return a && !a.bad && !a.breedOnly && !(player.abilities || []).includes(id);
    });
    const br = rng();
    const bb = cpPerks.boonBonus + cpShop.boonBonus; // v37: CP（自動＋ショップ）で当たり特能の抽選窓を広げる
    if (br < 0.04 + bb * 0.4 && (player.abilities || []).some(id => ABILITIES[id] && !ABILITIES[id].bad)) {
      const goodId = (player.abilities || []).find(id => ABILITIES[id] && !ABILITIES[id].bad && !(player.goldAbilities || []).includes(id));
      if (goodId) {
        player.goldAbilities = [...(player.goldAbilities || []), goodId];
        debutBoon = { label: "天啓", note: `ひらめきを得て「${ABILITIES[goodId].label}」が金の状態で開花している` };
      }
    } else if (br < 0.13 + bb && goodPool.length && (player.abilities || []).length < 4) {
      const id = goodPool[Math.floor(rng() * goodPool.length)];
      player.abilities = [...(player.abilities || []), id];
      debutBoon = { label: "天賦の才", note: `生まれ持った才能で特殊能力「${ABILITIES[id].label}」を余分に宿している` };
    } else if (br < 0.26) {
      const before = player.growthPow;
      player.growthPow = bumpGrowthPow(player.growthPow, 1);
      // v43(成長力マスク化との整合): 成長力は3年目まで🔒???表示のため、この一言も
      // before→afterの具体的な等級を書いてはいけない（デビュー画面で実質バレてしまう）。
      if (player.growthPow !== before) debutBoon = { label: "才能の片鱗", note: "秘めた伸びしろを感じさせる（成長力が上がった。詳細は3年目に判明する）" };
    }
  }
  if (debutBoon) player.debutBoon = debutBoon;
  // v37: CPショップ「デビュー時 金特1つ確定」＝良特能を1つ金特化（無ければ差し脚を付与して金特化）
  if (cpShop.debutGold) {
    let goldId = (player.abilities || []).find(id => ABILITIES[id] && !ABILITIES[id].bad && !(player.goldAbilities || []).includes(id));
    if (!goldId) { goldId = "kicker"; if (!(player.abilities || []).includes(goldId)) player.abilities = [...(player.abilities || []), goldId]; }
    player.goldAbilities = [...(player.goldAbilities || [])];
    if (!player.goldAbilities.includes(goldId)) player.goldAbilities.push(goldId);
    if (!player.debutBoon) player.debutBoon = { label: "🌟 英才の証", note: `CP特典で「${ABILITIES[goldId].label}」を金の状態でデビュー` };
  }
  player.joinOvr = overall(player);
  if (inh) {
    if (inh.growthPowBump) {
      const gi = GROWTHPOW_ORDER.indexOf(player.growthPow);
      if (gi >= 0 && gi < GROWTHPOW_ORDER.length - 1) player.growthPow = GROWTHPOW_ORDER[gi + 1];
    }
    // v28: 「師の教え」の看板特性(lineage)＋師本人の良特性(inheritAbility)を継承。
    // 教え子は継承分により特殊能力を最大4つまで持てる（通常上限3より1多い＝メンターの恩恵）
    let abils = [...(player.abilities || [])];
    [inh.lineageTrait, inh.inheritAbility].forEach(id => { if (id && !abils.includes(id)) abils.push(id); });
    player.abilities = abils.slice(0, 4);
    // v29: 師の教えに応じた副ステータス補正
    if (inh.subBonus) SUB_STAT_KEYS.forEach(k => { if (inh.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + inh.subBonus[k])); });
    player.master = master.name;
    player.teaching = inh.teaching.label;
    player.joinOvr = overall(player);
  }
  // v31: 配合（血統）。2人目の親（配合相手）が選ばれていれば、両方の血を引く教え子にする
  let breed = null;
  if (master && partner) {
    breed = mlBreedBonus(master, partner);
    AB_KEYS.forEach(k => { if (breed.abBonus[k]) player[k] = Math.min(96, (player[k] || 0) + breed.abBonus[k]); });
    // 第28弾(判断⑰): subBonusには新ステ（突破力・安定感・スピリット）の遺伝分も入っている
    // （breeding.jsのINHERIT_SUB_KEYS）。キー集合はmlBreedBonusが管理するのでここでは
    // subBonusに入っている全キーを同じクランプ[20,95]で適用する。
    Object.keys(breed.subBonus).forEach(k => { if (breed.subBonus[k]) player[k] = Math.max(20, Math.min(95, (player[k] ?? 50) + breed.subBonus[k])); });
    // v33: 爆発力（配合評価）は初期能力ではなく「伸びしろ」に還元する。生まれた瞬間は普通でも育てると化ける
    if (breed.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, breed.growthSteps);
    else if (breed.growthBump) player.growthPow = bumpGrowthPow(player.growthPow, 1);
    player.talentCap = breed.talentCap || 0;
    player.bakuhatsu = breed.bakuhatsu || 0;
    player.matingGrade = breed.matingGrade || "D";
    // 金特クロス・配合限定特能は最優先で保持する（枠上限で溢れないように先頭へ）
    let abils2 = [...(breed.goldInherit || []), ...(breed.exclusive || []), ...(player.abilities || [])];
    breed.extraAbilities.forEach(id => { if (id && ABILITIES[id] && !abils2.includes(id)) abils2.push(id); });
    abils2 = abils2.filter((id, i) => abils2.indexOf(id) === i);
    player.abilities = abils2.slice(0, 5); // 配合は特能を最大5つまで受け継げる
    // 金特クロス：受け継いだ金特のうち、実際に特能枠へ残ったものを金特フラグ化
    if (breed.goldInherit && breed.goldInherit.length) {
      player.goldAbilities = [...(player.goldAbilities || [])];
      breed.goldInherit.forEach(id => { if (player.abilities.includes(id) && !player.goldAbilities.includes(id)) player.goldAbilities.push(id); });
    }
    // v33.4: 特殊配合。特定の血の組み合わせで、唯一無二の名血（金枠）を確定発現する
    if (breed.special) {
      const sm = breed.special;
      player.specialMating = { key: sm.key, title: sm.title, color: sm.color, note: sm.note, factorGold: !!sm.factorGold };
      player.talentCap = (player.talentCap || 0) + (sm.talent || 0);
      if (sm.growth) player.growthPow = bumpGrowthPow(player.growthPow, sm.growth);
      if (sm.extra && ABILITIES[sm.extra] && !(player.abilities || []).includes(sm.extra) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.extra];
      if (sm.gold && ABILITIES[sm.gold]) {
        if (!(player.abilities || []).includes(sm.gold) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), sm.gold];
        if ((player.abilities || []).includes(sm.gold)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(sm.gold)) player.goldAbilities.push(sm.gold); }
      }
    }
    // v33.2: 危険度。濃い血の代償として、稀に「ガラスの体」を持って生まれる（頑丈を継いでいれば発症しない）
    player.matingDanger = breed.danger || 0;
    if (breed.danger > 0 && !player.abilities.includes("tough") && !player.abilities.includes("glass") && Math.random() * 100 < breed.danger) {
      player.abilities = [...player.abilities, "glass"]; // 呪いは通常枠と別枠で背負う
      player.fragileBorn = true;
    }
    player.partner = partner.name;
    player.plusValue = breed.plusValue;
    player.generation = breed.generation;
    player.parentBloodIds = [legendBloodId(master), legendBloodId(partner)].filter(Boolean);
    const anc = new Set(player.parentBloodIds);
    legendAncestorSet(master).forEach(a => anc.add(a));
    legendAncestorSet(partner).forEach(a => anc.add(a));
    player.ancestorBloodIds = [...anc].slice(0, 12);
    // 第15弾（血脈レシピ）：両親の血の印を合流させる。旧セーブ（bloodMarks未保存）は
    // deriveBloodMarksが既存フィールドからその場で導出するので、殿堂を跨いでも判定が壊れない。
    player.bloodMarks = [...deriveBloodMarks(master), ...deriveBloodMarks(partner)].slice(0, 24);
    // 第15弾（血脈レシピ）：順序を含む隠しレシピが成立していれば、伝説特能・成長曲線の緩和
    // （domain/shared/growth.jsのgrowthPhaseが特能を見て衰えを抑制）・専用称号を付与する。
    // mlBreedBonus（シーズンの血統ユースからも呼ばれる共通関数）には一切触れず、
    // mlCreateChar（マイライフの新規キャラ作成のみ）に閉じて判定・付与する（devlog/wave15.md §E）。
    const recipe = matchBloodRecipe(player.bloodMarks);
    if (recipe) {
      player.bloodRecipe = { key: recipe.key, title: recipe.title, note: recipe.note, color: recipe.color, abilityId: recipe.abilityId };
      if (recipe.abilityId && ABILITIES[recipe.abilityId] && !(player.abilities || []).includes(recipe.abilityId)) {
        player.abilities = [...(player.abilities || []), recipe.abilityId];
      }
    }
    player.joinOvr = overall(player);
  }
  // v31.2: 系統名（血統の系統）。師匠／親の系統を継ぎ、いなければ自分が始祖となって新系統を興す
  player.lineageName = master ? (master.lineageName || `${master.name}系`) : `${player.name}系`;
  // v33.3: 系統確立ボーナス（因子）。確立した系統を継ぐ子孫は伸びしろ＋系統特能を受け取る
  let bloodlineNote = null;
  const blb = mlBloodlineBonus(player.lineageName);
  if (blb) {
    player.bloodlineTier = blb.tier;
    player.talentCap = (player.talentCap || 0) + blb.talentCap;
    if (blb.growthSteps) player.growthPow = bumpGrowthPow(player.growthPow, blb.growthSteps);
    let gotFactor = false;
    if (blb.factor && ABILITIES[blb.factor]) {
      if (!(player.abilities || []).includes(blb.factor) && (player.abilities || []).length < 5) {
        player.abilities = [...(player.abilities || []), blb.factor];
        gotFactor = true;
      }
      // 大系統は系統因子を金特へ昇華する（既に持っていても金特化）
      if (blb.factorGold && (player.abilities || []).includes(blb.factor)) {
        player.goldAbilities = [...(player.goldAbilities || [])];
        if (!player.goldAbilities.includes(blb.factor)) { player.goldAbilities.push(blb.factor); gotFactor = true; }
      }
    }
    bloodlineNote = { tier: blb.tier, label: blb.label, factor: gotFactor ? blb.factor : null, gold: blb.factorGold && (player.abilities || []).includes(blb.factor) };
  }
  // v33.4: 純血の極み（特殊配合）は系統因子を金特へ昇華する。系統因子が無ければ得意脚質特能を金特化
  if (player.specialMating && player.specialMating.factorGold) {
    const fac = (blb && blb.factor) || { climb: "mount", sprint: "finisher", flat: "flatlander", solo: "soloist" }[master ? master.focus : player.focus];
    if (fac && ABILITIES[fac]) {
      if (!(player.abilities || []).includes(fac) && (player.abilities || []).length < 6) player.abilities = [...(player.abilities || []), fac];
      if ((player.abilities || []).includes(fac)) { player.goldAbilities = [...(player.goldAbilities || [])]; if (!player.goldAbilities.includes(fac)) player.goldAbilities.push(fac); }
    }
  }
  player.focus = type === "CLM" ? "climb" : type === "SPR" ? "sprint" : "flat";
  // v25: 個人スポンサー・メディア人気度。チーム年俸とは別枠で、戦績に応じて上がる
  // 知名度が個人スポンサー収入（月極＋節目の一時金）に反映される
  player.popularity = (perk.popBonus || 0) + cpPerks.pop; // v36(#4)/v37: 出自メリット＋生涯CP特典
  player.form = 50; // v29: ピーキング用のフォーム（50=平常）
  player.popMilestones = [];
  // v14.3: 経歴ごとの初任給（万円/年）。年俸・監督評価・資産はキャリア開始時に初期化する
  const initialSalary = { highschool: 220, university: 280, corporate: 360 }[background] || 260;
  const rival = mlCreateRival(rng, player.name, team.name);
  // v26: 複数ライバル制。2人目の好敵手も別チームに固定生成しておくが、最初の対戦まで
  // 本人には明かされず、レースで実際に相まみえた瞬間に「新たな好敵手」として紹介される
  const rival2 = mlCreateRival(rng, player.name, team.name, [rival.name], [rival.team]);
  // v25: 新人時代に指導してくれる恩師を1名設定する。在籍から3年目を迎えるまでの間、
  // 練習・出走経験の伸びにボーナスがかかり、3年目に「人生の岐路」として一区切りを迎える
  // v27: 師匠（プロテジェの師）を選んでいれば、その名選手本人が恩師として指導につく
  const mentorName = master ? master.name : pickRiderName(rng, new Set([player.name, rival.name, rival2.name]));
  const initLog = [
    `【1年目 4月】${bg.label}として${team.name}に新人選手加入`,
    `【1年目 4月】${rival.team}の${rival.name}が、これから長く続くライバルになりそうだ`,
  ];
  // v36(#4): 経歴ごとのメリットをログで明示（出自の選択に意味が出るように）
  // v49(第11弾続き): 固定チームメイトを永続ワールドロースター（worldRosters）から取る。
  // 新規キャリアでも既存の共有ワールド（前回・シーズンと同じ世界）から所属チームの実在
  // ロースターを引くので、デビュー時点から「実在するチームメイト」になる。
  const worldRosters = sharedWorldRosters();
  if (bg.meritLabel) initLog.push(`【1年目 4月】${bg.meritLabel}：${bg.merit}`);
  if (master) {
    initLog.push(`【1年目 4月】かつての名選手・${master.name}の教え子としてデビュー。師の教え「${inh.teaching.label}」を授かり、${AB_LABEL[inh.keys[0]]}を受け継いだ`);
    initLog.push(`【1年目 4月】継承特性「${ABILITIES[inh.lineageTrait].label}」を身につけている（${inh.teaching.desc}）`);
    if (inh.inheritAbility) initLog.push(`【1年目 4月】さらに師匠直伝の特殊能力「${ABILITIES[inh.inheritAbility].label}」も受け継いだ`);
    if (breed) {
      initLog.push(`【1年目 4月】🧬 配合：${master.name}と${partner.name}、二人の血を引く逸材（${breed.nick.rank} ${breed.nick.label}／累代+${breed.plusPer}）`);
      if (breed.inbreed.count > 0) initLog.push(`【1年目 4月】🩸 共通の祖先を持つ濃い血のクロス（インブリード×${breed.inbreed.count}）。血が結晶し「${ABILITIES[breed.inbreedAb]?.label || breed.inbreedAb}」を宿す`);
      (breed.goldInherit || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】✨ 金の特殊能力を継承！両親の血が重なり、特殊能力「${ABILITIES[id]?.label || id}」を最初から金の状態で受け継いだ`); });
      (breed.exclusive || []).forEach(id => { if (player.abilities.includes(id)) initLog.push(`【1年目 4月】🩸 配合限定特能「${ABILITIES[id]?.label || id}」を血に宿して誕生した`); });
      if (player.fragileBorn) initLog.push(`【1年目 4月】⚠️ 濃すぎる血の代償か、生まれつき体が脆く「ガラスの体」を抱えている…健康管理が鍵になる`);
    }
    if (player.lineageName) initLog.push(`【1年目 4月】この血統は「${player.lineageName}」と呼ばれている`);
    if (bloodlineNote) {
      initLog.push(`【1年目 4月】🏛 「${player.lineageName}」は${bloodlineNote.label}した名門血統。その因子を受け継いで生まれた（伸びしろ上昇）`);
      if (bloodlineNote.factor) initLog.push(`【1年目 4月】🧬 系統因子「${ABILITIES[bloodlineNote.factor]?.label || bloodlineNote.factor}」${bloodlineNote.gold ? "を金の状態で" : "を"}発現している`);
    }
    if (player.specialMating) initLog.push(`【1年目 4月】🌟 特殊配合『${player.specialMating.title}』発動！${player.specialMating.note}`);
    if (player.bloodRecipe) {
      initLog.push(`【1年目 4月】👑 血脈レシピ『${player.bloodRecipe.title}』成立！${player.bloodRecipe.note}`);
      const legendId = player.bloodRecipe.abilityId;
      if (legendId && player.abilities.includes(legendId)) initLog.push(`【1年目 4月】👑 伝説の特殊能力「${ABILITIES[legendId].label}」を血に宿して誕生した`);
    }
  } else {
    initLog.push(`【1年目 4月】チームの${mentorName}が新人指導を買って出てくれた。しばらくは練習・出走の伸びに手心を加えてもらえそうだ`);
  }
  // 第47弾: 血脈（breedOnly）は付け外し可能にする。ここまでの処理でabilitiesに積まれた
  // 血脈の全件をbloodAbilitiesへ記録し、開始クラス（B1=3枠）に収まる分だけ実際に装着する。
  // あぶれた分は未使用のままbloodAbilitiesに残り、選手画面でいつでも付けられる
  // （devlog/wave47.md「生成時のデフォルト」）。優先順は「血脈レシピ由来（最も入手困難）→
  // exclusiveの生成順」——レシピのidはここまでの処理で末尾に追加されているため先頭へ動かす。
  const bloodIds = (player.abilities || []).filter(id => ABILITIES[id] && ABILITIES[id].breedOnly);
  if (bloodIds.length) {
    const recipeId = player.bloodRecipe && player.bloodRecipe.abilityId;
    const ordered = recipeId && bloodIds.includes(recipeId)
      ? [recipeId, ...bloodIds.filter(id => id !== recipeId)]
      : bloodIds;
    player.bloodAbilities = ordered;
    const nonBlood = player.abilities.filter(id => !bloodIds.includes(id));
    const badgeCount = nonBlood.filter(id => mlBadgeKind(id) === "badge").length;
    const bloodSlots = Math.max(0, ML_BADGE_SLOTS_BY_CLASS[0] - badgeCount);
    player.abilities = [...nonBlood, ...ordered.slice(0, bloodSlots)];
  } else {
    player.bloodAbilities = [];
  }
  return {
    ...s, player, team: team.name, classIdx: 0, classIdxBest: 0, year: 1, month: 0, points: 0,
    difficulty: s.mlDiffChoice || "easy", // v38(#6): マイライフの難易度（相手強さ・CP倍率）
    races: mlGenRaceCandidates(1, 0, 0), sel: { raceId: null },
    directive: mlGenDirective(1, 0, 0, 30),
    managerEval: 30 + (perk.evalBonus || 0) + cpPerks.eval, salary: initialSalary, money: (perk.moneyBonus || 0) + cpPerks.money + cpShop.money,
    // v51(第12弾12-C): CP交換所「パーツ強化の上限+2」
    partLvMaxBonus: cpShop.partLvMaxBonus,
    partsInv: {}, stock: { drink: 0, supp: 0, tune: 0 },
    gear: { roller: false, monitor: false, chef: false, flatCoach: false, climbCoach: false, sprintCoach: false, staminaCoach: false, soloCoach: false },
    houseLv: -1, carLv: -1,
    coaches: {}, debtMonths: 0, // 第36弾: 前キャリアの状態を持ち越さない
    badgeGoals: [], // 第41弾: 前キャリアの目標を持ち越さない
    raceFocus: null, // 第43弾: 前キャリアの出走計画を持ち越さない
    rival, rivalRecord: { meetings: 0, wins: 0, losses: 0 },
    rival2, rivalRecord2: { meetings: 0, wins: 0, losses: 0 },
    flags: { ...s.flags, mentorName, mentorActive: true, master: master ? master.name : null },
    // v30: 世界ランキング＆アンビションを新規キャリア用に初期化
    worldPoints: 0, worldRank: null, worldRankBest: null,
    ambitionIdx: 0, ambitionDone: [], ambitionPath: "victory",
    careerWins: 0, careerPodiums: 0, careerBigWins: 0, careerTitles: 0,
    // v32: 固定チームメイト・作戦・キャリア記録
    // v49(第11弾続き): worldRosters[所属チーム]から実在の11名を取る（プレイヤー本人+11=12名で
    // AIチームと同人数）。詳細はmlTeammatesFromRoster()のコメント参照。
    teammates: mlTeammatesFromRoster(worldRosters, team.name),
    // v37: 永続ワールドロースター（各AIチーム固定の選手団）。毎レース同じ顔ぶれが出走する
    // v38(#9 A-3): 共有ワールドから取得＝新キャリアでも前回・シーズンと同じ世界（年を取った状態）で始まる
    worldRosters,
    tactic: "balanced", careerHistory: [],
    log: initLog,
    // v36(#5リセマラ): デビュー前に素質を確認できる「素質診断」画面へ。引き直し（リセマラ）が
    // ここで完結する。確定するまで自動セーブは走らない（mylife_main のときだけ保存されるため）。
    screen: "mylife_scout",
  };
}
