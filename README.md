# EmojiVerse

An emoji picker for React Native, extracted from [Catalyst Native](https://github.com/mika-f/Catalyst-Native).

- Emoji data is generated from the Unicode `emoji-test.txt` master data, and you choose which Unicode version to load.
- Skin tones: skin tone variants are grouped under their base emoji. Users pick a global skin tone from the search bar,
  or long-press an emoji to choose any variant, including mixed tones such as 🫱🏻‍🫲🏿.
- Works in a plain view or in a `@gorhom/bottom-sheet` modal.

## Installation

```sh
pnpm add @natsuneko-laboratory/react-native-emoji-verse lucide-react-native react-native-svg
# only if you use EmojiPickerSheet
pnpm add @gorhom/bottom-sheet react-native-reanimated react-native-gesture-handler
```

## Usage

```tsx
import { EmojiPickerView, useEmojiCategories } from "@natsuneko-laboratory/react-native-emoji-verse";
import data from "@natsuneko-laboratory/react-native-emoji-verse/data/16.0";

function Picker() {
  const categories = useEmojiCategories(data);

  return (
    <EmojiPickerView
      categories={categories}
      onEmojiSelected={(item) => {
        if (item.type.kind === "unicode") console.log(item.type.emoji);
      }}
    />
  );
}
```

### Bottom sheet

```tsx
import { EmojiPickerSheet, type EmojiPickerSheetRef } from "@natsuneko-laboratory/react-native-emoji-verse/sheet";

const ref = useRef<EmojiPickerSheetRef>(null);
const categories = useEmojiCategories(data);

<EmojiPickerSheet ref={ref} title="Add reaction" categories={categories} onEmojiSelected={onSelect} />;
// ref.current?.open();
```

The sheet must be rendered inside a `BottomSheetModalProvider`, and it closes when an emoji is selected.

## Choosing a Unicode version

The available versions are exported as `UNICODE_VERSIONS` (currently `15.0`, `15.1`, `16.0` and `18.0`).
Pick the newest version your target OS can render. Otherwise, newer emoji are shown as tofu.

There are two ways to load a version:

```tsx
// Static: only this version is bundled.
import data from "@natsuneko-laboratory/react-native-emoji-verse/data/16.0";
const categories = useEmojiCategories(data);

// Chosen at runtime: every version is bundled (about 100 KB each), because Metro bundles
// everything that `import()` can reach.
import { useEmojiData } from "@natsuneko-laboratory/react-native-emoji-verse/loader";
const { data, isLoading } = useEmojiData(version);
const categories = useEmojiCategories(data);
```

| API | Entry | Description |
| --- | --- | --- |
| `useEmojiCategories(data, options?)` | main | Builds the categories from `EmojiData`. Returns `[]` while `data` is `undefined`. |
| `buildCategories(data, options?)` | main | Same as above, without the hook. |
| `parseEmojiTest(text)` | main | Parses an `emoji-test.txt` yourself, for example a newer file. |
| `data/<version>` | `data/*` | The `EmojiData` for one version. |
| `useEmojiData(version?)` | `loader` | Loads `version` (latest by default). Returns `{ data, isLoading, error }`. |
| `loadEmojiData(version?)` | `loader` | Loads `version` as a promise. Repeated calls share one load. |

`options` accepts `titles` (category names; `CATEGORY_TITLES_EN` by default, `CATEGORY_TITLES_JA` is included)
and `exclude` (category ids to hide).

## Custom categories

Categories are plain data. You can prepend your own, such as custom reactions or recently used emoji:

```tsx
const custom: EmojiCategory = {
  id: "custom",
  title: "Custom",
  icon: "star", // a built-in icon name, or any component that takes { size, color }
  emojis: [{ id: ":party:", type: { kind: "url", url: "https://example.com/party.png" }, keywords: ["party"] }],
};

<EmojiPickerView categories={[custom, ...categories]} onEmojiSelected={onSelect} />;
```

Set `emptyMessage` on a category to show text in place of the grid when the category has no emoji, such as an empty recently used list. When the picker opens, it selects the first category that has emoji.

The built-in icon names are `clock`, `smile`, `paw-print`, `utensils`, `trophy`, `plane`, `lightbulb`, `heart`, `flag`, `star`, `star-plus` and `sparkles`.

## Search provider

To search outside the picker, for example by meaning on your server, pass a `searchProvider`. It adds a tab before the categories. While the tab is selected, the picker calls `search` with the search bar text when the user submits it: when the user presses the search key on the keyboard, or hides the keyboard while the search bar keeps focus, as with the Android back button. The picker does not search while the user types, so it does not send a request for each keystroke or for text that an input method is still converting, such as Japanese kana. Add `submitLabel` to show a button that searches the typed text, in place of the results, until the user submits it.

```tsx
const provider = useMemo<EmojiSearchProvider>(
  () => ({
    icon: "sparkles",
    placeholder: "Describe a feeling or scene",
    idleMessage: "Type a phrase to find emoji with a similar meaning.",
    emptyMessage: "No emoji found.",
    errorMessage: "Search failed. Try again later.",
    tryLabel: "Search by meaning", // shown when the regular search finds nothing
    submitLabel: (query) => `Search for "${query}"`,
    search: async (query, { signal }) => {
      const res = await fetch(`https://example.com/search?q=${encodeURIComponent(query)}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { items: toEmojiItems(await res.json()) };
    },
  }),
  [],
);

