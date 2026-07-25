// 選択肢付きイベント・岐路の静的データ（Phase 4-1後の support.js から分離）。
// 各エントリの effects は EFFECT_APPLIERS（logic/support.js）が解釈する宣言的な効果指定。

export const EVENTS = [
  { id: "media", title: "地元メディアの密着取材", text: "地元テレビ局がチームへの密着取材を申し込んできた。",
    choices: [
      { label: "取材を受ける", result: "知名度が上がり、スポンサーへの印象も良くなった。ただし対応で少し疲れが出た。", effects: { budget: 25, rosterFatigueAll: 6 } },
      { label: "練習に集中する", result: "取材は断り、全員で練習に打ち込んだ。疲労が回復した。", effects: { rosterFatigueAll: -10 } },
    ] },
  { id: "rivalcamp", title: "ライバルチームから合同合宿の誘い", text: "他チームから合同合宿をしないかと誘いが来た。",
    choices: [
      { label: "参加する", result: "刺激になる合宿だった。キャンプ券を1枚もらえた。少し疲れが溜まった。", effects: { campGrant: 1, rosterFatigueAll: 8 } },
      { label: "自主トレを選ぶ", result: "自チームのペースで調整し、コンディションが上向いた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "sponsorvisit", title: "スポンサー重役の視察", text: "スポンサー企業の重役がチームの練習を視察に来た。",
    choices: [
      { label: "気合を入れて出迎える", result: "熱意が伝わり、ノルマ未達の心証が少し和らいだ。", effects: { mandatesMissedReduce: -1, rosterFatigueAll: 4 } },
      { label: "普段通り過ごす", result: "ありのままの姿勢が好感を持たれ、差し入れをもらった。", effects: { budget: 15 } },
    ] },
  { id: "familyvisit", title: "若手選手の家族が観戦に", text: "若手選手の家族が応援に駆けつけた。",
    choices: [
      { label: "激励会を開く", result: "チーム全体が温かい雰囲気に包まれた。", effects: { rosterCondAll: 1, budget: -10 } },
      { label: "本人に任せる", result: "リラックスできたのか、疲れがよく抜けた。", effects: { fatigueReduceRandom: -25 } },
    ] },
  { id: "bikeclinic", title: "地域の自転車教室に招待", text: "地元の自治体から子供向け自転車教室への協力を依頼された。",
    choices: [
      { label: "参加する", result: "地域との交流が評価され、謝礼をもらった。", effects: { budget: 20, rosterFatigueAll: 3 } },
      { label: "コース試走を優先する", result: "参加を見送り、じっくり体を休めた。", effects: { rosterFatigueAll: -8 } },
    ] },
  { id: "weather", title: "記録的な猛暑・寒波が到来", text: "今月は例年にない厳しい天候が続いている。",
    choices: [
      { label: "無理せず調整する", result: "疲労をしっかり抜くことを優先した。", effects: { rosterFatigueAll: -12 } },
      { label: "予定通り練習する", result: "厳しい環境を乗り越え、精神的に一回り成長した。", effects: { rosterCondAll: 1, rosterFatigueAll: 10 } },
    ] },
  { id: "omen", title: "「来年は大物が来る」というOBの占い", text: "OBの一人が「来年は掘り出し物が入ってくる」と言い出した。",
    choices: [
      { label: "お布施のつもりで奢る", result: "気持ちが軽くなった。", effects: { budget: -15, rosterCondAll: 1 } },
      { label: "気にせず過ごす", result: "特に何も起きなかったが、浮いた分は懐に。", effects: { budget: 10 } },
    ] },
  { id: "donation", title: "OB会からの寄付", text: "OB会から「頑張っているチームへ」と寄付の申し出があった。",
    choices: [
      { label: "ありがたく受け取る", result: "運営資金の足しになった。", effects: { budget: 40 } },
      { label: "設備投資に使ってほしいと伝える", result: "OB会の心遣いに選手たちも奮起した。", effects: { budget: 15, rosterCondAll: 1 } },
    ] },
  { id: "injuryluck", title: "故障中の選手が早期復帰を志願", text: "療養中の選手が「もう大丈夫」と早期復帰を申し出た。",
    choices: [
      { label: "本人の意志を尊重する", result: "気持ちの強さが功を奏し、復帰が早まった。", effects: { injuryReduceRandom: -1 } },
      { label: "医者の指示通り休ませる", result: "無理をさせなかったことで、チーム内に安心感が広がった。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "rivalace", title: "ライバルチームのエースが練習試合を申し込む", text: "ライバルチームのエースから非公式の練習試合を持ちかけられた。",
    choices: [
      { label: "受けて立つ", result: "白熱した練習試合となり、良い経験値になった。", effects: { pointsDelta: 2, rosterFatigueAll: 8 } },
      { label: "今は見送る", result: "無理をせず、来るべき本番に備えた。", effects: { rosterFatigueAll: -5 } },
    ] },
  { id: "sns", title: "選手の一人がSNSで話題に", text: "所属選手の練習動画がSNSでちょっとした話題になった。",
    choices: [
      { label: "話題を後押しする", result: "注目度が上がり、スポンサー筋から反応があった。", effects: { budget: 18, rosterFatigueAll: 3 } },
      { label: "静かに見守る", result: "本人は普段通りのペースを保てた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "travel", title: "遠征中の交通トラブル", text: "遠征先で交通トラブルに巻き込まれ、日程がタイトになった。",
    choices: [
      { label: "予備日を使って調整する", result: "余裕を持って体を休めることができた。", effects: { rosterFatigueAll: -6 } },
      { label: "強行日程で乗り切る", result: "多少の疲労と引き換えに、日程通りの活動費が浮いた。", effects: { budget: 12, rosterFatigueAll: 12 } },
    ] },
  // v12: イベントの種類を増やしてほしいという要望を受けて追加（栄冠ナイン風の「覚醒」
  // 「スランプ」など、選手個人にフォーカスするイベントを中心に拡充）
  { id: "awakening", title: "練習中に選手が覚醒？", text: "いつもの練習中、ある選手が今までにない動きを見せた。手応えを感じているようだ。",
    choices: [
      { label: "そのままとことん追い込ませる", result: "本人の勢いに任せてとことん追い込んだ。", effects: { boostRandomRiderAbilities: 6, rosterFatigueAll: 5 } },
      { label: "無理はさせず切り上げる", result: "興奮を落ち着かせ、無理のない範囲で切り上げた。", effects: { boostRandomRiderAbilities: 3 } },
    ] },
  { id: "slump", title: "選手がスランプ気味に", text: "ある選手が、最近どうも本来の動きができていない様子だ。",
    choices: [
      { label: "とことん話を聞く", result: "じっくり話を聞き、気持ちの整理を手伝った。", effects: { condRandomRider: 1, rosterFatigueAll: -2 } },
      { label: "そっとしておく", result: "本人のペースに任せることにした。", effects: { condRandomRider: -1 } },
    ] },
  { id: "veteranAdvice", title: "伝説のOBがふらりと顔を出す", text: "かつて名を馳せたOBが練習場にふらりと立ち寄り、若手に直接指導してくれた。",
    choices: [
      { label: "指導を仰ぐ", result: "貴重な指導を受け、才能が開花する予感がする。", effects: { growthPowUpgradeRandom: 1, rosterFatigueAll: 4 } },
      { label: "自分たちのやり方を貫く", result: "ありがたい申し出だったが、今のチームの方針を貫いた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "injuryOmen", title: "きしむ体、無理はできない兆候", text: "練習量が積み重なり、選手の一人が体の張りを訴えている。",
    choices: [
      { label: "様子を見ながら続ける", result: "無理をさせず、負荷を落として乗り切った。", effects: { rosterFatigueAll: -10 } },
      { label: "気にせず追い込む", result: "本人の意志を尊重し、通常通りのメニューを続けた。", effects: { rosterFatigueAll: 6, injuryRiskRandom: 1 } },
    ] },
  { id: "teamConflict", title: "選手間でちょっとした衝突", text: "練習方針をめぐって、選手同士でちょっとした言い合いになった。",
    choices: [
      { label: "仲裁に入る", result: "話し合いの場を設け、わだかまりを解消した。", effects: { budget: -10, rosterCondAll: 1 } },
      { label: "本人たちに任せる", result: "干渉せず、当人同士の解決に委ねた。", effects: { rosterCondAll: -1 } },
    ] },
  { id: "wheelMonitor", title: "新型ホイールのモニター依頼", text: "用具メーカーから、開発中の新型ホイールを試してほしいと依頼が来た。",
    choices: [
      { label: "モニターを引き受ける", result: "試作品を受け取った。感触を確かめるのに少し時間を要した。", effects: { wheelGrant: 1, rosterFatigueAll: 3 } },
      { label: "今回は見送る", result: "丁重にお断りしたところ、御礼の品が届いた。", effects: { budget: 10 } },
    ] },
  { id: "teamBonding", title: "選手会主催の親睦会", text: "選手会が主催する食事会が開かれ、チームの雰囲気作りに一役買った。",
    choices: [
      { label: "参加して盛り上げる", result: "和やかな時間を過ごし、チームの結束が深まった。", effects: { rosterCondAll: 1, budget: -8 } },
      { label: "差し入れだけ済ませる", result: "顔は出さず、差し入れだけ届けておいた。", effects: { budget: -3 } },
    ] },
  { id: "hardCamp", title: "有志だけの追加合宿", text: "有志を募っての追加合宿の話が持ち上がった。",
    choices: [
      { label: "実施を後押しする", result: "気合の入った合宿になり、参加した選手たちの動きが良くなった。", effects: { boostRandomRiderAbilities: 4, rosterFatigueAll: 10 } },
      { label: "通常メニューに留める", result: "無理のない範囲での調整に留めた。", effects: { rosterFatigueAll: -5 } },
    ] },
  // v25: イベントの種類をさらに増やしてほしいという要望。ネガティブな不和イベントに
  // 偏らないよう、表彰・地域交流・OB指導など前向き〜中立寄りの出来事を中心に追加
  { id: "cityAward", title: "自治体から表彰の打診", text: "地元自治体から「スポーツ振興功労賞」として表彰したいとの連絡が来た。",
    choices: [
      { label: "表彰式に出席する", result: "晴れやかな式典となり、地域からの支援がさらに厚くなった。", effects: { budget: 22, rosterCondAll: 1 } },
      { label: "書面での受賞に留める", result: "式典は辞退したが、記念品と共に祝い金が届いた。", effects: { budget: 12 } },
    ] },
  { id: "obCoach", title: "OB選手が臨時コーチとして参加", text: "現役時代に鳴らしたOBが、臨時コーチとして数日帯同してくれることになった。",
    choices: [
      { label: "みっちり指導を受ける", result: "実戦的な指導が刺激になり、成長のコツを掴んだ選手が出た。", effects: { growthPowUpgradeRandom: 1, rosterFatigueAll: 6 } },
      { label: "軽めのアドバイスに留める", result: "無理のない範囲で助言をもらい、和やかな雰囲気で終えた。", effects: { rosterCondAll: 1 } },
    ] },
  { id: "nutritionist", title: "栄養士から食事指導の提案", text: "スポーツ栄養士から、選手向けの食事メニュー指導をしたいと申し出があった。",
    choices: [
      { label: "全員で指導を受ける", result: "食生活が見直され、体調管理の意識が高まった。", effects: { rosterCondAll: 1, rosterFatigueAll: -6 } },
      { label: "希望者だけに任せる", result: "関心のある選手だけが指導を受け、無理のない範囲で取り入れた。", effects: { rosterFatigueAll: -3 } },
    ] },
  { id: "localFestival", title: "地域の自転車イベントとの日程調整", text: "近隣で行われる自転車の地域イベントと練習日程が重なりそうだ。",
    choices: [
      { label: "イベントに協力する", result: "地域との関係を優先し、日程を調整して協力した。多少慌ただしくなった。", effects: { budget: 14, rosterFatigueAll: 7 } },
      { label: "練習を優先する", result: "予定通り練習に専念し、コンディションを整えた。", effects: { rosterFatigueAll: -8 } },
    ] },
  { id: "youngTalentBuzz", title: "育成選手の走りが評判に", text: "若手選手の練習での走りが、関係者の間でひそかに評判になっているらしい。",
    choices: [
      { label: "期待に応えるよう後押しする", result: "期待を力に変え、練習に一段と熱が入った。", effects: { boostRandomRiderAbilities: 5, rosterFatigueAll: 6 } },
      { label: "焦らず見守る", result: "プレッシャーをかけずに見守ることにした。", effects: { condRandomRider: 1 } },
    ] },
];

export const ML_BACKGROUNDS = {
  highschool: { label: "高校卒", age: 18, powerBase: 40, growth: "late", powDist: [0.16, 0.46, 0.80],
    desc: "能力はまだ粗削りだが伸びしろは最大級。長い目で育てる叩き上げタイプ",
    // v36(#4): 叩き上げ＝デビュー時に成長力が1段階上がる抽選（伸びしろの天井を狙える）
    perk: { growthLottery: 0.55 },
    meritLabel: "🌱 叩き上げ", merit: "伸びしろ最大＆最長キャリア。デビュー時に55%で成長力が1段階アップ（才能の天井が高い）" },
  university: { label: "大学卒", age: 22, powerBase: 50, growth: "normal", powDist: [0.08, 0.30, 0.65],
    desc: "能力・伸びしろのバランス型。安定した成長曲線が魅力",
    // v36(#4): 文武両道＝学生時代の実績で早くから注目される（人気→スポンサー収入）＋若き才「天才肌」
    perk: { popBonus: 16, startAbility: "genius_sp" },
    meritLabel: "🎓 文武両道", merit: "バランス型。初期人気+16（スポンサー収入が早い）＆「天才肌」持ちでデビュー（25歳までの伸びが速い）" },
  corporate: { label: "実業団卒", age: 25, powerBase: 58, growth: "early", powDist: [0.02, 0.12, 0.40],
    desc: "即戦力級の完成度を持つが、伸びしろは小さめ",
    // v36(#4): 即戦力＝実戦仕込みの完成度。高い初期評価で早くからエース起用・好条件移籍、支度金つき
    perk: { evalBonus: 12, moneyBonus: 100, startAbility: "engine" },
    meritLabel: "💼 即戦力", merit: "高い完成度で即通用。初期監督評価+12（早くからエース起用・好条件の移籍）＆支度金+100万＆「無尽蔵のエンジン」持ち" },
};

// v36(#8): 取材・私生活イベントを有意義に。各選択が「人気（＝スポンサー収入）」「メンタル
// （＝フォーム安定・大舞台）」「監督評価」「地力」「疲労」のどれかに実効的に効く二択へ強化。
// フレーバーだけの微差をやめ、育成方針として選ぶ意味を持たせた（効果は結果画面に明示）。
export const ML_EVENTS = [
  { title: "地元メディアの取材", text: "地元テレビ局が調子について取材したいと申し出た。",
    choices: [
      { label: "前向きにアピールする", result: "自信に満ちた受け答えでファンの心を掴んだ。知名度が上がった。", effects: { popularityDelta: 7, fatigueDelta: 5 } },
      { label: "謙虚に落ち着いて答える", result: "気負わぬ受け答えが好感を呼び、自分自身も平常心を取り戻せた。", effects: { mentalDelta: 3, fatigueDelta: -5 } },
    ] },
  { title: "個人スポンサーとの会食", text: "個人スポンサーの担当者から食事に誘われた。",
    choices: [
      { label: "しっかり交流する", result: "関係を深め、スポンサーの期待と信頼を勝ち取った。", effects: { popularityDelta: 5, managerEvalDelta: 3, fatigueDelta: 8 } },
      { label: "早めに切り上げて休む", result: "体調を最優先し、しっかり英気を養った。", effects: { fatigueDelta: -14, mentalDelta: 1 } },
    ] },
  { title: "実家に顔を出す", text: "オフの合間、久しぶりに実家に顔を出した。",
    choices: [
      { label: "ゆっくり心身を休める", result: "家族と過ごす時間に心がほぐれ、疲れも気持ちの張りもすっかり抜けた。", effects: { fatigueDelta: -28, mentalDelta: 3 } },
      { label: "地元で自主トレに励む", result: "慣れた道での鍛錬で、地力が確かに一段上がった。", effects: { abBoost: 4, fatigueDelta: 6 } },
    ] },
  { title: "ライバルからの挑発", text: "SNSでライバル選手から挑発めいた投稿があった。",
    choices: [
      { label: "闘志を燃やす", result: "負けん気に火がつき、練習に鬼気迫る熱が入った。心も鍛えられた。", effects: { abBoost: 3, mentalDelta: 2, fatigueDelta: 10 } },
      { label: "泰然と受け流す", result: "動じず受け流したことで、勝負所での胆力が一段増した。", effects: { mentalDelta: 4, fatigueDelta: -3 } },
    ] },
  { title: "監督との面談", text: "監督に呼ばれ、今後の起用方針について話をした。",
    choices: [
      { label: "エースを目指したいと伝える", result: "強い意欲が評価され、起用の期待が高まった。", effects: { managerEvalDelta: 7, mentalDelta: 1, fatigueDelta: 5 } },
      { label: "チームのために尽くすと伝える", result: "誠実な姿勢が厚い信頼につながった。", effects: { managerEvalDelta: 9, fatigueDelta: -4 } },
    ] },
  { title: "違和感のある一日", text: "練習中、脚に軽い張りを感じた。",
    choices: [
      { label: "無理せず入念にケアする", result: "早めのケアで大事に至らず、コンディションも上向いた。", effects: { fatigueDelta: -18, formDelta: 4 } },
      { label: "気にせず追い込む", result: "その日は乗り切って地力を伸ばしたが、疲労が深く残った。", effects: { abBoost: 3, fatigueDelta: 18 } },
    ] },
  { title: "地元の子供たちからサイン会の依頼", text: "地域の子供向けサイクリング教室から、サイン会に来てほしいと依頼が来た。",
    choices: [
      { label: "喜んで引き受ける", result: "子供たちの憧れの眼差しに応え、地域の人気者になった。", effects: { popularityDelta: 7, fatigueDelta: 4 } },
      { label: "手紙とサイン色紙を送る", result: "無理のない形で気持ちを届け、穏やかに過ごせた。", effects: { popularityDelta: 2, fatigueDelta: -6, mentalDelta: 1 } },
    ] },
  { title: "先輩選手から食事に誘われる", text: "チームの先輩から「たまには飯でも」と誘われた。",
    choices: [
      { label: "経験談を聞かせてもらう", result: "修羅場をくぐった先輩の言葉が、走りと心の糧になった。", effects: { abBoost: 2, mentalDelta: 2, fatigueDelta: 2 } },
      { label: "気楽に楽しむ", result: "肩の力を抜いた時間で、しっかりリフレッシュできた。", effects: { fatigueDelta: -10, mentalDelta: 1 } },
    ] },
  { title: "新しいトレーニング理論の紹介", text: "海外で話題のトレーニング理論を紹介する記事を読んだ。",
    choices: [
      { label: "さっそく取り入れてみる", result: "新しい刺激が体に変化をもたらし、地力が伸びた。", effects: { abBoost: 4, fatigueDelta: 8 } },
      { label: "今のやり方を信じて貫く", result: "積み上げた流儀を貫く覚悟が、揺るがぬ芯を育てた。", effects: { mentalDelta: 3, fatigueDelta: -2 } },
    ] },
  { title: "地方紙にインタビューが掲載", text: "地方紙の取材を受けた記事が、思いのほか大きく掲載された。",
    choices: [
      { label: "手応えを噛みしめる", result: "評価される実感が自信となり、知名度も評価も上がった。", effects: { popularityDelta: 5, managerEvalDelta: 2 } },
      { label: "浮かれず淡々と過ごす", result: "平常心を崩さず、次に向けて心を整えた。", effects: { mentalDelta: 2, fatigueDelta: -4 } },
    ] },
  // v36(#8): 私生活の充実を描く新イベント（休息・趣味・恋愛・地域貢献）
  { title: "束の間のオフ、趣味に没頭", text: "レースの合間、久しぶりにまとまった休みが取れた。",
    choices: [
      { label: "何も考えず好きなことに使う", result: "完全に頭を空にして遊んだ。心のコップが満たされ、気力が漲ってきた。", effects: { mentalDelta: 4, fatigueDelta: -12 } },
      { label: "体を動かしてアクティブに過ごす", result: "オフでも軽く汗を流し、体を鈍らせずに保った。", effects: { abBoost: 2, formDelta: 3, fatigueDelta: -4 } },
    ] },
  { title: "ファンからの応援の手紙", text: "闘病中の少年から「あなたの走りに勇気をもらった」という手紙が届いた。",
    choices: [
      { label: "返事を書き、必ず勝つと誓う", result: "誰かの希望である責任が、静かな闘志となって胸に宿った。", effects: { mentalDelta: 4, popularityDelta: 3 } },
      { label: "そっと胸にしまい走りで応える", result: "言葉より走りで応えると決め、練習にも身が入った。", effects: { abBoost: 2, mentalDelta: 2, fatigueDelta: 5 } },
    ] },
];

// v36(#9): 性格ベースの私生活イベント（マイライフ）。プレイヤー自身の性格に応じた出来事が起き、
// その性格らしい二択を選ぶ。取材・私生活イベントの一部として、性格を持つ選手にだけ差し込まれる。
export const ML_PERSONALITY_EVENTS = {
  hotblood: [
    { title: "抑えきれない闘志", text: "レースの映像を見返すうち、悔しさと闘志がこみ上げて眠れなくなった。",
      choices: [
        { label: "衝動のまま夜通し追い込む", result: "燃え上がる情熱を練習にぶつけ、地力を一気に引き上げた。反動で疲労は深い。", effects: { abBoost: 4, fatigueDelta: 14 } },
        { label: "深呼吸して頭を冷やす", result: "昂りを鎮め、勝負所で活きる冷静さを手に入れた。", effects: { mentalDelta: 4, fatigueDelta: -8 } },
      ] },
  ],
  seeker: [
    { title: "強さへの探求", text: "「本当の強さとは何か」──答えを求め、あなたは自分と向き合っていた。",
      choices: [
        { label: "限界の先へ体を追い込む", result: "苦しみの果てに、また一つ壁を越えた。", effects: { abBoost: 4, fatigueDelta: 12 } },
        { label: "走りを理論で見つめ直す", result: "感覚を言語化し、揺るがぬ芯を得た。", effects: { mentalDelta: 4 } },
      ] },
  ],
  artisan: [
    { title: "細部への こだわり", text: "職人肌のあなたは、ペダリングと機材の詰めが気になって仕方がない。",
      choices: [
        { label: "納得いくまで突き詰める", result: "無駄のない動きが仕上がり、当日の仕上がりが一段上がった。", effects: { formDelta: 7, fatigueDelta: 4 } },
        { label: "実戦感覚を優先する", result: "机上より実走を選び、地力を確かに伸ばした。", effects: { abBoost: 3 } },
      ] },
  ],
  free: [
    { title: "気の向くままに", text: "自由人のあなたは、ふと思い立って予定のない一日を過ごすことにした。",
      choices: [
        { label: "何にも縛られず遊ぶ", result: "心が軽くなり、また走りたい気持ちが湧いてきた。", effects: { mentalDelta: 4, fatigueDelta: -10 } },
        { label: "気ままにペダルを回す", result: "遊びのように走るうち、体も動きも自然と整った。", effects: { abBoost: 2, formDelta: 3 } },
      ] },
  ],
  smart: [
    { title: "データとの対話", text: "智将肌のあなたは、パワーデータとレース映像を照らし合わせて分析に没頭した。",
      choices: [
        { label: "弱点をピンポイント補強", result: "課題を的確に潰し、効率よく地力を伸ばした。", effects: { abBoost: 3 } },
        { label: "レース展開を読み込む", result: "勝ち筋のパターンが頭に入り、仕上がりと胆力が増した。", effects: { mentalDelta: 2, formDelta: 4 } },
      ] },
  ],
  genius: [
    { title: "持て余す才能", text: "何をやっても人よりできてしまう。天才肌のあなたは、少し退屈さえ感じていた。",
      choices: [
        { label: "自らに高い課題を課す", result: "歯応えのある挑戦に才能がさらに開花した。", effects: { abBoost: 4, fatigueDelta: 8 } },
        { label: "感覚のままに流す", result: "肩の力を抜いて走ると、不思議と調子が上向いた。", effects: { formDelta: 5 } },
      ] },
  ],
  maverick: [
    { title: "孤高の流儀", text: "チームの輪に馴染めない自分に、周囲は戸惑っている。だが群れないのがあなたの生き方だ。",
      choices: [
        { label: "独りで黙々と鍛える", result: "誰にも合わせず限界まで追い込み、独走の地力を磨き上げた。", effects: { abBoost: 4, fatigueDelta: 10 } },
        { label: "少しだけ歩み寄る", result: "柄にもなく仲間と言葉を交わし、張り詰めていた心がほぐれた。", effects: { mentalDelta: 3, fatigueDelta: -6 } },
      ] },
  ],
  showman: [
    { title: "魅せる走りへの情熱", text: "「速いだけじゃ面白くない」。観客を沸かせる派手な勝ち方こそ、あなたの美学だ。",
      choices: [
        { label: "スター性で人気を掴む", result: "魅せる走りがファンを熱狂させ、知名度がぐっと上がった。", effects: { popularityDelta: 8, fatigueDelta: 3 } },
        { label: "地道に瞬発力を磨く", result: "派手さの裏に確かな技術を。ラストの切れ味が増した。", effects: { abBoost: 3, formDelta: 3 } },
      ] },
  ],
  tactician: [
    { title: "レース盤面の研究", text: "策士のあなたは、あらゆる展開を想定して勝ち筋を組み立てるのが何より好きだ。",
      choices: [
        { label: "徹底的に戦術を練る", result: "無数の展開を頭に叩き込み、勝負勘と冷静さが研ぎ澄まされた。", effects: { mentalDelta: 4, formDelta: 2 } },
        { label: "机上より実走で試す", result: "理論を実戦で検証し、走力そのものを一段引き上げた。", effects: { abBoost: 3, fatigueDelta: 5 } },
      ] },
  ],
};

export const ML_SPONSOR_GIGS = [
  { title: "スポーツ用品ブランドのCM撮影", text: "個人スポンサーから、新製品のテレビCM出演のオファーが届いた。",
    baseMoney: 30, moneyPerPop: 1.2, pop: 3, fatigue: 12,
    acceptResult: "スタジオでの終日撮影をこなした。露出が増え、知名度がぐっと上がった。" },
  { title: "自転車雑誌の表紙撮影", text: "有名自転車雑誌から、表紙モデルとしての撮影依頼が来た。",
    baseMoney: 24, moneyPerPop: 1.0, pop: 3, fatigue: 9,
    acceptResult: "こだわりの撮影は長丁場だったが、雑誌の表紙を飾ることで注目が集まった。" },
  { title: "トークショー・ファンイベント出演", text: "スポンサー主催のファンイベントに、ゲストとして招かれた。",
    baseMoney: 20, moneyPerPop: 0.8, pop: 4, fatigue: 8,
    acceptResult: "ファンとの交流イベントは大盛況。多くの応援を背に受けることになった。" },
  { title: "地域プロモーション動画への出演", text: "地元自治体との共同で、地域を盛り上げるプロモ動画への出演依頼が来た。",
    baseMoney: 26, moneyPerPop: 1.0, pop: 2, fatigue: 10,
    acceptResult: "地域と一体になったプロモーションは好評で、応援の輪が広がった。" },
];

