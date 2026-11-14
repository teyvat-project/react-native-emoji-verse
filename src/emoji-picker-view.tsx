import {
  Clock,
  Flag,
  Heart,
  Lightbulb,
  PawPrint,
  Plane,
  Search,
  Smile,
  Sparkles,
  Star,
  StarPlus,
  Trophy,
  Utensils,
  X,
} from "lucide-react-native";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  type FlatListProps,
  Image,
  type ImageStyle,
  Keyboard,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import { applySkinTone, SKIN_TONE_MODIFIERS, SKIN_TONES, toVariantItem } from "./skin-tone";
import type {
  EmojiCategory,
  EmojiIcon,
  EmojiItem,
  EmojiSearchProvider,
  EmojiSearchResult,
  SkinTone,
} from "./types";

// 列数はグリッドの幅から決める。iPad かどうかで決めると、iPhone Duo を開いた状態のような広い画面ですき間が空く
const MIN_GRID_COLUMNS = 8;
const TARGET_CELL_SIZE = 56;
const GRID_PADDING = 8;
const NO_EMOJIS: EmojiItem[] = [];
const EMOJI_SIZE = 36;
const SKIN_TONE_ICON_SIZE = 20;

// 肌の色の選択肢として表示する ✋ (U+270B)
const skinToneSample = (tone: SkinTone) => (tone === 0 ? "\u270B" : `\u270B${SKIN_TONE_MODIFIERS[tone - 1]}`);

const ICON_MAP: Record<string, React.ComponentType<{ size: number; color: string }>> = {
  clock: Clock,
  smile: Smile,
  "paw-print": PawPrint,
  utensils: Utensils,
  trophy: Trophy,
  plane: Plane,
  lightbulb: Lightbulb,
  heart: Heart,
  flag: Flag,
  star: Star,
  "star-plus": StarPlus,
  sparkles: Sparkles,
};

export type EmojiImageProps = {
  source: { uri: string };
  style: StyleProp<ImageStyle>;
};

export type EmojiPickerViewProps = {
  categories: EmojiCategory[];
  onEmojiSelected: (emoji: EmojiItem) => void;
  /** ローディング中は ActivityIndicator を表示する */
  isLoading?: boolean;
  /** スティッキーヘッダーの先頭に追加するコンテンツ（タイトル等） */
  listHeaderPrepend?: React.ReactNode;
  /**
   * 使用する FlatList コンポーネント。
   * デフォルトは RN の FlatList。BottomSheet 内では BottomSheetFlatList を渡すこと。
   *
   * アーキテクチャ上の注意:
   * - BottomSheetView でラップすると position:absolute で height が未定義になりスクロール不可
   * - 代わりに通常の View (flex:1) をルートにし、BottomSheetFlatList を直接子にする構成を取る
   * - こうすることで BottomSheetContent が計算した height が正しく伝播しスクロールが機能する
   */
  // biome-ignore lint/suspicious/noExplicitAny: FlatList と BottomSheetFlatList は互換プロップを持つが型定義が異なる
  FlatListComponent?: React.ComponentType<FlatListProps<EmojiItem> & any>;
  /**
   * カテゴリタブの横スクロールに使う ScrollView コンポーネント。
   * デフォルトは RN の ScrollView。BottomSheet 内では react-native-gesture-handler の ScrollView を渡すこと。
   * RN の ScrollView では、横のスワイプをシートのジェスチャーに取られてスクロールしない
   */
  CategoryScrollViewComponent?: React.ComponentType<ScrollViewProps>;
  /**
   * Unicode 絵文字を画像で表示する場合の URL。undefined を返すとテキスト (システムフォント) で表示する。
   * Twemoji 形式のファイル名には `emojiToTwemojiKey` が使える。
   */
  getEmojiImageUrl?: (emoji: string) => string | undefined;
  /** 画像の描画に使うコンポーネント。既定は React Native の Image (contain) */
  ImageComponent?: React.ComponentType<EmojiImageProps>;
  /** 検索欄のプレースホルダー */
  searchPlaceholder?: string;
  /** 肌の色 (controlled)。省略時はコンポーネント内部で保持する */
  skinTone?: SkinTone;
  /** 肌の色の初期値 (uncontrolled) */
  defaultSkinTone?: SkinTone;
  onSkinToneChange?: (tone: SkinTone) => void;
  /** 検索欄に肌の色の切り替えボタンを表示する。既定では肌の色のバリエーションを持つ絵文字がある場合のみ表示する */
  showSkinToneSelector?: boolean;
  /** 意味の近い絵文字を探すなど、ピッカーの外で行う検索。カテゴリタブの先頭にタブとして追加する */
  searchProvider?: EmojiSearchProvider;
  /** 開いたときに検索プロバイダのタブを選び、検索欄にこの文字を入れておく (uncontrolled) */
  defaultProviderQuery?: string;
  /** 検索プロバイダのタブで確定した文字 (前後の空白を除く) が変わったとき。ほかのタブに移ったときは空文字。開いたときは呼ばない */
  onProviderQueryChange?: (query: string) => void;
};

