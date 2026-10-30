import { useEffect } from "react";
import { AppState } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicSans_400Regular, PublicSans_500Medium, PublicSans_600SemiBold, useFonts } from "@expo-google-fonts/public-sans";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { loadHintCount } from "../src/hints";
import { fonts } from "../src/theme/tokens";
import { usePalette } from "../src/theme/useTheme";

void SplashScreen.preventAutoHideAsync();
// Read while the fonts load, so the first card already knows whether to hint.
void loadHintCount();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 2 } },
});

// TanStack Query's "window focus" is the app coming to the foreground.
AppState.addEventListener("change", (state) => focusManager.setFocused(state === "active"));

export default function RootLayout() {
  const palette = usePalette();
  const [loaded, error] = useFonts({
    // Newsreader at opsz 26, weight 600: the optical size the artboard's 26px headline renders at.
    [fonts.headline]: require("../assets/fonts/Newsreader-Headline-600.ttf"),
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
  });

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palette.canvas);
  }, [palette.canvas]);

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.canvas }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.canvas } }}>
            <Stack.Screen name="event/[id]" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          </Stack>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
