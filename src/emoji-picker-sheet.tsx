import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetFlatList,
  BottomSheetModal,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { ScrollView } from "react-native-gesture-handler";
import { StyleSheet, Text, View, useColorScheme } from "react-native";
import { EmojiPickerView, type EmojiPickerViewProps } from "./emoji-picker-view";
import type { EmojiItem } from "./types";

export type EmojiPickerSheetRef = {
  open: () => void;
  close: () => void;
};

export type EmojiPickerSheetProps = Omit<
  EmojiPickerViewProps,
  "FlatListComponent" | "CategoryScrollViewComponent" | "listHeaderPrepend"
> & {
  /** シート上部に表示するタイトル */
  title?: string;
  /** 既定は ["75%"] */
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
};

/**
 * @gorhom/bottom-sheet の BottomSheetModal で EmojiPickerView を表示する。
 * 絵文字を選択するとシートを閉じる。BottomSheetModalProvider の内側に配置すること。
 */
export const EmojiPickerSheet = forwardRef<EmojiPickerSheetRef, EmojiPickerSheetProps>(function EmojiPickerSheet(
  { title, snapPoints = ["75%"], onDismiss, onEmojiSelected, ...props },
  ref,
) {
  const theme = useColorScheme() ?? "light";
  const bottomSheetRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.present(),
    close: () => bottomSheetRef.current?.dismiss(),
  }));

  const handleEmojiSelected = useCallback(
    (emoji: EmojiItem) => {
      onEmojiSelected(emoji);
      bottomSheetRef.current?.dismiss();
    },
    [onEmojiSelected],
  );

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...backdropProps} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  // BottomSheetFlatList を直接 BottomSheetModal の子にするためのヘッダー
  // BottomSheetView でラップすると position:absolute で height が未定義になり、
  // FlatList の高さが正しく制約されずスクロールできなくなる
  const listHeaderPrepend = title ? (
    <>
      <Text style={[styles.title, { color: theme === "dark" ? "#FFFFFF" : "#000000" }]}>{title}</Text>
      <View style={[styles.headerDivider, { backgroundColor: theme === "dark" ? "#38383A" : "#E5E5EA" }]} />
    </>
  ) : undefined;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      enableDynamicSizing={false}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: theme === "dark" ? "#1C1C1E" : "#FFFFFF" }}
      handleIndicatorStyle={{ backgroundColor: theme === "dark" ? "#48484A" : "#C7C7CC" }}
    >
      {/* BottomSheetFlatList を BottomSheetModal の直接の子にすることで、
          snapPoints が高さの上限として正しく機能しスクロールが有効になる */}
      <EmojiPickerView
        {...props}
        onEmojiSelected={handleEmojiSelected}
        listHeaderPrepend={listHeaderPrepend}
        FlatListComponent={BottomSheetFlatList}
        CategoryScrollViewComponent={ScrollView}
      />
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingVertical: 8,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
  },
});