function DefaultImage({ source, style }: EmojiImageProps) {
  return <Image source={source} style={style} resizeMode="contain" />;
}

type GlyphRenderer = (emoji: string, size: number) => React.ReactNode;

const EmojiItemCell = memo(
  ({
    item,
    skinTone,
    onPress,
    onLongPress,
    renderGlyph,
    ImageComponent,
    columns,
  }: {
    item: EmojiItem;
    skinTone: SkinTone;
    onPress: (item: EmojiItem) => void;
    onLongPress: (item: EmojiItem) => void;
    renderGlyph: GlyphRenderer;
    ImageComponent: React.ComponentType<EmojiImageProps>;
    columns: number;
  }) => {
    // 長押しでは肌の色を適用する前の絵文字からバリエーションを選ばせる
    const toned = useMemo(() => applySkinTone(item, skinTone), [item, skinTone]);
    const handlePress = useCallback(() => onPress(toned), [toned, onPress]);
    const handleLongPress = useCallback(() => onLongPress(item), [item, onLongPress]);

    return (
      <Pressable
        onPress={handlePress}
        onLongPress={item.variants ? handleLongPress : undefined}
        style={[styles.emojiCell, { width: `${100 / columns}%` }]}
      >
        {toned.type.kind === "unicode" ? (
          renderGlyph(toned.type.emoji, EMOJI_SIZE)
        ) : (
          <ImageComponent source={{ uri: toned.type.url }} style={styles.emojiImage} />
        )}
      </Pressable>
    );
  },
);
EmojiItemCell.displayName = "EmojiItemCell";

type ProviderSearchState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "failed" }
  | { type: "ok"; result: EmojiSearchResult };

// 確定した文字で検索し、文字が変わったら前の検索を中断する。
// attempt が変わったときは、同じ文字でも探し直す (失敗した後に同じ文字で確定し直したときなど)
function useProviderSearch(
  provider: EmojiSearchProvider | undefined,
  text: string,
  enabled: boolean,
  attempt: number,
): ProviderSearchState {
  const query = text.trim();
  const active = enabled && provider !== undefined && query !== "";
  // provider も照らし合わせ、作り直されたときに前の provider の結果を出さない
  const [settled, setSettled] = useState<{
    provider: EmojiSearchProvider;
    query: string;
    attempt: number;
    state: ProviderSearchState;
  } | null>(null);

  useEffect(() => {
    if (!active || !provider) return;
    // 覚えている結果があれば探さず、その結果を残しておく。あとで peek が undefined を返すようになっても (覚えておく期限が切れたときなど)、
    // 検索する文字が変わるまでは、関係のない再描画をきっかけに探し直さない
    const hit = peekSafely(provider, query);
    if (hit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSettled({ provider, query, attempt, state: { type: "ok", result: hit } });
      return;
    }
    const controller = new AbortController();
    // search が Promise を返す前に同期的に throw しても、失敗として扱う
    Promise.resolve()
      // 呼ぶ前に中断されていたら (StrictMode で effect がすぐに作り直されたときなど) 呼ばない
      .then(() => (controller.signal.aborted ? undefined : provider.search(query, { signal: controller.signal })))
      .then((result) => {
        if (controller.signal.aborted) return;
        // 結果の形が崩れているとき (結果を返さずに resolve したときなど) も、読み込み中のままにしたり描画で落ちたりせず、失敗として扱う
        if (!isSearchResult(result)) throw new Error("search resolved without a valid result");
        setSettled({ provider, query, attempt, state: { type: "ok", result } });
      })
      .catch(() => {
        if (!controller.signal.aborted) setSettled({ provider, query, attempt, state: { type: "failed" } });
      });
    return () => controller.abort();
  }, [active, attempt, provider, query]);

  if (!active) return { type: "idle" };
  if (settled?.provider === provider && settled.query === query && settled.attempt === attempt) return settled.state;
  // effect で結果を残す前の描画では、覚えている結果があれば待たずに出す
  const cached = peekSafely(provider, query);
  return cached ? { type: "ok", result: cached } : { type: "loading" };
}

