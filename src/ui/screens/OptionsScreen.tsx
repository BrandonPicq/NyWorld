import type { AudioSettings } from "../audio/audioSettings";
import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";
import { type ThemeId, themePresets } from "../theme/theme";

type OptionsScreenProps = {
  activeTheme: ThemeId;
  audioSettings: AudioSettings;
  onBackToGraphics: () => void;
  onBackToOptions: () => void;
  onBackToTitle: () => void;
  onChangeTheme: (themeId: ThemeId) => void;
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenAudio: () => void;
  onOpenGraphics: () => void;
  onOpenThemes: () => void;
  onToggleSound: (soundEnabled: boolean) => void;
  screen: "options" | "options-graphics" | "options-themes" | "options-audio";
};

export function OptionsScreen({
  activeTheme,
  audioSettings,
  onBackToGraphics,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onMenuConfirm,
  onMenuMove,
  onOpenAudio,
  onOpenGraphics,
  onOpenThemes,
  onToggleSound,
  screen,
}: OptionsScreenProps) {
  const optionsView = getOptionsView({
    activeTheme,
    audioSettings,
    onBackToGraphics,
    onBackToOptions,
    onBackToTitle,
    onChangeTheme,
    onOpenAudio,
    onOpenGraphics,
    onOpenThemes,
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

type OptionsViewInput = OptionsScreenProps;

function getOptionsView({
  activeTheme,
  audioSettings,
  onBackToGraphics,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onOpenAudio,
  onOpenGraphics,
  onOpenThemes,
  onToggleSound,
  screen,
}: OptionsViewInput) {
  if (screen === "options-graphics") {
    return {
      ariaLabel: "Graphics options menu",
      copy: "Configure visual presentation.",
      heading: "Graphics",
      kicker: "OPTIONS // GRAPHICS",
      items: [
        { label: "Themes", onSelect: onOpenThemes },
        { label: "Back", onSelect: onBackToOptions },
      ],
      onBack: onBackToOptions,
    };
  }

  if (screen === "options-themes") {
    return {
      ariaLabel: "Theme options menu",
      copy: "Change the terminal display theme.",
      heading: "Themes",
      kicker: "OPTIONS // GRAPHICS // THEMES",
      items: [
        ...themePresets.map((theme) => ({
          label:
            theme.id === activeTheme
              ? `Theme: ${theme.label} [active]`
              : `Theme: ${theme.label}`,
          onSelect: () => onChangeTheme(theme.id),
        })),
        { label: "Back", onSelect: onBackToGraphics },
      ],
      onBack: onBackToGraphics,
    };
  }

  if (screen === "options-audio") {
    return {
      ariaLabel: "Audio options menu",
      copy: "Configure menu sound feedback.",
      heading: "Audio",
      kicker: "OPTIONS // AUDIO",
      items: [
        {
          label: audioSettings.soundEnabled
            ? "Sound: On [active]"
            : "Sound: On",
          onSelect: () => onToggleSound(true),
        },
        {
          label: audioSettings.soundEnabled
            ? "Sound: Off"
            : "Sound: Off [active]",
          onSelect: () => onToggleSound(false),
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
