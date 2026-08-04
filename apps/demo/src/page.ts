export type Locale = "en" | "zh";
export type Theme = "light" | "dark";

type Messages = Record<string, string>;

export interface PageConfig {
  messages: Record<Locale, Messages>;
  documentTitle: Record<Locale, string>;
  onLocale?: (locale: Locale) => void;
  onTheme?: (theme: Theme) => void;
}

export interface Page {
  readonly locale: Locale;
  readonly theme: Theme;
  t(key: string, values?: Record<string, string>): string;
}

const LOCALE_KEY = "web-git-graph-locale";
const THEME_KEY = "web-git-graph-theme";

export function initPage(config: PageConfig): Page {
  const themeButton = document.querySelector<HTMLButtonElement>("#theme-switch")!;
  const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let locale = resolveLocale();
  let theme = resolveTheme();
  let ready = false;

  function t(key: string, values?: Record<string, string>): string {
    let value = config.messages[locale][key] ?? config.messages.en[key] ?? key;
    for (const [name, replacement] of Object.entries(values ?? {})) {
      value = value.replace(`{${name}}`, replacement);
    }
    return value;
  }

  function applyLocale(next: Locale, persist = true): void {
    locale = next;
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    if (persist) localStorage.setItem(LOCALE_KEY, locale);
    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      if (element.id === "status") return;
      element.textContent = t(element.dataset.i18n!);
    });
    document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
      element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder!));
    });
    document.querySelectorAll<HTMLElement>("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria!));
    });
    document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === locale));
    });
    document.title = config.documentTitle[locale];
    updateThemeLabel();
    if (ready) config.onLocale?.(locale);
  }

  function applyTheme(next: Theme, persist = true): void {
    theme = next;
    document.documentElement.dataset.theme = theme;
    themeMeta.content = theme === "dark" ? "#0e120f" : "#f3f1eb";
    if (persist) localStorage.setItem(THEME_KEY, theme);
    updateThemeLabel();
    if (ready) config.onTheme?.(theme);
  }

  function updateThemeLabel(): void {
    themeButton.setAttribute(
      "aria-label",
      t(theme === "light" ? "theme.toDark" : "theme.toLight")
    );
  }

  document.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      await navigator.clipboard.writeText(button.dataset.copy ?? "");
      button.textContent = t("common.copied");
      window.setTimeout(() => {
        button.textContent = t("common.copy");
      }, 1300);
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      applyLocale(button.dataset.language === "zh" ? "zh" : "en");
    });
  });

  themeButton.addEventListener("click", () => {
    applyTheme(theme === "light" ? "dark" : "light");
  });

  applyTheme(theme, false);
  applyLocale(locale, false);
  ready = true;
  setupReveal(reducedMotion);

  return {
    get locale() {
      return locale;
    },
    get theme() {
      return theme;
    },
    t
  };
}

function resolveLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY);
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function resolveTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setupReveal(reducedMotion: MediaQueryList): void {
  if (reducedMotion.matches) {
    document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
    return;
  }
  document.documentElement.classList.add("motion");
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8%", threshold: 0.08 }
  );
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}
