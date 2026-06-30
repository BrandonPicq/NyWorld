import type { AudioSettings } from "../audio/audioSettings";
import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";
import { type ThemeId, themePresets } from "../theme/theme";

type OptionsScreenProps = {
  activeTheme: ThemeId;
  audioSettings: AudioSettings;
  onBackToOptions: () => void;
  onBackToTitle: () => void;
  onChangeTheme: (themeId: ThemeId) => void;
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenAudio: () => void;
  onOpenGraphics: () => void;
  onToggleSound: (soundEnabled: boolean) => void;
  screen: "options" | "options-graphics" | "options-audio";
};

export function OptionsScreen({
  activeTheme,
  audioSettings,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onMenuConfirm,
  onMenuMove,
  onOpenAudio,
  onOpenGraphics,
  onToggleSound,
  screen,
}: OptionsScreenProps) {
  const optionsView = getOptionsView({
    activeTheme,
    audioSettings,
    onBackToOptions,
    onBackToTitle,
    onChangeTheme,
    onOpenAudio,
    onOpenGraphics,
    onToggleSound,
    screen,
  });

  return (
    <main className="app-shell options-screen" aria-labelledby="options-heading">
      <TerminalPanel className="options-panel">
        <p className="terminal-kicker">{optionsView.kicker}</p>
        <h1 className="terminal-heading" id="options-heading">
          {optionsView.heading}
        </h1>
        <p className="options-copy">{optionsView.copy}</p>

        <TerminalMenu
          ariaLabel={optionsView.ariaLabel}
          className="options-actions"
          items={optionsView.items}
          key={screen}
          onActivateItem={onMenuConfirm}
          onBack={optionsView.onBack}
          onBackAction={onMenuConfirm}
          onMoveSelection={onMenuMove}
        />
      </TerminalPanel>
    </main>
  );
}

type OptionsViewInput = Omit<OptionsScreenProps, "onMenuConfirm" | "onMenuMove">;

function getOptionsView({
  activeTheme,
  audioSettings,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onOpenAudio,
  onOpenGraphics,
  onToggleSound,
  screen,
}: OptionsViewInput) {
  if (screen === "options-graphics") {
    const currentThemePreset =
      themePresets.find((theme) => theme.id === activeTheme) || themePresets[0];
    const currentThemeLabel = currentThemePreset.label;

    const cycleTheme = (direction: 1 | -1) => {
      const currentIndex = themePresets.findIndex(
        (theme) => theme.id === activeTheme,
      );
      const nextIndex =
        (currentIndex + direction + themePresets.length) % themePresets.length;
      onChangeTheme(themePresets[nextIndex].id);
    };

    return {
      ariaLabel: "Graphics options menu",
      copy: "Configure visual presentation.",
      heading: "Graphics",
      kicker: "OPTIONS // GRAPHICS",
      items: [
        {
          label: `Theme: < ${currentThemeLabel} >`,
          onSelect: () => cycleTheme(1),
          onLeft: () => cycleTheme(-1),
          onRight: () => cycleTheme(1),
        },
        { label: "Back", onSelect: onBackToOptions },
      ],
      onBack: onBackToOptions,
    };
  }

  if (screen === "options-audio") {
    const toggleSound = () => onToggleSound(!audioSettings.soundEnabled);

    return {
      ariaLabel: "Audio options menu",
      copy: "Configure menu sound feedback.",
      heading: "Audio",
      kicker: "OPTIONS // AUDIO",
      items: [
        {
          label: `Sound: < ${audioSettings.soundEnabled ? "ON" : "OFF"} >`,
          onSelect: toggleSound,
          onLeft: toggleSound,
          onRight: toggleSound,
        },
        { label: "Back", onSelect: onBackToOptions },
      ],
      onBack: onBackToOptions,
    };
  }

  return {
    ariaLabel: "Options menu",
    copy: "Configure graphics and audio settings.",
    heading: "Options",
    kicker: "SYSTEM OPTIONS",
    items: [
      { label: "Graphics", onSelect: onOpenGraphics },
      { label: "Audio", onSelect: onOpenAudio },
      { label: "Back", onSelect: onBackToTitle },
    ],
    onBack: onBackToTitle,
  };
}
