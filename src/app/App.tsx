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
import { readAllSaves, readSlot } from "../ui/save/gameSaveStorage";
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
import {
  type GameplaySettings,
  readStoredGameplaySettings,
  writeStoredGameplaySettings,
} from "../ui/controls/gameplaySettings";
import type { GameSaveData } from "../engine/GameSaveData";

type OptionsScreenId =
  | "options"
  | "options-graphics"
  | "options-audio"
  | "options-gameplay";
type AppScreen = "title" | "game" | OptionsScreenId;

function App() {
  const [screen, setScreen] = useState<AppScreen>("title");
  const [isGameActive, setIsGameActive] = useState(false);
  const [saves, setSaves] = useState<(GameSaveData | null)[]>(() =>
    readAllSaves(),
  );
  const [loadedSaveData, setLoadedSaveData] = useState<GameSaveData | null>(
    null,
  );
  const [titleNotice, setTitleNotice] = useState<string | null>(null);
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
  const [gameplaySettings, setGameplaySettings] = useState<GameplaySettings>(() =>
    readStoredGameplaySettings(),
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

  useEffect(() => {
    writeStoredGameplaySettings(gameplaySettings);
  }, [gameplaySettings]);

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

  const showGame = isGameActive && screen === "game";
  const showOptions = isOptionsScreenId(screen);
  const showTitle = screen === "title" && !isGameActive;

  const handleStartNewGame = () => {
    setLoadedSaveData(null);
    setTitleNotice(null);
    setIsGameActive(true);
    setScreen("game");
  };

  const handleLoadSlot = (slotIndex: number) => {
    const save = readSlot(slotIndex);
    if (!save) return;
    setTitleNotice(null);
    setLoadedSaveData(save);
    setIsGameActive(true);
    setScreen("game");
  };

  const handleBackToTitle = () => {
    setLoadedSaveData(null);
    setIsGameActive(false);
    setScreen("title");
    setSaves(readAllSaves());
  };

  const handleGameLoadError = (message: string) => {
    setLoadedSaveData(null);
    setIsGameActive(false);
    setScreen("title");
    setSaves(readAllSaves());
    setTitleNotice(message);
  };

  return (
    <>
      {isGameActive && (
        <div style={{ display: showGame ? "block" : "none" }}>
          <GameScreen
            audioSettings={audioSettings}
            gameplaySettings={gameplaySettings}
            initialSaveData={loadedSaveData ?? undefined}
            keyboardLayout={keyboardLayout}
            textSpeed={textSpeed}
            onBackToTitle={handleBackToTitle}
            onLoadError={handleGameLoadError}
            onOpenOptions={() => setScreen("options")}
          />
        </div>
      )}

      {showTitle && (
        <TitleScreen
          {...menuFeedback}
          onOpenOptions={() => setScreen("options")}
          onStartNewGame={handleStartNewGame}
          onLoadSlot={handleLoadSlot}
          notice={titleNotice}
          saves={saves}
        />
      )}

      {showOptions && (
        <OptionsScreen
          activeTheme={activeTheme}
          audioSettings={audioSettings}
          gameplaySettings={gameplaySettings}
          keyboardLayout={keyboardLayout}
          textSpeed={textSpeed}
          {...menuFeedback}
          onBack={() => {
            if (isGameActive) {
              setScreen("game");
            } else {
              setScreen("title");
            }
          }}
          onChangeTheme={setActiveTheme}
          onChangeKeyboardLayout={setKeyboardLayout}
          onChangeTextSpeed={setTextSpeed}
          onChangeGameplaySettings={setGameplaySettings}
          onOpenAudio={() => setScreen("options-audio")}
          onOpenGraphics={() => setScreen("options-graphics")}
          onOpenGameplay={() => setScreen("options-gameplay")}
          onToggleSound={(soundEnabled) =>
            setAudioSettings({ soundEnabled })
          }
          onBackToOptions={() => setScreen("options")}
          screen={screen}
        />
      )}
    </>
  );
}

export default App;

function isOptionsScreenId(screen: AppScreen): screen is OptionsScreenId {
  return (
    screen === "options" ||
    screen === "options-graphics" ||
    screen === "options-audio" ||
    screen === "options-gameplay"
  );
}