function isSearchResult(result: unknown): result is EmojiSearchResult {
  return typeof result === "object" && result !== null && Array.isArray((result as EmojiSearchResult).items);
}

// peek は利用側の関数なので、throw したり形の崩れた結果を返したりしても描画を止めず、覚えていないものとして扱う
function peekSafely(provider: EmojiSearchProvider | undefined, query: string) {
  try {
    const result = provider?.peek?.(query);
    return isSearchResult(result) ? result : undefined;
  } catch {
    return undefined;
  }
}

// 開いたときは、絵文字のある最初のカテゴリを選ぶ (先頭の「最近使用」などが空のことがある)
function defaultCategory(categories: EmojiCategory[]): EmojiCategory | undefined {
  return categories.find((c) => c.emojis.length > 0) ?? categories[0];
}

function resolveIcon(icon: EmojiIcon) {
  return typeof icon === "string" ? ICON_MAP[icon] : icon;
}

function CategoryButton({
  icon,
  isSelected,
  disabled,
  onPress,
}: {
  icon: EmojiIcon;
  isSelected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useColorScheme() ?? "light";
  const IconComponent = resolveIcon(icon);
  const activeColor = theme === "dark" ? "#0A84FF" : "#007AFF";
  const inactiveColor = "#8E8E93";

  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.categoryButton, disabled && { opacity: 0.5 }]}>
      {IconComponent && <IconComponent size={22} color={isSelected ? activeColor : inactiveColor} />}
      <View style={[styles.categoryIndicator, isSelected && { backgroundColor: activeColor }]} />
    </Pressable>
  );
}

