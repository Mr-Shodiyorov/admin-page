import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import uz from "./uz.json";
import ru from "./ru.json";

let setLang = localStorage.getItem("lang") || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uz: { translation: uz },
    ru: { translation: ru },
  },
  lng: setLang,
  fallbackLng: ["uz", "ru"],
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lang) => {
  localStorage.setItem("lang", lang);
});

export default i18n;
