import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const API = import.meta.env.BASE_URL + "api";

export interface AppSettings {
  easyTime: number;
  mediumTime: number;
  hardTime: number;
  defaultCount: number;
  headerTitle: string;
  slogan: string;
  footerLink: string;
  maintenanceEnabled: boolean;
  refreshSettings: () => Promise<void>;
}

const DEFAULTS: AppSettings = {
  easyTime: 30,
  mediumTime: 15,
  hardTime: 10,
  defaultCount: 40,
  headerTitle: "Quizzy",
  slogan: "Ace your exams with confidence",
  footerLink: "",
  maintenanceEnabled: false,
  refreshSettings: async () => {},
};

const SettingsContext = createContext<AppSettings>(DEFAULTS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const fetchSettings = useCallback(async () => {
    try {
      const r = await fetch(`${API}/settings`, { credentials: "include" });
      if (!r.ok) return;
      const d = await r.json();
      setSettings((prev) => ({
        ...prev,
        easyTime: d.easyTime > 0 ? d.easyTime : DEFAULTS.easyTime,
        mediumTime: d.mediumTime > 0 ? d.mediumTime : DEFAULTS.mediumTime,
        hardTime: d.hardTime > 0 ? d.hardTime : DEFAULTS.hardTime,
        defaultCount: d.defaultCount > 0 ? d.defaultCount : DEFAULTS.defaultCount,
        headerTitle: d.headerTitle || DEFAULTS.headerTitle,
        slogan: d.slogan || DEFAULTS.slogan,
        footerLink: d.footerLink ?? "",
        maintenanceEnabled: Boolean(d.maintenanceEnabled),
      }));
    } catch {}
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const value: AppSettings = {
    ...settings,
    refreshSettings: fetchSettings,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  return useContext(SettingsContext);
}
