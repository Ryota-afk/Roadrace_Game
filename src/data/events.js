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
    meritLabel: "叩き上げ", merit: "伸びしろ最大＆最長キャリア。デビュー時に55%で成長力が1段階アップ（才能の天井が高い）" },
  university: { label: "大学卒", age: 22, powerBase: 50, growth: "normal", powDist: [0.08, 0.30, 0.65],
    desc: "能力・伸びしろのバランス型。安定した成長曲線が魅力",
    // v36(#4): 文武両道＝学生時代の実績で早くから注目される（人気→スポンサー収入）＋若き才「天才肌」
    perk: { popBonus: 16, startAbility: "genius_sp" },
    meritLabel: "文武両道", merit: "バランス型。初期人気+16（スポンサー収入が早い）＆「天才肌」持ちでデビュー（25歳までの伸びが速い）" },
  corporate: { label: "実業団卒", age: 25, powerBase: 58, growth: "early", powDist: [0.02, 0.12, 0.40],
    desc: "即戦力級の完成度を持つが、伸びしろは小さめ",
    // v36(#4): 即戦力＝実戦仕込みの完成度。高い初期評価で早くからエース起用・好条件移籍、支度金つき
    perk: { evalBonus: 12, moneyBonus: 100, startAbility: "engine" },
    meritLabel: "即戦力", merit: "高い完成度で即通用。初期監督評価+12（早くからエース起用・好条件の移籍）＆支度金+100万＆「無尽蔵のエンジン」持ち" },
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

  // v43(マイライフ難易度調整Phase 2): イベント拡充第1弾。取材・私生活イベントの手動ボタンを
  // 廃止し受動発火（controllers/mylife/month.js）へ移行したのに合わせ、内容も大幅拡充した。
  // 「数百種類」という長期目標に向けた最初のバッチ（詳細はDEVLOG参照）。カテゴリ構成：
  // ①個別能力ブースト(abKeyDelta) ②新ステ変動(breakthrough/stability/luckDelta)
  // ③賭け（outcomes） ④覚醒級（weight低・growthPowBump/talentCapDelta） ⑤悪イベント(bad:true)。
  // 今後さらに追加していく前提のため、新規カテゴリを増やす時もこの5分類のタグ付け方針
  // （bad/weight/outcomes/abKeyDelta等）をそのまま踏襲すること。

  // --- ①個別能力ブースト（abKeyDelta） ---
  { title: "スプリントの感覚を掴んだ夜", text: "動画で自分のフォームを見返すうち、ラストの一漕ぎに無駄があると気づいた。",
    choices: [
      { label: "深夜のローラーで矯正する", result: "無駄な力みが抜け、鋭いキレを掴んだ手応えがあった。", effects: { abKeyDelta: { sprint: 6 }, fatigueDelta: 6 } },
      { label: "翌朝のメニューに落とし込む", result: "焦らず翌日の練習に反映し、着実に体へ馴染ませた。", effects: { abKeyDelta: { sprint: 4 } } },
    ] },
  { title: "登坂の呼吸法を教わる", text: "ヒルクライムを得意とする先輩が、呼吸のリズムのコツをふと教えてくれた。",
    choices: [
      { label: "すぐさま坂で試す", result: "教わった呼吸法がハマり、登りの脚が一段軽くなった。", effects: { abKeyDelta: { climb: 6 }, fatigueDelta: 5 } },
      { label: "ノートに書き留めて反芻する", result: "頭で整理してから体に落とし込み、着実にモノにした。", effects: { abKeyDelta: { climb: 4 }, mentalDelta: 2 } },
    ] },
  { title: "平坦巡航フォームの見直し", text: "風洞実験の映像を見て、自分の巡航姿勢のロスに気づいた。",
    choices: [
      { label: "空気抵抗を突き詰める", result: "姿勢を作り直し、巡航速度が明らかに変わった。", effects: { abKeyDelta: { flat: 6 }, fatigueDelta: 6 } },
      { label: "無理のない範囲で微調整", result: "体に負担をかけない範囲で整え、無理なく地力を伸ばした。", effects: { abKeyDelta: { flat: 4 } } },
    ] },
  { title: "高地トレーニングの収穫", text: "短期の高地合宿から戻り、体の変化を感じている。",
    choices: [
      { label: "そのままの勢いで走り込む", result: "高地で鍛えた心肺の貯金を、平地でさらに伸ばした。", effects: { abKeyDelta: { stamina: 6 }, fatigueDelta: 8 } },
      { label: "順応期間としっかり休む", result: "体を慣らしながら、無理なく高地の成果を定着させた。", effects: { abKeyDelta: { stamina: 4 }, fatigueDelta: -5 } },
    ] },
  { title: "独走のペース配分を掴む", text: "ひとりで長距離を走り込むうち、体内時計のようなペース感覚が掴めてきた。",
    choices: [
      { label: "限界までペースを刻んでみる", result: "均一なペースで押し切る感覚を体に叩き込んだ。", effects: { abKeyDelta: { solo: 6 }, fatigueDelta: 7 } },
      { label: "余力を残して感覚を確かめる", result: "無理のない範囲で反復し、着実にペース感覚を磨いた。", effects: { abKeyDelta: { solo: 4 } } },
    ] },
  { title: "チームメイトとの実戦形式練習", text: "オフの日、有志で実戦さながらの追い込み練習をすることになった。",
    choices: [
      { label: "アタック役を買って出る", result: "本番さながらの緊張感で、登りとスプリントの両方が磨かれた。", effects: { abKeyDelta: { climb: 3, sprint: 3 }, fatigueDelta: 10 } },
      { label: "牽引役に徹する", result: "淡々と牽くうち、平坦とスタミナの地力が底上げされた。", effects: { abKeyDelta: { flat: 3, stamina: 3 }, fatigueDelta: 8 } },
    ] },
  { title: "映像分析ミーティング", text: "スタッフとレース映像を見ながら、自分の展開パターンを洗い出した。",
    choices: [
      { label: "得意分野をさらに伸ばす方針にする", result: "強みを言語化できたことで、狙った能力が伸びやすくなった。", effects: { abBoost: 3, mentalDelta: 2 } },
      { label: "弱点の底上げを優先する方針にする", result: "課題が明確になり、苦手分野の伸びしろに手が届いた。", effects: { abKeyDelta: { climb: 4, solo: 4 } } },
    ] },
  { title: "栄養士との面談", text: "チーム専属の栄養士から、食生活の見直しを提案された。",
    choices: [
      { label: "本格的に食事管理を始める", result: "体が軽くなった実感があり、練習の質そのものが上がった。", effects: { abBoost: 3, fatigueDelta: -6 } },
      { label: "無理なく続けられる範囲で試す", result: "負担のない改善で、じわりと体調が上向いた。", effects: { fatigueDelta: -12, mentalDelta: 2 } },
    ] },

  // --- ②新ステ変動（breakthroughDelta/stabilityDelta/luckDelta） ---
  { title: "壁を越えた感覚", text: "何度も跳ね返されていた課題を、ふとしたきっかけで初めて突破できた。",
    choices: [
      { label: "その勢いのまま追い込む", result: "限界の先にまだ伸びしろがあると体で知った。今後、能力が頭打ちになりにくくなった気がする。", effects: { breakthroughDelta: 5, fatigueDelta: 10 } },
      { label: "この感覚を大切に持ち帰る", result: "焦らず感覚を反芻し、確かな手応えとして刻み込んだ。", effects: { breakthroughDelta: 3, mentalDelta: 2 } },
    ] },
  { title: "限界突破のヒント", text: "ベテラン選手から「壁は気持ちひとつで薄くなる」という言葉をもらった。",
    choices: [
      { label: "言葉の意味を体で確かめる", result: "限界だと思っていたラインの先に、まだ余地があると気づいた。", effects: { breakthroughDelta: 4 } },
      { label: "心に留めて日々を過ごす", result: "焦らずその言葉を胸に、腐らず練習を積んだ。", effects: { breakthroughDelta: 2, mentalDelta: 2 } },
    ] },
  { title: "メンタルコーチとの対話", text: "チーム専属のメンタルコーチと、調子の波との付き合い方について話した。",
    choices: [
      { label: "波を受け入れるコツを学ぶ", result: "好不調の波そのものを穏やかに捉えられるようになった。", effects: { stabilityDelta: 5 } },
      { label: "ルーティンを一緒に作る", result: "毎日決まった手順を踏むことで、調子が崩れにくくなった。", effects: { stabilityDelta: 4, formDelta: 3 } },
    ] },
  { title: "自分なりのルーティンの確立", text: "レース前に必ず行う一連の動作が、いつの間にか体に染みついていた。",
    choices: [
      { label: "さらに徹底して守り抜く", result: "決まった手順が心の支えとなり、調子が乱れにくくなった。", effects: { stabilityDelta: 5, fatigueDelta: 3 } },
      { label: "肩の力を抜いて緩やかに続ける", result: "無理なく続けられる形に整え、じわりと安定感が増した。", effects: { stabilityDelta: 3, mentalDelta: 2 } },
    ] },
  { title: "小さなお守り", text: "応援してくれる人から、ささやかなお守りをもらった。ジンクスのように大切にしている。",
    choices: [
      { label: "肌身離さず持ち歩く", result: "根拠はなくとも、なぜか物事が上向く気がしてならない。", effects: { luckDelta: 5, mentalDelta: 2 } },
      { label: "感謝を伝え、気持ちを新たにする", result: "支えてくれる人の存在に気づけたことが、何よりの財産になった。", effects: { luckDelta: 3, popularityDelta: 2 } },
    ] },
  { title: "縁のめぐり合わせ", text: "何気ない偶然の出会いが、思いがけず良い方向に転がり続けている。",
    choices: [
      { label: "この流れに素直に乗ってみる", result: "不思議と物事がうまく噛み合う日々が続いている。", effects: { luckDelta: 5 } },
      { label: "浮かれず地に足つけて過ごす", result: "浮つかず淡々と過ごしたことが、かえって良い流れを呼んだ。", effects: { luckDelta: 3, mentalDelta: 2 } },
    ] },

  // --- ③賭け（outcomesによる確率分岐。選んだ瞬間には結果が決まっていない） ---
  { title: "旅の行商人と謎の秘薬", text: "遠征先の路地裏で、怪しい行商人が「これを飲めば見違える」と謎の秘薬を差し出してきた。",
    choices: [
      { label: "断って立ち去る", result: "怪しさに勝てず、丁重に断った。", effects: { fatigueDelta: -2 } },
      { label: "半信半疑で飲んでみる",
        outcomes: [
          { weight: 0.28, result: "体の奥から力が漲るのを感じた……まさか本物だったとは！", effects: { abBoost: 6, breakthroughDelta: 3 } },
          { weight: 0.72, result: "ただ苦いだけの謎の液体だった。しばらく胃もたれが続いた。", effects: { fatigueDelta: 10, mentalDelta: -2 } },
        ] },
    ] },
  { title: "自称・伝説の元プロによる特訓", text: "「儂の指導を受ければ生まれ変わる」。素性の知れない老人が特訓を持ちかけてきた。",
    choices: [
      { label: "丁重にお断りする", result: "得体が知れず、大人しく通常メニューをこなした。", effects: {} },
      { label: "藁にもすがる思いで受けてみる",
        outcomes: [
          { weight: 0.25, result: "口だけではなかった。的確な指摘の連続で、目の覚めるような成長を遂げた。", effects: { abBoost: 8, fatigueDelta: 14 } },
          { weight: 0.35, result: "自己流の精神論に終始し、疲れだけが残った。", effects: { fatigueDelta: 16, mentalDelta: -3 } },
          { weight: 0.40, result: "無難に基礎の再確認ができた程度だった。", effects: { abBoost: 2, fatigueDelta: 8 } },
        ] },
    ] },
  { title: "占い師のジンクス", text: "たまたま入った占いの館で、「今週のあなたの運勢」を占ってもらえることになった。",
    choices: [
      { label: "興味本位で聞いてみる",
        outcomes: [
          { weight: 0.3, result: "「大吉。今のあなたには何をしても弾みがつく」――言われてみると、本当にそんな気がしてきた。", effects: { luckDelta: 8, mentalDelta: 3 } },
          { weight: 0.3, result: "「小凶。慎重に過ごしなさい」――妙に不安が残り、練習にも身が入らなかった。", effects: { luckDelta: -5, mentalDelta: -2 } },
          { weight: 0.4, result: "当たり障りのない結果で、特に気にせず過ごした。", effects: {} },
        ] },
      { label: "占いなど信じないと聞き流す", result: "自分の力を信じ、いつも通り淡々と過ごした。", effects: { mentalDelta: 2 } },
    ] },
  { title: "峠の茶屋の謎かけ", text: "山岳ステージの下見中に立ち寄った茶屋の店主から、妙な謎かけを持ちかけられた。",
    choices: [
      { label: "受けて立つ",
        outcomes: [
          { weight: 0.3, result: "見事に答えを言い当てると、店主が「お前さんは大成する」と太鼓判を押してくれた。妙に自信がついた。", effects: { breakthroughDelta: 6, mentalDelta: 3 } },
          { weight: 0.5, result: "答えられずに悔しい思いをした。少し落ち込みつつ峠を後にした。", effects: { mentalDelta: -3 } },
          { weight: 0.2, result: "店主が上機嫌になり、名物の団子をご馳走してくれた。ただそれだけの一日だった。", effects: { fatigueDelta: -8 } },
        ] },
      { label: "苦笑いで受け流す", result: "謎かけには付き合わず、下見に集中した。", effects: {} },
    ] },
  { title: "海外遠征先の怪しいマッサージ師", text: "遠征先のホテルで、「疲労を根こそぎ取り除く」という触れ込みの施術師を紹介された。",
    choices: [
      { label: "断って自分のケアを続ける", result: "使い慣れたセルフケアで、無難に疲れを抜いた。", effects: { fatigueDelta: -10 } },
      { label: "思い切って施術を受ける",
        outcomes: [
          { weight: 0.35, result: "驚くほど体が軽くなった。長年の張りまで取れたような感覚だ。", effects: { fatigueDelta: -30, formDelta: 6 } },
          { weight: 0.35, result: "力加減が強すぎて、逆に体が張ってしまった。", effects: { fatigueDelta: 12, formDelta: -4 } },
          { weight: 0.3, result: "可もなく不可もない、普通のマッサージだった。", effects: { fatigueDelta: -8 } },
        ] },
    ] },
  { title: "深夜ジムの謎のトレーナー", text: "誰もいないはずの深夜のジムに、見知らぬトレーナーがいて「特別メニューをやってみないか」と誘われた。",
    choices: [
      { label: "怪しみつつも断る", result: "いつも通りのメニューをこなし、静かにジムを後にした。", effects: {} },
      { label: "興味半分で付き合ってみる",
        outcomes: [
          { weight: 0.2, result: "常識外れの負荷設定だったが、終えてみると別人のような力が漲っていた。", effects: { abBoost: 5, breakthroughDelta: 4, fatigueDelta: 15 } },
          { weight: 0.5, result: "無茶な内容についていけず、翌日まで疲労を引きずった。", effects: { fatigueDelta: 22, formDelta: -5 } },
          { weight: 0.3, result: "翌朝には姿が無く、夢だったのかと首を傾げるだけの一夜だった。", effects: { fatigueDelta: 6 } },
        ] },
    ] },

  // --- ④覚醒級（weightを低くし滅多に引かない。growthPowBump/talentCapDelta等） ---
  { title: "才能が一気に開花した夜", text: "その日の練習は、これまでの自分とは何かが違っていた。体の隅々まで力が満ちていくのが分かる。",
    weight: 0.15,
    choices: [
      { label: "この感覚を確かめ尽くす", result: "殻を破ったような手応え。周囲も「別人のようだ」と驚くほどの変化だった。", effects: { growthPowBump: true, fatigueDelta: 10 } },
      { label: "静かに受け止め、次に備える", result: "興奮を抑えつつ、この覚醒を確かなものにするため冷静に体を休めた。", effects: { growthPowBump: true, fatigueDelta: -6, mentalDelta: 3 } },
    ] },
  { title: "限界そのものが押し広がる経験", text: "極限まで自分を追い込んだ末に、これまでの「限界」という概念そのものが塗り替わる感覚を味わった。",
    weight: 0.15,
    choices: [
      { label: "この経験を体に刻み込む", result: "才能の天井そのものが、確かに一段押し上がったように感じる。", effects: { talentCapDelta: 4, breakthroughDelta: 5, fatigueDelta: 12 } },
      { label: "無理をせず、じっくり定着させる", result: "焦らず時間をかけて、この飛躍をしっかり自分のものにした。", effects: { talentCapDelta: 3, fatigueDelta: -4 } },
    ] },
  { title: "会心のレース感覚", text: "練習中のもがきで、これまで届かなかった領域に手が届いた。体が勝手に動く、そんな感覚だった。",
    weight: 0.2,
    choices: [
      { label: "この感覚のまま突き詰める", result: "会心の走りが、能力そのものを一段引き上げた。", effects: { abBoost: 10, breakthroughDelta: 4, fatigueDelta: 16 } },
      { label: "冷静に言語化して持ち帰る", result: "感覚を分析し、再現できる形で体に刻み込んだ。", effects: { abBoost: 7, mentalDelta: 3, fatigueDelta: 8 } },
    ] },
  { title: "運命が味方した瞬間", text: "偶然が偶然を呼ぶような、出来過ぎた巡り合わせが立て続けに起きた一週間だった。",
    weight: 0.15,
    choices: [
      { label: "この流れに全力で乗る", result: "何をやってもうまくいく感覚のまま、大きな飛躍を掴んだ。", effects: { luckDelta: 10, abBoost: 5, popularityDelta: 5 } },
      { label: "浮かれすぎず、噛みしめる", result: "この巡り合わせに感謝しつつ、地に足つけて力に変えた。", effects: { luckDelta: 8, mentalDelta: 4 } },
    ] },

  // --- ⑤悪イベント（bad:true。luckが低いほど引きやすい。軽微なものから応相応に重いものまで） ---
  { title: "SNSでの失言", text: "何気なく投稿した一言が、意図しない形で炎上してしまった。", bad: true,
    choices: [
      { label: "すぐに訂正・謝罪する", result: "早めの対応で被害は最小限に留まったが、後味の悪さが残った。", effects: { popularityDelta: -4, mentalDelta: -2 } },
      { label: "静観して嵐が過ぎるのを待つ", result: "沈黙を貫いたが、その間じわじわと評判を落とした。", effects: { popularityDelta: -6 } },
    ] },
  { title: "寝坊で朝練を欠席", bad: true, text: "うっかり寝坊し、大事な朝練を欠席してしまった。",
    choices: [
      { label: "素直に反省し埋め合わせる", result: "反省してメニューを埋め合わせたが、リズムを崩してしまった。", effects: { formDelta: -4, fatigueDelta: 5 } },
      { label: "気にせず切り替える", result: "引きずらないようにしたが、少しペースが狂った。", effects: { formDelta: -3 } },
    ] },
  { title: "チーム内の気まずい空気", bad: true, text: "ちょっとした行き違いから、チームメイトとの間に気まずい空気が流れてしまった。",
    choices: [
      { label: "すぐに話し合って解消する", result: "話し合って誤解は解けたが、モヤモヤは少し残った。", effects: { mentalDelta: -2, fatigueDelta: 3 } },
      { label: "時間が解決するのを待つ", result: "気まずさを引きずったまま、練習に集中しづらい日々が続いた。", effects: { mentalDelta: -4 } },
    ] },
  { title: "原因不明のスランプ", bad: true, text: "特に思い当たる理由もないのに、練習の質が上がらない日が続いている。",
    choices: [
      { label: "基礎に立ち返って耐える", result: "焦らず基礎を固めたが、なかなか波を抜け出せなかった。", effects: { stabilityDelta: -5, fatigueDelta: 6 } },
      { label: "気分転換を試みる", result: "気晴らしを挟んだが、不調の波は簡単には収まらなかった。", effects: { stabilityDelta: -4, mentalDelta: -2 } },
    ] },
  { title: "変な癖がついてしまった", bad: true, text: "自己流で試行錯誤するうち、フォームに良くない癖がついてしまったようだ。",
    choices: [
      { label: "自力で矯正を試みる", result: "手探りで直そうとしたが、思うように抜けきらなかった。", effects: { abKeyDelta: { flat: -5 } } },
      { label: "そのまま様子を見る", result: "様子を見るうちに、癖はしばらく残ってしまった。", effects: { abKeyDelta: { sprint: -5 } } },
    ] },
  { title: "過信からの一歩手前", bad: true, text: "調子に乗って追い込みすぎ、怪我一歩手前のヒヤリとする場面があった。",
    choices: [
      { label: "すぐに練習を切り上げる", result: "大事には至らなかったが、疲労が深く残った。", effects: { fatigueDelta: 15, formDelta: -4 } },
      { label: "だましだまし続ける", result: "無理を重ね、フォームも本調子には程遠くなった。", effects: { fatigueDelta: 20, formDelta: -6 } },
    ] },
  { title: "悪いフォームが染みついてしまった", bad: true, text: "長く自覚のないまま走り続けたことで、非効率なフォームがすっかり定着してしまっている。",
    choices: [
      { label: "一から矯正に取り組む", result: "時間はかかったが、少しずつ悪癖を洗い流していった。", effects: { abKeyDelta: { climb: -8 }, fatigueDelta: 10 } },
      { label: "今の走りのまま突き進む", result: "根本の見直しを避けたことで、地力の伸びに影を落とした。", effects: { abKeyDelta: { solo: -8 } } },
    ] },
  { title: "燃え尽き気味の日々", bad: true, text: "目標を見失ったような、何をしても手応えの薄い時期が続いている。",
    choices: [
      { label: "無理に前を向こうとする", result: "空回りするばかりで、なかなか殻を破れなかった。", effects: { breakthroughDelta: -8, mentalDelta: -2 } },
      { label: "しばらく休んで立て直す", result: "休養を優先したが、伸びしろの感覚は鈍ったままだった。", effects: { breakthroughDelta: -6, fatigueDelta: -10 } },
    ] },
  { title: "自信を失うスランプ", bad: true, text: "ちょっとした失敗が積み重なり、自分の走りに自信が持てなくなっている。",
    choices: [
      { label: "無理にでも気持ちを奮い立たせる", result: "空元気で乗り切ろうとしたが、心の乱れは収まらなかった。", effects: { stabilityDelta: -10, mentalDelta: -4 } },
      { label: "誰かに相談してみる", result: "話を聞いてもらい多少は楽になったが、不安定さは残った。", effects: { stabilityDelta: -6, mentalDelta: -2 } },
    ] },
  { title: "忘れ物でリズムが崩れる", bad: true, text: "大事な装備を忘れてしまい、その日一日のリズムが狂ってしまった。",
    choices: [
      { label: "代替品でなんとか乗り切る", result: "急場をしのいだが、いつもの調子は出なかった。", effects: { formDelta: -5, fatigueDelta: 5 } },
      { label: "取りに戻ってやり直す", result: "時間をロスした焦りが、そのまま体に出てしまった。", effects: { formDelta: -4, fatigueDelta: 8 } },
    ] },

  // 第27弾: イベント拡充第2弾（+30件）。v43で確立した5分類のタグ付け方針を踏襲。

  // --- ①個別能力ブースト（abKeyDelta） ---
  { title: "向かい風の日の平坦練", text: "強い向かい風の日。あえて平坦の長い区間で走り込むチャンスでもある。",
    choices: [
      { label: "風に逆らって踏み抜く", result: "重いギアを踏み続けた脚に、確かな巡航力が刻まれた。", effects: { abKeyDelta: { flat: 6 }, fatigueDelta: 7 } },
      { label: "風を読んで省エネで走る", result: "風向きと姿勢の関係を体で学び、無駄のない走りが身についた。", effects: { abKeyDelta: { flat: 4 }, mentalDelta: 2 } },
    ] },
  { title: "近所の激坂チャレンジ", text: "地元で「登れたら一人前」と噂の激坂に、時間を作って挑むことにした。",
    choices: [
      { label: "足つきなしで登り切るまで帰らない", result: "何本目かでついに登り切った。脚に残る痛みが勲章に思えた。", effects: { abKeyDelta: { climb: 6 }, fatigueDelta: 8 } },
      { label: "区間を区切って攻略する", result: "急がば回れ。区間ごとの攻略で、着実に登りの引き出しが増えた。", effects: { abKeyDelta: { climb: 4 } } },
    ] },
  { title: "ゴール勝負に誘われる", text: "練習の締めに、チームメイトから「最後の看板までスプリント勝負」を持ちかけられた。",
    choices: [
      { label: "真っ向から受けて立つ", result: "全力のもがき合いで、トップスピードの伸びが一段変わった。", effects: { abKeyDelta: { sprint: 6 }, fatigueDelta: 6 } },
      { label: "発射のタイミングを研究して挑む", result: "仕掛けどころを考え抜いた勝負は、スプリントの理解を深めた。", effects: { abKeyDelta: { sprint: 4 }, mentalDelta: 2 } },
    ] },
  { title: "ロングライドで掴んだ燃費", text: "休日を使った200kmのロングライド。後半、自分の体の「燃費」が見えてきた気がした。",
    choices: [
      { label: "補給を絞って限界を探る", result: "ぎりぎりの状態で走り続けた経験が、スタミナの底を押し広げた。", effects: { abKeyDelta: { stamina: 6 }, fatigueDelta: 9 } },
      { label: "計画的な補給で走り切る", result: "補給計画どおりに走り切り、長丁場の組み立てが上手くなった。", effects: { abKeyDelta: { stamina: 4 } } },
    ] },
  { title: "ひとりで踏む時間", text: "チーム練の予定が流れ、めずらしく一日をまるごと一人で使えることになった。",
    choices: [
      { label: "誰にも合わせず自分の限界で走る", result: "誰の後ろにも隠れられない時間が、独走の地力を底上げした。", effects: { abKeyDelta: { solo: 6 }, fatigueDelta: 7 } },
      { label: "コース研究を兼ねて淡々と走る", result: "自分のペースを刻み続ける感覚が、独走の自信につながった。", effects: { abKeyDelta: { solo: 4 }, mentalDelta: 2 } },
    ] },
  { title: "ペダリング解析の結果", text: "測定機器を借りてペダリングを解析したところ、左右差と出力の癖がはっきり数字に出た。",
    choices: [
      { label: "巡航の効率を突き詰める", result: "数字を手がかりに回し方を作り替え、巡航の質が上がった。", effects: { abKeyDelta: { flat: 5 }, fatigueDelta: 4 } },
      { label: "もがきの出力を突き詰める", result: "力の逃げを潰していくと、スプリントの出力が目に見えて伸びた。", effects: { abKeyDelta: { sprint: 5 }, fatigueDelta: 4 } },
    ] },
  { title: "苦手つぶし月間", text: "今月は苦手分野に向き合うと決めた。さて、どこから手をつけるか。",
    choices: [
      { label: "逃げていた登りと向き合う", result: "苦手意識の根っこを一つずつ潰し、登りが少し好きになった。", effects: { abKeyDelta: { climb: 5 }, fatigueDelta: 6 } },
      { label: "後半に垂れる悪癖と向き合う", result: "ペース管理と補給を見直し、最後まで垂れない体に近づいた。", effects: { abKeyDelta: { stamina: 5 }, fatigueDelta: 6 } },
    ] },

  // --- ②新ステ変動（breakthrough/stability/luck） ---
  { title: "本番さながらの通し稽古", text: "大一番を想定し、入場からゴールまでの流れを一日かけて再現してみることにした。",
    choices: [
      { label: "勝負どころの一撃を何度も再現する", result: "「ここで行く」という一撃の感覚が、体に深く刻まれた。", effects: { breakthroughDelta: 5, fatigueDelta: 8 } },
      { label: "流れ全体を丁寧になぞる", result: "本番の景色が頭に入り、当日の迷いが減りそうだ。", effects: { breakthroughDelta: 3, mentalDelta: 3 } },
    ] },
  { title: "崩れない走りの研究", text: "どんな日でも大崩れしない選手の走りを、映像で徹底的に研究してみた。",
    choices: [
      { label: "自分の走りに取り入れて試す", result: "淡々と出力を刻む術を試すうち、走りのむらが減ってきた。", effects: { stabilityDelta: 5, fatigueDelta: 5 } },
      { label: "ノートにまとめて引き出しにする", result: "崩れる予兆と立て直し方を整理し、心の保険が一つ増えた。", effects: { stabilityDelta: 3, mentalDelta: 3 } },
    ] },
  { title: "四つ葉のクローバー", text: "練習コースの脇で足を止めた拍子に、四つ葉のクローバーを見つけた。",
    choices: [
      { label: "押し花にして手帳に挟む", result: "小さな幸運のお守りができた。なんだか良いことが起きそうだ。", effects: { luckDelta: 4, mentalDelta: 2 } },
      { label: "その場にそっと残しておく", result: "幸運は独り占めしないことにした。心が少し軽くなった。", effects: { luckDelta: 2, fatigueDelta: -5 } },
    ] },
  { title: "勝負勘を磨く夜", text: "過去レースの分岐点だけを集めた映像を見ながら、「自分ならいつ行くか」を考え続けた。",
    choices: [
      { label: "決断の瞬間を体に覚え込ませる", result: "行くか、待つか。決断の物差しが自分の中にできてきた。", effects: { breakthroughDelta: 4, mentalDelta: 2 } },
      { label: "失敗例から学ぶ", result: "仕掛け損ないの共通点が見え、無駄足が減りそうだ。", effects: { breakthroughDelta: 3, stabilityDelta: 2 } },
    ] },
  { title: "朝のルーティンを整える", text: "起床から練習開始までの流れがばらばらなことに気づき、朝の過ごし方を見直すことにした。",
    choices: [
      { label: "分刻みの型を作って守る", result: "毎朝同じ流れで体が起きるようになり、走り出しが安定した。", effects: { stabilityDelta: 5 } },
      { label: "ゆとり重視のゆるい型にする", result: "余白のある朝は心にも効いた。落ち着いて一日に入れる。", effects: { stabilityDelta: 3, mentalDelta: 2, fatigueDelta: -4 } },
    ] },
  { title: "早朝の神社参拝", text: "練習コースの途中にある小さな神社。ふと思い立って、朝のうちに手を合わせていくことにした。",
    choices: [
      { label: "勝負運を願う", result: "静かな境内で頭が整った。妙に運が向いてきた気がする。", effects: { luckDelta: 4 } },
      { label: "無事故を願う", result: "安全への意識が高まり、心も静かに落ち着いた。", effects: { luckDelta: 2, mentalDelta: 3 } },
    ] },

  // --- ③賭け（outcomes） ---
  { title: "新型フレームのテスト依頼", text: "機材メーカーから「開発中のフレームを実走テストしてほしい」という依頼が届いた。",
    choices: [
      { label: "引き受けてみる",
        outcomes: [
          { weight: 0.35, result: "新型は驚くほど進み、機材の知見と自信を同時に手に入れた。", effects: { abKeyDelta: { flat: 5 }, popularityDelta: 4 } },
          { weight: 0.4, result: "セッティングが合わず、いつもの感覚を取り戻すのに苦労した。", effects: { formDelta: -5, fatigueDelta: 6 } },
          { weight: 0.25, result: "可もなく不可もなし。レポートを書いて謝礼を受け取った。", effects: { moneyDelta: 15 } },
        ] },
      { label: "今の機材に集中する", result: "慣れた機材で練習の質を守った。", effects: { formDelta: 2 } },
    ] },
  { title: "トレイルランへのお誘い", text: "山仲間から「気分転換にトレイルランでもどうだ」と誘われた。未知の刺激か、余計な疲労か。",
    choices: [
      { label: "思い切って参加する",
        outcomes: [
          { weight: 0.35, result: "自転車と違う筋肉と心肺への刺激が新鮮で、登りの体の使い方まで変わった。", effects: { abKeyDelta: { climb: 5 }, fatigueDelta: 8 } },
          { weight: 0.35, result: "慣れない下りで脚が笑い、数日引きずる筋肉痛だけが残った。", effects: { fatigueDelta: 14, formDelta: -3 } },
          { weight: 0.3, result: "景色を楽しむ良いリフレッシュになった。", effects: { mentalDelta: 3, fatigueDelta: -6 } },
        ] },
      { label: "丁重に断る", result: "誘いは嬉しかったが、今は専門に集中することにした。", effects: {} },
    ] },
  { title: "名物大盛りチャレンジ", text: "チームで寄った食堂に「完食無料」の大盛りチャレンジがあった。周囲の視線が集まる。",
    choices: [
      { label: "受けて立つ",
        outcomes: [
          { weight: 0.3, result: "見事完食。店の壁に写真が飾られ、思わぬ人気者になった。", effects: { popularityDelta: 5, fatigueDelta: 4 } },
          { weight: 0.45, result: "後半で完全に失速。しばらく満腹で動けなかった。", effects: { fatigueDelta: 10, formDelta: -3 } },
          { weight: 0.25, result: "惜しくも一歩及ばず。だが店主と仲良くなり、裏メニューを教わった。", effects: { mentalDelta: 2, fatigueDelta: 5 } },
        ] },
      { label: "栄養バランスを優先する", result: "誘惑を断ち、アスリートらしい食事を選んだ。", effects: { stabilityDelta: 2 } },
    ] },
  { title: "眠れない夜の自主練", text: "妙に目が冴えて眠れない夜。いっそ走りに出てしまおうかという考えが頭をよぎる。",
    choices: [
      { label: "夜の街へ走りに出る",
        outcomes: [
          { weight: 0.3, result: "誰もいない夜道で無心に回すうち、頭の中が澄み渡った。", effects: { mentalDelta: 4, abKeyDelta: { solo: 3 } } },
          { weight: 0.45, result: "帰る頃には空が白み、翌日の練習はさんざんだった。", effects: { fatigueDelta: 12, formDelta: -4 } },
          { weight: 0.25, result: "少し走ったら眠気が来た。ほどよい運動で朝までぐっすり。", effects: { fatigueDelta: -8 } },
        ] },
      { label: "布団の中で目を閉じ続ける", result: "眠れないなりに体は休まった。", effects: { fatigueDelta: -4 } },
    ] },
  { title: "古い自転車店の掘り出し物", text: "路地裏の古い自転車店で、値札のない年代物のパーツ箱を見せてもらった。「好きに漁っていい」らしい。",
    choices: [
      { label: "箱の底まで漁る",
        outcomes: [
          { weight: 0.3, result: "職人が惚れ込むような銘品を発掘。整備の腕前まで上がった気がする。", effects: { moneyDelta: 20, mentalDelta: 2 } },
          { weight: 0.4, result: "錆びた部品で手を汚しただけだった。店主の昔話は長かった。", effects: { fatigueDelta: 5 } },
          { weight: 0.3, result: "掘り出し物は無かったが、店主に地元の隠れた練習コースを教わった。", effects: { abKeyDelta: { climb: 3 }, mentalDelta: 2 } },
        ] },
      { label: "眺めるだけにしておく", result: "目の保養だけして店を後にした。", effects: {} },
    ] },
  { title: "嵐の前の走り込み", text: "夕方から荒れる予報。今のうちに走るか、判断が分かれるところだ。",
    choices: [
      { label: "予報とにらめっこで出発する",
        outcomes: [
          { weight: 0.35, result: "ぎりぎりまで走って雨雲から逃げ切った。判断力に自信がついた。", effects: { luckDelta: 3, abKeyDelta: { stamina: 3 } } },
          { weight: 0.4, result: "読みが外れて土砂降りに捕まり、ずぶ濡れで帰宅した。", effects: { fatigueDelta: 10, formDelta: -4 } },
          { weight: 0.25, result: "予報より早く天気が崩れ、短時間で切り上げた。無難な一日。", effects: { fatigueDelta: 3 } },
        ] },
      { label: "今日は屋内トレーニングに切り替える", result: "無理をせずローラーで汗を流した。", effects: { fatigueDelta: 4, stabilityDelta: 2 } },
    ] },

  // --- ④覚醒級（weightを低くし滅多に引かない） ---
  { title: "無心のペダリング", text: "気づけば何も考えずに回していた。呼吸も鼓動も景色も、すべてが一つに溶けるような時間だった。",
    weight: 0.15,
    choices: [
      { label: "この境地を追い求める", result: "「あの感覚」を再現しようとする過程そのものが、自分を作り替えていった。", effects: { growthPowBump: true, fatigueDelta: 8 } },
      { label: "たまたまの奇跡として胸にしまう", result: "執着せず胸にしまったが、あの日を境に走りの質が確かに変わった。", effects: { growthPowBump: true, mentalDelta: 3 } },
    ] },
  { title: "師と呼べる人との出会い", text: "引退した往年の名選手と話し込む機会を得た。数十年分の学びが、惜しげもなく注がれる。",
    weight: 0.15,
    choices: [
      { label: "弟子入りを申し出る", result: "定期的に教えを受けられることになった。見える世界が変わり始めている。", effects: { talentCapDelta: 4, breakthroughDelta: 3, fatigueDelta: 6 } },
      { label: "その日の教えを深く刻む", result: "一度きりの対話だったが、その言葉は長く自分を導く羅針盤になった。", effects: { talentCapDelta: 3, mentalDelta: 4 } },
    ] },
  { title: "すべてが噛み合う一ヶ月", text: "練習も食事も睡眠も、この一ヶ月はすべてが面白いように噛み合っている。",
    weight: 0.2,
    choices: [
      { label: "この波に乗って一気に伸ばす", result: "絶好調の波を逃さず攻め続け、全体の地力が一段引き上がった。", effects: { abBoost: 8, fatigueDelta: 12 } },
      { label: "波の要因を分析して仕組みにする", result: "好調の理由を言語化し、いつでも再現できる仕組みに変えた。", effects: { abBoost: 5, stabilityDelta: 4 } },
    ] },

  // --- ⑤悪イベント（bad:true） ---
  { title: "集団落車に巻き込まれる", bad: true, text: "練習会の集団走行で前方の落車に巻き込まれ、派手に転んでしまった。",
    choices: [
      { label: "体のケアを最優先する", result: "幸い骨に異常はなかったが、打ち身の痛みはしばらく残った。", effects: { fatigueDelta: 14, formDelta: -5 } },
      { label: "機材のチェックを優先する", result: "体は動くが、あちこちの擦り傷と機材の傷が痛々しい。", effects: { fatigueDelta: 10, formDelta: -4, mentalDelta: -2 } },
    ] },
  { title: "雨続きの一週間", bad: true, text: "来る日も来る日も冷たい雨。予定していた練習が思うようにこなせない。",
    choices: [
      { label: "雨でも構わず走る", result: "濡れて冷えた体に疲労が溜まり、風邪の一歩手前までいった。", effects: { fatigueDelta: 12, formDelta: -3 } },
      { label: "室内メニューに切り替える", result: "できることはやったが、実走の感覚は少し鈍ってしまった。", effects: { formDelta: -4 } },
    ] },
  { title: "機材トラブルの連鎖", bad: true, text: "パンク、変速不調、ライトの故障。なぜか機材トラブルが立て続けに起きる。",
    choices: [
      { label: "全部まとめて総点検する", result: "丸一日かけて全て直したが、貴重な練習時間を失った。", effects: { fatigueDelta: 8, formDelta: -3 } },
      { label: "応急処置でしのぐ", result: "だましだまし乗り続けたが、機材への不安が頭から離れない。", effects: { mentalDelta: -3, formDelta: -3 } },
    ] },
  { title: "遠征先での食あたり", bad: true, text: "遠征先で食べた物が悪かったのか、腹の調子が最悪だ。",
    choices: [
      { label: "無理せず一日休む", result: "丸一日寝込んだ。回復はしたが、体が軽くなるまで時間がかかった。", effects: { fatigueDelta: 10, formDelta: -5 } },
      { label: "薬で抑えて予定をこなす", result: "なんとか予定はこなしたが、内容は散々だった。", effects: { fatigueDelta: 14, formDelta: -4 } },
    ] },
  { title: "動画の見過ぎで夜更かし", bad: true, text: "気づけば深夜。ついレース動画を延々と見続けてしまった。",
    choices: [
      { label: "せめて学びに変える", result: "得たものはあったが、寝不足の朝練はさすがに堪えた。", effects: { fatigueDelta: 8, mentalDelta: 1 } },
      { label: "反省して即寝る", result: "慌てて寝たが、睡眠リズムはしばらく乱れたままだった。", effects: { fatigueDelta: 6, formDelta: -3 } },
    ] },
  { title: "比べられるつらさ", bad: true, text: "同期の活躍がメディアで大きく取り上げられ、周囲がなにかと自分と比べてくる。",
    choices: [
      { label: "闘志に変えようとする", result: "奮い立とうとするほど空回りし、心がすり減っていった。", effects: { mentalDelta: -4, stabilityDelta: -3 } },
      { label: "耳をふさいで自分に集中する", result: "気にしないふりはできたが、心のざわつきは消えなかった。", effects: { mentalDelta: -3 } },
    ] },
  { title: "定番コースが通行止め", bad: true, text: "いつもの練習コースが工事で長期通行止めに。代わりのコース探しを迫られる。",
    choices: [
      { label: "手探りで新コースを開拓する", result: "迷いながらの手探りで、練習の質がしばらく落ちてしまった。", effects: { formDelta: -4, fatigueDelta: 6 } },
      { label: "ローラー中心に切り替える", result: "単調なメニューが続き、気持ちの張りが失われていった。", effects: { mentalDelta: -3, formDelta: -3 } },
    ] },
  { title: "空回りの焦り", bad: true, text: "結果を急ぐあまり、練習がすべて裏目に出ているような感覚が続いている。",
    choices: [
      { label: "量を増やして取り返そうとする", result: "焦って積んだ距離は身にならず、疲労だけが積み上がった。", effects: { breakthroughDelta: -6, fatigueDelta: 12 } },
      { label: "一度立ち止まって見直す", result: "原因を探るうちに時間が過ぎ、伸び盛りの勢いを少し失った。", effects: { breakthroughDelta: -4, mentalDelta: -2 } },
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
    { title: "細部へのこだわり", text: "職人肌のあなたは、ペダリングと機材の詰めが気になって仕方がない。",
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
  // v43(マイライフ難易度調整Phase 2): 「普通」だけ性格別プールが無く、性格を持つ選手の
  // 半数（normal）が私生活イベントで個性を発揮できなかった抜けを埋めた。
  normal: [
    { title: "自分らしいペースを見つめ直す", text: "特別な癖や信条はない。それでも、自分なりのやり方は確かにあるはずだと感じている。",
      choices: [
        { label: "淡々といつも通りに過ごす", result: "気負わず積み重ねた日々が、確かな土台になっている。", effects: { abBoost: 3, mentalDelta: 2 } },
        { label: "少しだけ新しいことに挑戦する", result: "小さな変化を取り入れたことで、新鮮な刺激を得られた。", effects: { formDelta: 4, fatigueDelta: 3 } },
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

