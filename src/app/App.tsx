import { useEffect, useState } from "react";
import {
  type AudioSettings,
  readStoredAudioSettings,
  writeStoredAudioSettings,
} from "../ui/audio/audioSettings";
import {
  playMenuConfirmSound,
  playMenuMoveSound,
} from "../ui/audio/menuAudio";
import { GamePlaceholderScreen } from "../ui/screens/GamePlaceholderScreen";
import { OptionsScreen } from "../ui/screens/OptionsScreen";
import { TitleScreen } from "../ui/screens/TitleScreen";
import {
  type ThemeId,
  readStoredThemeId,
  writeStoredThemeId,
} from "../ui/theme/theme";

type OptionsScreenId =
  | "options"
  | "options-graphics"
  | "options-themes"
  | "options-audio";
type AppScreen = "title" | "game" | OptionsScreenId;

function App() {
  const [screen, setScreen] = useState<AppScreen>("title");
  const [activeTheme, setActiveTheme] = useState<ThemeId>(() =>
    readStoredThemeId(),
  );
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() =>
    readStoredAudioSettings(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    writeStoredThemeId(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    writeStoredAudioSettings(audioSettings);
  }, [audioSettings]);

  const menuFeedback = {
    onMenuConfirm: () => {
      if (audioSettings.soundEnabled) {
        playMenuConfirmSound();
      }
    },
    onMenuMove: () => {
      if (audioSettings.soundEnabled) {
        playMenuMoveSound();
      }
    },
  };

  if (screen === "game") {
    return (
      <GamePlaceholderScreen
        onBackToTitle={() => setScreen("title")}
        {...menuFeedback}
      />
    );
  }

  if (isOptionsScreenId(screen)) {
    return (
      <OptionsScreen
        activeTheme={activeTheme}
        audioSettings={audioSettings}
        {...menuFeedback}
        onBackToTitle={() => setScreen("title")}
        onChangeTheme={setActiveTheme}
        onOpenAudio={() => setScreen("options-audio")}
        onOpenGraphics={() => setScreen("options-graphics")}
        onOpenThemes={() => setScreen("options-themes")}
        onToggleSound={(soundEnabled) =>
          setAudioSettings({ soundEnabled })
        }
        onBackToOptions={() => setScreen("options")}
        onBackToGraphics={() => setScreen("options-graphics")}
        screen={screen}
      />
    );
  }

  return (
    <TitleScreen
      {...menuFeedback}
      onOpenOptions={() => setScreen("options")}
      onStartNewGame={() => setScreen("game")}
    />
  );
}

export default App;

function isOptionsScreenId(screen: AppScreen): screen is OptionsScreenId {
  return (
    screen === "options" ||
    screen === "options-graphics" ||
    screen === "options-themes" ||
    screen === "options-audio"
  );
}
