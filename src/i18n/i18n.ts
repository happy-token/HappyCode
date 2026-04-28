import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/settings.json'
import zh from './locales/zh/settings.json'
import es from './locales/es/settings.json'
import ja from './locales/ja/settings.json'
import ko from './locales/ko/settings.json'
import fr from './locales/fr/settings.json'
import pt from './locales/pt/settings.json'
import de from './locales/de/settings.json'
import ar from './locales/ar/settings.json'

const resources = {
  en: { settings: en },
  zh: { settings: zh },
  es: { settings: es },
  ja: { settings: ja },
  ko: { settings: ko },
  fr: { settings: fr },
  pt: { settings: pt },
  de: { settings: de },
  ar: { settings: ar },
}

const savedLocale = localStorage.getItem('happycode:locale') ?? 'en'

void i18n.use(initReactI18next).init({
  resources,
  lng: savedLocale,
  fallbackLng: 'en',
  ns: ['settings'],
  defaultNS: 'settings',
  interpolation: { escapeValue: false },
})

export default i18n
