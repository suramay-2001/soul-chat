import type { Language } from "@maa/shared";

export interface UIStrings {
  placeholder: string;
  askButton: string;
  newConversation: string;
  welcome: string;
  welcomeDesc: string;
  suggestions: string[];
  teachings: string;
  sadhak: string;
  sources: string;
  atmosphere: string;
  disclaimer: string;
  rateLimitMsg: string;
  searching: string;
  reflecting: string;
}

const strings: Record<Language, UIStrings> = {
  en: {
    placeholder: "Ask about Maa's teachings…",
    askButton: "Ask",
    newConversation: "New conversation",
    welcome: "Welcome, Sadhak",
    welcomeDesc:
      "Ask a question about Maa Anandmayee's teachings. Answers are grounded in her published books and source materials.",
    suggestions: [
      "What does Maa say about surrender?",
      "How to find inner peace?",
      "Maa's teachings on love",
    ],
    teachings: "Teachings",
    sadhak: "Sadhak",
    sources: "Sources",
    atmosphere: "Atmosphere",
    disclaimer:
      "This experience is grounded in Maa Anandmayee's books and related source material " +
      "and does not claim to be Maa herself or her living essence. " +
      "It is a knowledge-grounded companion for spiritual reflection.",
    rateLimitMsg: "Too many requests. Please wait a moment and try again.",
    searching: "Searching teachings…",
    reflecting: "Reflecting on the teachings…",
  },
  bn: {
    placeholder: "মায়ের শিক্ষা সম্পর্কে জিজ্ঞাসা করুন…",
    askButton: "জিজ্ঞাসা",
    newConversation: "নতুন কথোপকথন",
    welcome: "স্বাগতম, সাধক",
    welcomeDesc:
      "মা আনন্দময়ীর শিক্ষা সম্পর্কে প্রশ্ন করুন। উত্তরগুলি তাঁর প্রকাশিত বই ও উৎস সামগ্রী থেকে নেওয়া।",
    suggestions: [
      "সমর্পণ সম্পর্কে মা কী বলেন?",
      "অন্তরের শান্তি কীভাবে পাওয়া যায়?",
      "প্রেম সম্পর্কে মায়ের শিক্ষা",
    ],
    teachings: "শিক্ষা",
    sadhak: "সাধক",
    sources: "উৎস",
    atmosphere: "পরিবেশ",
    disclaimer:
      "এই অভিজ্ঞতা মা আনন্দময়ীর বই ও সম্পর্কিত উৎস সামগ্রীর উপর ভিত্তি করে " +
      "এবং মা নিজে বা তাঁর জীবন্ত সত্তা হওয়ার দাবি করে না। " +
      "এটি আধ্যাত্মিক চিন্তার জন্য একটি জ্ঞান-ভিত্তিক সঙ্গী।",
    rateLimitMsg: "অনেক অনুরোধ। অনুগ্রহ করে একটু অপেক্ষা করে আবার চেষ্টা করুন।",
    searching: "শিক্ষা অনুসন্ধান করা হচ্ছে…",
    reflecting: "শিক্ষা নিয়ে চিন্তা করা হচ্ছে…",
  },
  hi: {
    placeholder: "माँ की शिक्षाओं के बारे में पूछें…",
    askButton: "पूछें",
    newConversation: "नई बातचीत",
    welcome: "स्वागतम, साधक",
    welcomeDesc:
      "माँ आनंदमयी की शिक्षाओं के बारे में प्रश्न पूछें। उत्तर उनकी प्रकाशित पुस्तकों और स्रोत सामग्री पर आधारित हैं।",
    suggestions: [
      "समर्पण के बारे में माँ क्या कहती हैं?",
      "आंतरिक शांति कैसे पाएँ?",
      "प्रेम पर माँ की शिक्षा",
    ],
    teachings: "शिक्षा",
    sadhak: "साधक",
    sources: "स्रोत",
    atmosphere: "वातावरण",
    disclaimer:
      "यह अनुभव माँ आनंदमयी की पुस्तकों और संबंधित स्रोत सामग्री पर आधारित है " +
      "और माँ स्वयं या उनकी जीवित सत्ता होने का दावा नहीं करता। " +
      "यह आध्यात्मिक चिंतन के लिए एक ज्ञान-आधारित साथी है।",
    rateLimitMsg: "बहुत अधिक अनुरोध। कृपया एक क्षण प्रतीक्षा करें और पुनः प्रयास करें।",
    searching: "शिक्षाओं की खोज हो रही है…",
    reflecting: "शिक्षाओं पर चिंतन हो रहा है…",
  },
};

export function t(lang: Language): UIStrings {
  return strings[lang] ?? strings.en;
}

export const LANGUAGE_OPTIONS: { code: Language; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "EN" },
  { code: "bn", label: "Bengali", nativeLabel: "বাং" },
  { code: "hi", label: "Hindi", nativeLabel: "हि" },
];
