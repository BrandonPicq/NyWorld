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
import { GameScreen } from "../ui/screens/GameScreen";
import { OptionsScreen } from "../ui/screens/OptionsScreen";
import { TitleScreen } from "../ui/screens/TitleScreen";
import {
  type ThemeId,
  readStoredThemeId,
  writeStoredThemeId,
} from "../ui/theme/theme";
import {
  type KeyboardLayout,
  readStoredKeyboardLayout,
  writeStoredKeyboardLayout,
} from "../ui/controls/keyboardLayout";
import {
  type TextSpeed,
  readStoredTextSpeed,
  writeStoredTextSpeed,
} from "../ui/controls/textSpeed";

type OptionsScreenId =
  | "options"
  | "options-graphics"
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
  const [keyboardLayout, setKeyboardLayout] = useState<KeyboardLayout>(() =>
    readStoredKeyboardLayout(),
  );
  const [textSpeed, setTextSpeed] = useState<TextSpeed>(() =>
    readStoredTextSpeed(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
    writeStoredThemeId(activeTheme);
  }, [activeTheme]);

  useEffect(() => {
    writeStoredAudioSettings(audioSettings);
  }, [audioSettings]);

  useEffect(() => {
    writeStoredKeyboardLayout(keyboardLayout);
  }, [keyboardLayout]);

  useEffect(() => {
    writeStoredTextSpeed(textSpeed);
  }, [textSpeed]);

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
      <GameScreen
        audioSettings={audioSettings}
        keyboardLayout={keyboardLayout}
        textSpeed={textSpeed}
        onBackToTitle={() => setScreen("title")}
      />
    );
  }

  if (isOptionsScreenId(screen)) {
    return (
      <OptionsScreen
        activeTheme={activeTheme}
        audioSettings={audioSettings}
        keyboardLayout={keyboardLayout}
        textSpeed={textSpeed}
        {...menuFeedback}
        onBackToTitle={() => setScreen("title")}
        onChangeTheme={setActiveTheme}
        onChangeKeyboardLayout={setKeyboardLayout}
        onChangeTextSpeed={setTextSpeed}
        onOpenAudio={() => setScreen("options-audio")}
        onOpenGraphics={() => setScreen("options-graphics")}
        onToggleSound={(soundEnabled) =>
          setAudioSettings({ soundEnabled })
        }
        onBackToOptions={() => setScreen("options")}
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
    screen === "options-audio"
  );
}
