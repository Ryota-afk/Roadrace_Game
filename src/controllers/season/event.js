// 選択肢イベントへの応答（純粋なreducer関数）。Step7第3弾。
import { applyEventEffects } from "../../logic/support.js";

export function resolveEvent(s, choiceIdx) {
  const ev = s.pendingEvent;
  if (!ev) return s;
  const choice = ev.choices[choiceIdx];
  const applied = applyEventEffects(s, choice.effects);
  // v12: 個人targetの効果は誰が対象だったかを__eventNoteに乗せて返してくるので、
  // 結果テキストの末尾に添えてから消す（保存対象にも含まれない一時フィールド）
  const { __eventNote, ...rest } = applied;
  const text = __eventNote ? `${choice.result}\n\n${__eventNote}` : choice.result;
  return { ...rest, pendingEvent: null, eventResult: { title: ev.title, text }, screen: "event_result" };
}
