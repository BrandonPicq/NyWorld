import type { AudioSettings } from "../audio/audioSettings";
import { TerminalMenu } from "../components/TerminalMenu";
import { TerminalPanel } from "../components/TerminalPanel";
import { type ThemeId, themePresets } from "../theme/theme";
import type { KeyboardLayout } from "../controls/keyboardLayout";
import type { TextSpeed } from "../controls/textSpeed";
import type {
  GameplaySettings,
  InteractionTargetingMode,
} from "../controls/gameplaySettings";

type OptionsScreenProps = {
  activeTheme: ThemeId;
  audioSettings: AudioSettings;
  gameplaySettings: GameplaySettings;
  keyboardLayout: KeyboardLayout;
  textSpeed: TextSpeed;
  onBackToOptions: () => void;
  onBackToTitle: () => void;
  onChangeTheme: (themeId: ThemeId) => void;
  onChangeKeyboardLayout: (layout: KeyboardLayout) => void;
  onChangeTextSpeed: (speed: TextSpeed) => void;
  onChangeGameplaySettings: (settings: GameplaySettings) => void;
  onMenuConfirm?: () => void;
  onMenuMove?: () => void;
  onOpenAudio: () => void;
  onOpenGraphics: () => void;
  onOpenGameplay: () => void;
  onToggleSound: (soundEnabled: boolean) => void;
  screen: "options" | "options-graphics" | "options-audio" | "options-gameplay";
};

export function OptionsScreen({
  activeTheme,
  audioSettings,
  gameplaySettings,
  keyboardLayout,
  textSpeed,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onChangeKeyboardLayout,
  onChangeTextSpeed,
  onChangeGameplaySettings,
  onMenuConfirm,
  onMenuMove,
  onOpenAudio,
  onOpenGraphics,
  onOpenGameplay,
  onToggleSound,
  screen,
}: OptionsScreenProps) {
  const optionsView = getOptionsView({
    activeTheme,
    audioSettings,
    gameplaySettings,
    keyboardLayout,
    textSpeed,
    onBackToOptions,
    onBackToTitle,
    onChangeTheme,
    onChangeKeyboardLayout,
    onChangeTextSpeed,
    onChangeGameplaySettings,
    onOpenAudio,
    onOpenGraphics,
    onOpenGameplay,
    onToggleSound,
    screen,
  });

  return (
    <main className="app-shell options-screen" aria-labelledby="options-heading">
      <TerminalPanel className="options-panel">
        <p className="terminal-kicker">{optionsView.kicker}</p>
        <h1 className="terminal-heading-md" id="options-heading">
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
  gameplaySettings,
  keyboardLayout,
  textSpeed,
  onBackToOptions,
  onBackToTitle,
  onChangeTheme,
  onChangeKeyboardLayout,
  onChangeTextSpeed,
  onChangeGameplaySettings,
  onOpenAudio,
  onOpenGraphics,
  onOpenGameplay,
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

    const textSpeedPresets: TextSpeed[] = ["slow", "normal", "fast", "instant"];
    const cycleTextSpeed = (direction: 1 | -1) => {
      const currentIndex = textSpeedPresets.indexOf(textSpeed);
      const nextIndex =
        (currentIndex + direction + textSpeedPresets.length) %
        textSpeedPresets.length;
      onChangeTextSpeed(textSpeedPresets[nextIndex]);
    };

    return {
      ariaLabel: "Graphics options menu",
      copy: "Configure visual presentation and text flow.",
      heading: "Graphics & Text",
      kicker: "OPTIONS // GRAPHICS & TEXT",
      items: [
        {
          label: `Theme: < ${currentThemeLabel} >`,
          onSelect: () => cycleTheme(1),
          onLeft: () => cycleTheme(-1),
          onRight: () => cycleTheme(1),
        },
        {
          label: `Text Speed: < ${textSpeed.toUpperCase()} >`,
          onSelect: () => cycleTextSpeed(1),
          onLeft: () => cycleTextSpeed(-1),
          onRight: () => cycleTextSpeed(1),
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

  if (screen === "options-gameplay") {
    const interactionTargetingModes: Array<{
      id: InteractionTargetingMode;
      label: string;
    }> = [
      { id: "nearby", label: "AROUND" },
      { id: "facing", label: "FACING" },
    ];
    const toggleSmartInteract = () => {
      onChangeGameplaySettings({
        ...gameplaySettings,
        smartInteract: !gameplaySettings.smartInteract,
      });
    };
    const cycleInteractionTargetingMode = (direction: 1 | -1) => {
      const currentIndex = interactionTargetingModes.findIndex(
        (mode) => mode.id === gameplaySettings.interactionTargetingMode,
      );
      const nextIndex =
        (currentIndex + direction + interactionTargetingModes.length) %
        interactionTargetingModes.length;
      onChangeGameplaySettings({
        ...gameplaySettings,
        interactionTargetingMode: interactionTargetingModes[nextIndex].id,
      });
    };
    const currentInteractionMode =
      interactionTargetingModes.find(
        (mode) => mode.id === gameplaySettings.interactionTargetingMode,
      ) || interactionTargetingModes[0];

    return {
      ariaLabel: "Gameplay options menu",
      copy: "Configure gameplay assistants and mechanics.",
      heading: "Gameplay",
      kicker: "OPTIONS // GAMEPLAY",
      items: [
        {
          label: `Smart Interact: < ${
            gameplaySettings.smartInteract ? "ON" : "OFF"
          } >`,
          onSelect: toggleSmartInteract,
          onLeft: toggleSmartInteract,
          onRight: toggleSmartInteract,
        },
        {
          label: `Interact Scope: < ${currentInteractionMode.label} >`,
          onSelect: () => cycleInteractionTargetingMode(1),
          onLeft: () => cycleInteractionTargetingMode(-1),
          onRight: () => cycleInteractionTargetingMode(1),
        },
        { label: "Back", onSelect: onBackToOptions },
      ],
      onBack: onBackToOptions,
    };
  }

  return {
    ariaLabel: "Options menu",
    copy: "Configure controls, graphics, audio and gameplay settings.",
    heading: "Options",
    kicker: "SYSTEM OPTIONS",
    items: [
      { label: "Graphics & Text", onSelect: onOpenGraphics },
      { label: "Audio", onSelect: onOpenAudio },
      { label: "Gameplay", onSelect: onOpenGameplay },
      {
        label: `Controls: < ${keyboardLayout.toUpperCase()} >`,
        onSelect: () =>
          onChangeKeyboardLayout(keyboardLayout === "qwerty" ? "azerty" : "qwerty"),
        onLeft: () =>
          onChangeKeyboardLayout(keyboardLayout === "qwerty" ? "azerty" : "qwerty"),
        onRight: () =>
          onChangeKeyboardLayout(keyboardLayout === "qwerty" ? "azerty" : "qwerty"),
      },
      { label: "Back", onSelect: onBackToTitle },
    ],
    onBack: onBackToTitle,
  };
}
