import type { ComponentType } from "react";

/** [絵文字, CLDR short name, 肌の色バリエーション (ファイル記載順)] */
export type RawEmoji = readonly [emoji: string, name: string, variants?: readonly string[]];

/** emoji-test.txt から生成されるバージョンごとのマスターデータ */
export type EmojiData = {
  version: string;
  groups: readonly (readonly [group: string, emojis: readonly RawEmoji[]])[];
};

/** 0 = 指定なし (黄色), 1〜5 = Fitzpatrick type 1-2 〜 type 6 */
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export type EmojiItemType =
  | { kind: "unicode"; emoji: string }
  | { kind: "url"; url: string; customReactionId?: string };

export type EmojiItem = {
  id: string;
  type: EmojiItemType;
  keywords: string[];
  /** 肌の色のバリエーション (混合トーンを含む) */
  variants?: readonly string[];
};

export type EmojiIcon = string | ComponentType<{ size: number; color: string }>;

export type EmojiCategory = {
  id: string;
  title: string;
  /** 組み込みアイコン名 (lucide) またはアイコンコンポーネント */
  icon: EmojiIcon;
  emojis: EmojiItem[];
  /** 絵文字が 1 つもないときに表示する文言 */
  emptyMessage?: string;
};

export type EmojiCategoryType =
  | "smileys_and_people"
  | "animals_and_nature"
  | "food_and_drink"
  | "activity"
  | "travel_and_places"
  | "objects"
  | "symbols"
  | "flags";

export type EmojiSearchResult = {
  items: EmojiItem[];
  /** 結果の上に表示する補足。結果が 0 件のときは結果の代わりに表示する */
  message?: string;
};

/** 意味の近い絵文字を探すなど、ピッカーの外で行う検索。カテゴリタブの先頭にタブとして追加される */
export type EmojiSearchProvider = {
  /** 組み込みアイコン名 (lucide) またはアイコンコンポーネント */
  icon: EmojiIcon;
  /** このタブを選んでいるときの検索欄のプレースホルダー */
  placeholder?: string;
  /** 何も入力していないときに表示する説明 */
  idleMessage?: string;
  /** 結果が 0 件で message もないときに表示する文言 */
  emptyMessage?: string;
  /** search が reject したときに表示する文言 */
  errorMessage?: string;
  /** 通常の検索で見つからなかったときに表示する、このタブへ切り替えるボタンの文言。省略するとボタンを表示しない */
  tryLabel?: string;
  /** 入力をまだ確定していないとき、結果の代わりに出す、その文字で探すボタンの文言 */
  submitLabel?: (query: string) => string;
  /**
   * 入力を確定したとき (キーボードの検索キー、submitLabel のボタン、検索欄にフォーカスが残ったままキーボードを閉じたとき) に呼ぶ。
   * 打っている途中では呼ばない。
   * 別の文字で探したとき、ほかのタブに移ったとき、ピッカーを閉じたときは signal を中断し、その後に届いた結果は捨てる。
   * reject したとき (同期的に throw したときも) は errorMessage を表示する
   */
  search: (query: string, options: { signal: AbortSignal }) => Promise<EmojiSearchResult>;
  /**
   * 前に探した結果を覚えていれば返す。返したときは search を呼ばず、待たずに表示する。
   * 描画のたびに呼ぶので、軽くし、同じ query には同じオブジェクトを返すこと。throw したときは覚えていないものとして扱う
   */
  peek?: (query: string) => EmojiSearchResult | undefined;
};