export function EmojiPickerView({
  categories,
  onEmojiSelected,
  isLoading = false,
  listHeaderPrepend,
  FlatListComponent = FlatList,
  CategoryScrollViewComponent = ScrollView,
  getEmojiImageUrl,
  ImageComponent = DefaultImage,
  searchPlaceholder = "Search emoji",
  skinTone: controlledSkinTone,
  defaultSkinTone = 0,
  onSkinToneChange,
  showSkinToneSelector: showSkinToneSelectorProp,
  searchProvider,
  defaultProviderQuery,
  onProviderQueryChange,
}: EmojiPickerViewProps) {
  const theme = useColorScheme() ?? "light";
  const [selectedCategoryId, setSelectedCategoryId] = useState(() => defaultCategory(categories)?.id ?? "");
  const restoresProviderQuery = searchProvider !== undefined && !!defaultProviderQuery;
  const [isProviderSelected, setIsProviderSelected] = useState(restoresProviderQuery);
  const [searchText, setSearchText] = useState(restoresProviderQuery ? defaultProviderQuery : "");
  // 検索プロバイダで探す文字。確定するまで searchText とは別に持つ
  const [submittedText, setSubmittedText] = useState(restoresProviderQuery ? defaultProviderQuery : "");
  const [submitCount, setSubmitCount] = useState(0);
  const [innerSkinTone, setInnerSkinTone] = useState<SkinTone>(defaultSkinTone);
  const [isSkinTonePickerOpen, setIsSkinTonePickerOpen] = useState(false);
  const [variantTarget, setVariantTarget] = useState<EmojiItem | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const searchInputRef = useRef<TextInput>(null);
  const gridColumns = Math.max(MIN_GRID_COLUMNS, Math.floor((gridWidth - GRID_PADDING * 2) / TARGET_CELL_SIZE));
  // セルは正方形 (aspectRatio: 1) なので、行の高さはセルの幅と同じ
  const rowHeight = gridWidth > 0 ? (gridWidth - GRID_PADDING * 2) / gridColumns : EMOJI_SIZE + 8;
  const skinTone = controlledSkinTone ?? innerSkinTone;
  const hasVariants = useMemo(() => categories.some((c) => c.emojis.some((e) => e.variants)), [categories]);
  const showSkinToneSelector = showSkinToneSelectorProp ?? hasVariants;

  useEffect(() => {
    if (categories.length === 0) return;
    const isValid = categories.some((c) => c.id === selectedCategoryId);
    if (!isValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedCategoryId(defaultCategory(categories)?.id ?? "");
    }
  }, [categories, selectedCategoryId]);
  const isProviderActive = isProviderSelected && searchProvider !== undefined;
  // 検索プロバイダのタブでは、検索欄の文字はプロバイダの検索に使う
  const isSearching = !isProviderActive && searchText.trim().length > 0;
  const providerState = useProviderSearch(
    searchProvider,
    submittedText,
    // カテゴリを読み込んでいる間は探さない。カテゴリが届くと provider が作り直され、探し直しになるため
    isProviderActive && !isLoading,
    submitCount,
  );
  const providerQuery = isProviderActive ? submittedText.trim() : "";
  // 利用側がメモ化していない関数を渡しても、描画のたびに呼ばないよう、最新の関数を ref で持ち、値が変わったときだけ呼ぶ
  const onProviderQueryChangeRef = useRef(onProviderQueryChange);
  useEffect(() => {
    onProviderQueryChangeRef.current = onProviderQueryChange;
  });
  const reportedProviderQuery = useRef(providerQuery);
  useEffect(() => {
    if (reportedProviderQuery.current === providerQuery) return;
    reportedProviderQuery.current = providerQuery;
    onProviderQueryChangeRef.current?.(providerQuery);
  }, [providerQuery]);

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text);
    // 消したときは、確定を待たずに何も探していない状態に戻す
    if (text.trim() === "") setSubmittedText("");
  }, []);
  const isProviderLoading = providerState.type === "loading";
  const isSubmitted = searchText.trim() === submittedText.trim();
  // 検索キーやボタンで確定したときは、同じ文字でも探し直す (失敗や制限の後に探し直せるように)。探している最中は除く
  const submitSearchText = useCallback(() => {
    if (isProviderLoading && isSubmitted) return;
    setSubmittedText(searchText);
    setSubmitCount((count) => count + 1);
  }, [isProviderLoading, isSubmitted, searchText]);
  // キーボードが閉じたときは、まだ確定していない文字があるときだけ確定する。
  // 検索キーやボタンと同じく attempt を進め、同じ言葉を打ち直したときに前の結果や失敗を出さないようにする
  const submitPendingText = useCallback(() => {
    // Keyboard.dismiss() (@gorhom/bottom-sheet はシートを下に引いたときに呼ぶ) や、ほかの場所のタップでフォーカスが外れたときは確定しない。
    // 確定するのは、Android の戻るボタンのように、フォーカスが残ったままキーボードだけ閉じたとき
    if (!searchInputRef.current?.isFocused()) return;
    if (isSubmitted) return;
    setSubmittedText(searchText);
    setSubmitCount((count) => count + 1);
  }, [isSubmitted, searchText]);
  const selectProvider = useCallback(() => {
    // 選んでいるタブをもう一度押したときは、検索キーと同じく確定する (探している最中は何もしない)。
    // 失敗や制限の後に探し直せるようにする。覚えている結果がある言葉なら、peek が返すので search は呼ばない
    if (isProviderActive) {
      submitSearchText();
      return;
    }
    setIsProviderSelected(true);
    // タブを移ったときは、入力済みの文字をそのまま確定する。前に移ったときの結果を出さないよう、探し直す
    setSubmittedText(searchText);
    setSubmitCount((count) => count + 1);
  }, [isProviderActive, searchText, submitSearchText]);
  const selectCategory = (id: string) => {
    if (isProviderActive) {
      // 意味で探していた文字が残ると、カテゴリではなくその文字での通常の検索になってしまうので消す
      setSearchText("");
      setSubmittedText("");
    }
    setIsProviderSelected(false);
    setSelectedCategoryId(id);
  };

  // Android の戻るボタンなどでは、フォーカスが残ったままキーボードだけ閉じるので、キーボードが閉じたことで確定する
  useEffect(() => {
    if (!isProviderActive) return;
    const subscription = Keyboard.addListener("keyboardDidHide", submitPendingText);
    return () => subscription.remove();
  }, [isProviderActive, submitPendingText]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const query = searchText.toLowerCase().trim();
    const results: EmojiItem[] = [];
    // 同じ絵文字を複数のカテゴリ (「最近使用」など) に入れていても、結果には 1 つだけ出す
    const seen = new Set<string>();
    for (const category of categories) {
      for (const emoji of category.emojis) {
        if (seen.has(emoji.id)) continue;
        if (emoji.id.toLowerCase().includes(query) || emoji.keywords.some((k) => k.toLowerCase().includes(query))) {
          seen.add(emoji.id);
          results.push(emoji);
        }
      }
    }
    return results;
  }, [searchText, categories, isSearching]);

  const renderGlyph = useCallback<GlyphRenderer>(
    (emoji, size) => {
      const uri = getEmojiImageUrl?.(emoji);
      return uri ? (
        <ImageComponent source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize: size - 4, lineHeight: size + 4 }}>{emoji}</Text>
      );
    },
    [getEmojiImageUrl, ImageComponent],
  );

  const handleSkinToneChange = useCallback(
    (tone: SkinTone) => {
      setInnerSkinTone(tone);
      setIsSkinTonePickerOpen(false);
      onSkinToneChange?.(tone);
    },
    [onSkinToneChange],
  );

  const handleEmojiPress = useCallback(
    (emoji: EmojiItem) => {
      setVariantTarget(null);
      onEmojiSelected(emoji);
    },
    [onEmojiSelected],
  );

  const renderItem = useCallback(
    ({ item }: { item: EmojiItem }) => (
      <EmojiItemCell
        item={item}
        skinTone={skinTone}
        onPress={handleEmojiPress}
        onLongPress={setVariantTarget}
        renderGlyph={renderGlyph}
        ImageComponent={ImageComponent}
        columns={gridColumns}
      />
    ),
    [skinTone, handleEmojiPress, renderGlyph, ImageComponent, gridColumns],
  );

  const keyExtractor = useCallback((item: EmojiItem, index: number) => `${item.id}-${index}`, []);

  // 選んでいたカテゴリがないときは、effect で選び直す前の描画でも、開いたときと同じカテゴリを出す
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) ?? defaultCategory(categories);
  const providerResult = providerState.type === "ok" ? providerState.result : undefined;
  const displayEmojis = isProviderActive
    ? (providerResult?.items ?? [])
    : isSearching
      ? searchResults
      : (selectedCategory?.emojis ?? []);
  // 検索プロバイダのタブで、絵文字の代わりに表示する文言
  const providerMessage = !isProviderActive
    ? undefined
    : providerState.type === "idle"
      ? searchProvider?.idleMessage
      : providerState.type === "failed"
        ? searchProvider?.errorMessage
        : providerResult && providerResult.items.length === 0
          ? (providerResult.message ?? searchProvider?.emptyMessage)
          : undefined;
  const tryLabel = isSearching && searchResults.length === 0 ? searchProvider?.tryLabel : undefined;
  // 入力した文字をまだ確定していないときに出す、その文字で探すボタンの文言
  const pendingText = searchText.trim();
  const submitLabel =
    isProviderActive && pendingText !== "" && !isSubmitted ? searchProvider?.submitLabel?.(pendingText) : undefined;

  const bgColor = theme === "dark" ? "#1C1C1E" : "#FFFFFF";
  const panelColor = theme === "dark" ? "#2C2C2E" : "#F2F2F7";
  const dividerColor = theme === "dark" ? "#38383A" : "#E5E5EA";
  const ProviderIcon = searchProvider ? resolveIcon(searchProvider.icon) : undefined;
  const renderSuggestion = (label: string, onPress: () => void) => (
    <View style={styles.suggestion}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={[styles.suggestionButton, { borderColor: dividerColor }]}
      >
        {ProviderIcon && <ProviderIcon size={14} color={theme === "dark" ? "#FFFFFF" : "#000000"} />}
        <Text style={{ fontSize: 14, color: theme === "dark" ? "#FFFFFF" : "#000000" }}>{label}</Text>
      </Pressable>
    </View>
  );

  // 絵文字の代わりに出すもの。undefined のときは絵文字を並べる
  const placeholder: React.ReactNode =
    isLoading || (submitLabel === undefined && isProviderActive && isProviderLoading) ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
      </View>
    ) : submitLabel !== undefined ? (
      renderSuggestion(submitLabel, submitSearchText)
    ) : isProviderActive && displayEmojis.length === 0 ? (
      providerMessage ? (
        <Text accessibilityRole={providerState.type === "failed" ? "alert" : undefined} style={styles.message}>
          {providerMessage}
        </Text>
      ) : null
    ) : !isProviderActive && !isSearching && displayEmojis.length === 0 && selectedCategory?.emptyMessage ? (
      <Text style={styles.message}>{selectedCategory.emptyMessage}</Text>
    ) : tryLabel !== undefined ? (
      renderSuggestion(tryLabel, selectProvider)
    ) : undefined;
  // 結果の上に出す補足。FlatList の外に出す (ListHeaderComponent にすると getItemLayout の位置がずれる)
  const note = placeholder === undefined && isProviderActive ? providerResult?.message : undefined;

  return (
    // 通常の View (flex:1) をルートにすることで、BottomSheetContent が計算した
    // height を正しく受け取れる。BottomSheetView は position:absolute のため不可。
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      {/* ===== スティッキーヘッダー ===== */}
      <View style={{ backgroundColor: bgColor }}>
        {/* タイトル等、呼び出し元から渡されるコンテンツ */}
        {listHeaderPrepend}

        {/* 検索バー */}
        <View style={[styles.searchBar, { backgroundColor: panelColor }]}>
          <Search size={16} color="#8E8E93" />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme === "dark" ? "#FFFFFF" : "#000000" }]}
            placeholder={isProviderActive ? (searchProvider?.placeholder ?? searchPlaceholder) : searchPlaceholder}
            placeholderTextColor="#8E8E93"
            value={searchText}
            onChangeText={handleSearchTextChange}
            onSubmitEditing={isProviderActive ? submitSearchText : undefined}
            returnKeyType={isProviderActive ? "search" : undefined}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => handleSearchTextChange("")}>
              <X size={16} color="#8E8E93" />
            </Pressable>
          )}
          {showSkinToneSelector && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Skin tone"
              onPress={() => setIsSkinTonePickerOpen((open) => !open)}
              hitSlop={8}
            >
              {renderGlyph(skinToneSample(skinTone), SKIN_TONE_ICON_SIZE)}
            </Pressable>
          )}
        </View>

        {/* 肌の色の選択 */}
        {showSkinToneSelector && isSkinTonePickerOpen && (
          <View style={[styles.skinTonePicker, { backgroundColor: panelColor }]}>
            {SKIN_TONES.map((tone) => (
              <Pressable
                key={tone}
                accessibilityRole="button"
                accessibilityState={{ selected: tone === skinTone }}
                onPress={() => handleSkinToneChange(tone)}
                style={[styles.skinToneOption, tone === skinTone && { backgroundColor: dividerColor }]}
              >
                {renderGlyph(skinToneSample(tone), SKIN_TONE_ICON_SIZE)}
              </Pressable>
            ))}
          </View>
        )}

        {/* カテゴリタブ */}
        <CategoryScrollViewComponent
          horizontal
          // キーボードが出ているときも、1 回目のタップでタブを移れるようにする。
          // 移れないと、キーボードが閉じたことで検索プロバイダの検索が確定してしまう
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.categoryBar}
          contentContainerStyle={styles.categoryBarContent}
        >
          {searchProvider && (
            <CategoryButton
              icon={searchProvider.icon}
              isSelected={isProviderActive}
              disabled={false}
              onPress={selectProvider}
            />
          )}
          {categories.map((category) => (
            <CategoryButton
              key={category.id}
              icon={category.icon}
              isSelected={!isProviderActive && selectedCategory?.id === category.id}
              disabled={isSearching}
              onPress={() => selectCategory(category.id)}
            />
          ))}
        </CategoryScrollViewComponent>

        <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      </View>

      {/* ===== スクロール領域 ===== */}
      {/* 絵文字の代わりに文言などを出すときも FlatList は外さず、ListEmptyComponent で出す。
          外すと @gorhom/bottom-sheet が覚えているスクロール位置が 0 に戻らず、シートを下に引いても閉じなくなる */}
      {note ? <Text style={styles.note}>{note}</Text> : null}
      <FlatListComponent
        // FlatList は numColumns を実行中に変えられないので、列数が変わったら作り直す
        key={gridColumns}
        style={styles.list}
        onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
        data={placeholder === undefined ? displayEmojis : NO_EMOJIS}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={gridColumns}
        contentContainerStyle={[styles.gridContent, placeholder !== undefined && styles.placeholderContent]}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={placeholder ?? null}
        // キーボードが出ているときも、1 回目のタップで絵文字やボタンを押せるようにする
        keyboardShouldPersistTaps="handled"
        // numColumns > 1 のとき、index は絵文字ではなく行の番号になる
        getItemLayout={(_: unknown, index: number) => ({
          length: rowHeight,
          offset: GRID_PADDING + rowHeight * index,
          index,
        })}
        initialNumToRender={40}
        maxToRenderPerBatch={40}
        windowSize={5}
        removeClippedSubviews
      />

      {/* 長押しした絵文字の肌の色バリエーション */}
      {variantTarget && (
        <Pressable style={styles.variantBackdrop} onPress={() => setVariantTarget(null)}>
          <View style={[styles.variantPanel, { backgroundColor: panelColor }]}>
            {[variantTarget.id, ...(variantTarget.variants ?? [])].map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleEmojiPress(toVariantItem(variantTarget, emoji))}
                style={styles.variantCell}
              >
                {renderGlyph(emoji, EMOJI_SIZE)}
              </Pressable>
            ))}
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  skinTonePicker: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 4,
    borderRadius: 10,
  },
  skinToneOption: {
    padding: 6,
    borderRadius: 8,
  },
  categoryBar: {
    maxHeight: 48,
    flexShrink: 0,
    flexGrow: 0,
  },
  categoryBarContent: {
    paddingHorizontal: 12,
    gap: 12,
    alignItems: "center",
  },
  categoryButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 40,
    gap: 4,
  },
  categoryIndicator: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: "transparent",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  list: {
    flex: 1,
  },
  gridContent: {
    padding: GRID_PADDING,
  },
  message: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    textAlign: "center",
    fontSize: 14,
    color: "#8E8E93",
  },
  note: {
    paddingHorizontal: 12,
    paddingTop: 8,
    fontSize: 12,
    color: "#8E8E93",
  },
  suggestion: {
    alignItems: "center",
    paddingVertical: 32,
  },
  suggestionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  placeholderContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  gridRow: {
    justifyContent: "flex-start",
  },
  emojiCell: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiImage: {
    width: EMOJI_SIZE,
    height: EMOJI_SIZE,
  },
  variantBackdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    justifyContent: "center",
    padding: 12,
  },
  variantPanel: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    padding: 8,
    borderRadius: 12,
  },
  variantCell: {
    width: EMOJI_SIZE + 12,
    height: EMOJI_SIZE + 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