<EmojiPickerView categories={categories} onEmojiSelected={onSelect} searchProvider={provider} />;
```

`search` returns `{ items, message? }`. When `items` is empty, the picker shows `message` (or `emptyMessage`) in place of the grid. Otherwise, it shows `message` as a note above the grid. If `search` rejects or throws, the picker shows `errorMessage`. Submitting other text, moving to another tab, or closing the picker aborts the previous `signal`, and the picker ignores results that arrive after that. Memoize the provider, because a new object starts the search again.

To show earlier results without waiting, add `peek`. It returns a stored result for a query, or `undefined`. When it returns a result, the picker shows it at once and does not call `search`. The picker calls `peek` on every render, so keep it fast and return the same object for the same query.

To open the picker on the same search again, keep the text from `onProviderQueryChange` and pass it back as `defaultProviderQuery`. The picker then opens on the provider tab with that text. `onProviderQueryChange` reports the submitted text without surrounding spaces when it changes, and reports an empty string when the user moves to another tab. It is not called when the picker opens.

## EmojiPickerView props

| Prop | Default | Description |
| --- | --- | --- |
| `categories` | required | Categories to show. |
| `onEmojiSelected` | required | Called with the selected `EmojiItem`. Skin tones are already applied. |
| `isLoading` | `false` | Shows a spinner in place of the grid. |
| `listHeaderPrepend` | | Content placed above the search bar, such as a title. |
| `FlatListComponent` | `FlatList` | Pass `BottomSheetFlatList` when you render the view inside a bottom sheet yourself. |
| `CategoryScrollViewComponent` | RN `ScrollView` | Scroll view for the category tabs. Pass `ScrollView` from `react-native-gesture-handler` when you render the view inside a bottom sheet yourself. With the React Native `ScrollView`, the sheet takes horizontal swipes, and the tabs do not scroll. |
| `getEmojiImageUrl` | | Returns an image URL for a Unicode emoji, for example a Twemoji set. `emojiToTwemojiKey` builds Twemoji file names. If it returns `undefined`, the emoji is drawn as text. |
| `ImageComponent` | RN `Image` | Component that draws images, for example a wrapper around `expo-image`. |
| `searchPlaceholder` | `"Search emoji"` | |
| `skinTone` / `defaultSkinTone` / `onSkinToneChange` | `0` | The skin tone, as a controlled or uncontrolled value. `0` means no tone (yellow) and `1`–`5` map to Fitzpatrick types 1-2 to 6. |
| `showSkinToneSelector` | auto | Shows the skin tone button in the search bar. By default, the button appears only when some emoji in `categories` has skin tone variants. |
| `searchProvider` | | Adds a tab that searches with your own function. See [Search provider](#search-provider). |
| `defaultProviderQuery` / `onProviderQueryChange` | | Opens the picker on the provider tab with this text, and reports the text submitted on that tab. See [Search provider](#search-provider). |

The picker does not store the skin tone. To keep it between launches, persist the value from `onSkinToneChange`.

## Updating the Unicode data

1. Add `src/unicode/<version>/emoji-test.txt` from `https://unicode.org/Public/emoji/<version>/`.
2. Run `pnpm generate`. It writes `src/data/<version>.ts` and updates `src/versions.ts`.

## License

MIT. The emoji data is derived from Unicode data files, which are covered by the [Unicode License V3](./LICENSE-UNICODE).
