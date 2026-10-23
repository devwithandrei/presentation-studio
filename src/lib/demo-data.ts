export type StudioSlide = {
  id: string;
  title: string;
  subtitle: string;
  layout: "cover" | "content" | "split" | "stats" | "quote" | "cta";
  content: {
    eyebrow?: string;
    body?: string;
    bullets?: string[];
    image?: string;
    backgroundImage?: string;
    mediaElements?: SlideMediaElement[];
    stats?: { value: string; label: string }[];
    textColors?: {
      eyebrow?: string;
      title?: string;
      subtitle?: string;
      body?: string;
      bullets?: string;
      stats?: string;
    };
    textStyleColors?: Record<string, string>;
    textPositions?: Record<string, { x: number; y: number }>;
    textSizes?: Record<string, number>;
  };
  notes: string;
  narrationText?: string;
};

export type SlideMediaElement = {
  id: string;
  type: "image" | "video" | "icon";
  src?: string;
  icon?: "home" | "heart" | "star" | "check" | "sparkles" | "arrow" | "idea";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NarrationSettings = {
  rate: number;
  volume?: number;
  voiceURI?: string;
  muted?: boolean;
};
export type PresentationLanguage = "en" | "nl" | "ro" | "es";
export type SpeechLocale = "en-US" | "nl-NL" | "ro-RO" | "es-ES";
export const speechLocaleForLanguage: Record<PresentationLanguage, SpeechLocale> = {
  en: "en-US",
  nl: "nl-NL",
  ro: "ro-RO",
  es: "es-ES",
};

export type StudioPresentation = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: "DRAFT" | "READY" | "ARCHIVED";
  updatedAt: string;
  theme: { accent: string; background: string; font: string };
  narrationSettings: NarrationSettings;
  language: PresentationLanguage;
  translationNeedsReview: boolean;
  slides: StudioSlide[];
};

export const thuiszoekSlides: StudioSlide[] = [
  { id: "tz-1", title: "ThuisZoek.nl", subtitle: "Een nieuw platform voor de Nederlandse woningmarkt", layout: "cover", content: { eyebrow: "SAMEN BOUWEN AAN WONINGZOEKEN", body: "Een plek waar woningzoekers en makelaars elkaar makkelijker vinden.", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1600&q=85" }, notes: "Open met een korte introductie. Vertel dat ThuisZoek.nl een nieuw platform in ontwikkeling is. Vraag: hoe vinden woningzoekers uw aanbod op dit moment?" },
  { id: "tz-2", title: "Een helder vertrekpunt", subtitle: "Woning zoeken en aanbod presenteren, op één centrale plek.", layout: "content", content: { eyebrow: "DE VISIE", body: "We willen een toegankelijk platform bouwen dat het makkelijker maakt om woningen te ontdekken en aanbod te presenteren.", bullets: ["Overzichtelijk zoeken op één plek", "Een professionele plek voor ieder kantoor", "Stap voor stap ontwikkelen met feedback uit de praktijk"] }, notes: "Leg de visie uit als ambitie, niet als iets dat al gerealiseerd is. Vraag welke onderdelen voor hun kantoor het meest waardevol zouden zijn." },
  { id: "tz-3", title: "Een zoektocht met veel losse stappen", subtitle: "Zowel woningzoekers als makelaars hebben te maken met versnipperde informatie.", layout: "split", content: { eyebrow: "DE UITDAGING", body: "Wie een woning zoekt, vergelijkt aanbod op verschillende plekken. Voor kantoren vraagt online presentatie om tijd en overzicht.", bullets: ["Aanbod is verdeeld over meerdere kanalen", "Zoekers willen snel relevante details vinden", "Kantoren willen hun woningen zorgvuldig presenteren"], image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=85" }, notes: "Beschrijf herkenbare situaties zonder te suggereren dat er onderzoek of cijfers aan ten grondslag liggen. Vraag hoe dit in hun regio speelt." },
  { id: "tz-4", title: "Een centrale marktplaats", subtitle: "Huur en koop. Wonen en commercieel vastgoed.", layout: "content", content: { eyebrow: "DE OPLOSSING", body: "ThuisZoek.nl wil aanbod en woningzoekers samenbrengen in één duidelijk, toegankelijk platform.", bullets: ["Woningen te huur en te koop", "Ruimte voor residentieel én commercieel aanbod", "Duidelijke presentatie met foto's en kerninformatie"] }, notes: "Maak duidelijk dat dit het concept en de beoogde richting is. Nodig de makelaar uit om mee te denken over wat een listing echt compleet maakt." },
  { id: "tz-5", title: "Voor woningzoekers", subtitle: "Snel van oriënteren naar contact.", layout: "split", content: { eyebrow: "ZOEKEN OP JE MANIER", body: "De beoogde ervaring helpt mensen aanbod te vinden dat past bij hun wensen.", bullets: ["Zoeken met praktische filters", "Belangrijke woningdetails overzichtelijk bekijken", "Eenvoudig contact opnemen met het aanbiedende kantoor"], image: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=85" }, notes: "Vraag welke filters hun klanten vaak gebruiken. Benoem dit als geplande functionaliteit waar we graag feedback op ontvangen." },
  { id: "tz-6", title: "Voor makelaars en aanbieders", subtitle: "Een duidelijke plek voor kantoor en aanbod.", layout: "content", content: { eyebrow: "GEMAAKT MET DE PRAKTIJK", body: "Het platform is bedoeld om kantoren hun aanbod professioneel te laten beheren en presenteren.", bullets: ["Een eigen kantoorprofiel", "Woningen met foto's en uitgebreide informatie beheren", "Publicatiestatus en binnengekomen aanvragen bijhouden"] }, notes: "Deze functies zijn onderdeel van de beoogde productrichting; controleer voor het gesprek welke onderdelen op dat moment al beschikbaar zijn." },
  { id: "tz-7", title: "Een verdienmodel in ontwikkeling", subtitle: "Eerst waarde en vertrouwen opbouwen.", layout: "stats", content: { eyebrow: "HET MODEL", body: "De commerciële invulling wordt zorgvuldig uitgewerkt en is nog niet definitief.", stats: [{ value: "Aanbieders", label: "Plannen voor verschillende kantoorbehoeften" }, { value: "Woningzoekers", label: "Een mogelijk betaald abonnement op termijn" }] }, notes: "Er zijn nog geen definitieve prijzen of inkomsten. Vraag welke onderdelen een kantoor zou verwachten van een betaald plan." },
  { id: "tz-8", title: "Starten zonder plan-kosten", subtitle: "Aanbieders betalen tijdens de eerste lanceringsfase niets voor providerplannen.", layout: "quote", content: { eyebrow: "HET LANCERINGSAANBOD", body: "Providerplannen zijn tijdens de initiële lanceringsfase gratis, onder voorbehoud van de definitieve lanceringsvoorwaarden.", bullets: ["De exacte duur en voorwaarden worden nog vastgesteld", "Geen toezegging over bereik, leads of resultaat"] }, notes: "Vertel dit precies zoals geformuleerd: gratis gedurende de initiële lanceringsfase, onder voorbehoud van definitieve voorwaarden. Deel geen aannames over duur." },
  { id: "tz-9", title: "Help mee vormgeven", subtitle: "Vroege partners kunnen feedback geven voordat we verder opschalen.", layout: "content", content: { eyebrow: "WAAROM NU AANSLUITEN?", body: "We zoeken makelaars die mee willen denken over een platform dat aansluit op de dagelijkse praktijk.", bullets: ["Geef feedback op de gebruikerservaring", "Denk mee over handige functies", "Help prioriteiten bepalen voor volgende stappen"] }, notes: "Benadruk dat deelname een kans is om feedback te geven; beloof geen extra zichtbaarheid, leads of resultaten. Vraag: zou u feedback willen geven op een vroege versie?" },
  { id: "tz-10", title: "Van lokaal beginnen naar verder bouwen", subtitle: "Een gefaseerde aanpak, met ruimte om te leren.", layout: "content", content: { eyebrow: "LANCERINGSSTRATEGIE", body: "We willen gecontroleerd starten en uitbreiden op basis van wat werkt.", bullets: ["Makelaars als launchpartners uitnodigen", "Alleen aanbod publiceren met toestemming", "Lokaal starten en reacties verzamelen", "Vervolgens stap voor stap uitbreiden"] }, notes: "Leg uit dat de volgorde een voorgenomen aanpak is. Vraag welke regio en aanpak voor hun kantoor logisch voelt." },
  { id: "tz-11", title: "Een roadmap die meegroeit", subtitle: "Eerst een solide basis, daarna uitbreiden.", layout: "split", content: { eyebrow: "WAT HIERNA KAN VOLGEN", body: "De roadmap is richtinggevend; de volgorde hangt af van feedback en beschikbare middelen.", bullets: ["Zoeken en filteren verder verfijnen", "Profielen en beheerfuncties verbeteren", "Meer regio's en aanbodcategorieën toevoegen", "Nieuwe functies toetsen met gebruikers"], image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=85" }, notes: "Maak duidelijk dat dit plannen zijn en geen toezeggingen. Vraag: welke verbetering zou voor uw team het meeste verschil maken?" },
  { id: "tz-12", title: "Zullen we kennismaken?", subtitle: "We vertellen graag meer over aansluiten als launchpartner.", layout: "cta", content: { eyebrow: "VOLGENDE STAP", body: "Neem contact op om de mogelijkheden te bespreken.\n\nNaam: [vul naam in]\nE-mail: [vul e-mailadres in]\nTelefoon: [vul telefoonnummer in]" }, notes: "Sluit af met een uitnodiging, niet met druk. Vervang de contactgegevens tussen haken vóór het gesprek. Vraag of ze een vervolggesprek of demo willen." },
];

export const demoPresentations: StudioPresentation[] = [
  { id: "thuiszoek", title: "ThuisZoek.nl — Launchpartners", description: "Kennismaking met makelaars en vastgoedkantoren", category: "Sales", status: "READY", updatedAt: "2026-10-20T13:20:00.000Z", theme: { accent: "#718b55", background: "#f3f5ed", font: "Georgia, serif" }, narrationSettings: { rate: 1 }, language: "nl", translationNeedsReview: false, slides: thuiszoekSlides },
  { id: "saas-intro", title: "Productintroductie — template", description: "Een flexibele basis voor SaaS-presentaties", category: "Template", status: "DRAFT", updatedAt: "2026-10-18T09:10:00.000Z", theme: { accent: "#718b55", background: "#f3f5ed", font: "Georgia, serif" }, narrationSettings: { rate: 1 }, language: "nl", translationNeedsReview: false, slides: [{ id: "saas-1", title: "Jouw product, helder uitgelegd", subtitle: "Een presentatie die je verhaal vertelt", layout: "cover", content: { eyebrow: "PRODUCTINTRODUCTIE", body: "Vervang deze tekst met jouw productverhaal." }, notes: "Begin met de context: voor wie is dit product bedoeld?" }, { id: "saas-2", title: "Het probleem dat we oplossen", subtitle: "Beschrijf de behoefte van je doelgroep.", layout: "content", content: { eyebrow: "DE UITDAGING", bullets: ["Voeg hier een herkenbare uitdaging toe", "Beschrijf wat er nu beter kan"] }, notes: "Gebruik alleen claims die je kunt onderbouwen." }] },
  { id: "blank", title: "New presentation", description: "Een leeg canvas voor jouw verhaal", category: "Concept", status: "DRAFT", updatedAt: "2026-10-12T15:42:00.000Z", theme: { accent: "#718b55", background: "#f3f5ed", font: "Georgia, serif" }, narrationSettings: { rate: 1 }, language: "nl", translationNeedsReview: false, slides: [{ id: "blank-1", title: "Begin met jouw verhaal", subtitle: "Voeg een ondertitel toe", layout: "cover", content: { eyebrow: "PRESENTATIETITEL", body: "Een korte introductie van je idee." }, notes: "Leg in één zin uit waarom dit verhaal belangrijk is voor je publiek." }] },
];

export const templates = [
  "Startup pitch", "SaaS product", "Sales pitch", "Business proposal",
  "Partnership proposal", "Investor presentation", "Product demo",
  "New business idea", "Blank canvas",
];

const templateLanguageCopy: Record<PresentationLanguage, {
  names: string[];
  topics: string[];
  slides: { title: string; subtitle: string; eyebrow: string; body: string; bullets: string[]; stats: string[]; note: string }[];
}> = {
  en: {
    names: ["Startup pitch", "SaaS product", "Sales presentation", "Business proposal", "Partnership proposal", "Investor presentation", "Product demo", "New business idea", "Blank canvas"],
    topics: ["a startup", "a SaaS product", "a client proposal", "a business proposal", "a partnership", "an investment round", "a product demo", "a new business idea", "a blank presentation"],
    slides: [
      { title: "Your idea at a glance", subtitle: "Introduce the idea and who it is for.", eyebrow: "INTRODUCTION", body: "Replace this text with a short, clear introduction.", bullets: ["Describe the need", "Explain the approach you want to explore"], stats: ["To validate", "Current assumption"], note: "Explain why the idea may be relevant and mention open questions." },
      { title: "The challenge", subtitle: "Describe the situation from your audience's perspective.", eyebrow: "THE CHALLENGE", body: "Use examples you can support.", bullets: ["Add a relatable situation", "Mention what you still want to research"], stats: ["Add source", "To validate"], note: "Distinguish your own assumptions from confirmed information." },
      { title: "A possible solution", subtitle: "Explain how your approach addresses the need.", eyebrow: "THE APPROACH", body: "Replace this placeholder with the key parts of your solution.", bullets: ["Describe the first step", "Explain the value for the user"], stats: ["Add value", "Add label"], note: "Ask which parts are most relevant to your audience." },
      { title: "What we still need to validate", subtitle: "Separate facts, assumptions, and plans.", eyebrow: "ASSUMPTIONS AND PLAN", body: "Only add information that you can verify.", bullets: ["Describe an assumption", "Explain how you could test it"], stats: ["Assumption", "To research"], note: "Avoid unsupported forecasts and state what is still unknown." },
      { title: "The next step", subtitle: "Invite your audience to take a concrete next step.", eyebrow: "NEXT STEP", body: "Adapt this call to action to the conversation and audience.", bullets: ["Suggest a follow-up conversation", "Ask for feedback"], stats: ["Action", "Owner"], note: "End with an open question and agree on the next step together." },
    ],
  },
  nl: {
    names: ["Startuppitch", "SaaS-product", "Verkooppresentatie", "Zakelijk voorstel", "Samenwerkingsvoorstel", "Investeerderspresentatie", "Productdemo", "Nieuw businessidee", "Leeg canvas"],
    topics: ["een startup", "een SaaS-product", "een klantvoorstel", "een zakelijk voorstel", "een samenwerking", "een investeringsronde", "een productdemo", "een nieuw businessidee", "een lege presentatie"],
    slides: [
      { title: "Jouw idee in het kort", subtitle: "Introduceer het idee en voor wie het bedoeld is.", eyebrow: "INTRODUCTIE", body: "Vervang deze tekst door een korte, duidelijke introductie.", bullets: ["Beschrijf de behoefte", "Leg uit welke aanpak je wilt verkennen"], stats: ["Te valideren", "Huidige aanname"], note: "Vertel waarom dit idee relevant kan zijn en benoem open vragen." },
      { title: "De uitdaging", subtitle: "Beschrijf de situatie vanuit het perspectief van de doelgroep.", eyebrow: "DE UITDAGING", body: "Gebruik voorbeelden die je kunt onderbouwen.", bullets: ["Voeg een herkenbare situatie toe", "Benoem wat je nog wilt onderzoeken"], stats: ["Bron toevoegen", "Nog te toetsen"], note: "Maak onderscheid tussen eigen aannames en bevestigde informatie." },
      { title: "De mogelijke oplossing", subtitle: "Leg uit hoe jouw aanpak op de behoefte aansluit.", eyebrow: "DE AANPAK", body: "Vervang deze placeholder door de belangrijkste onderdelen van je oplossing.", bullets: ["Beschrijf de eerste stap", "Leg uit wat de gebruiker eraan heeft"], stats: ["Voeg waarde toe", "Voeg label toe"], note: "Vraag welke onderdelen het meest relevant zijn voor je publiek." },
      { title: "Wat we nog moeten valideren", subtitle: "Scheid feiten, aannames en plannen.", eyebrow: "AANNAMES EN PLAN", body: "Voeg hier uitsluitend informatie toe die je kunt controleren.", bullets: ["Beschrijf een aanname", "Benoem hoe je deze kunt toetsen"], stats: ["Aanname", "Te onderzoeken"], note: "Vermijd prognoses zonder onderbouwing en benoem wat nog onbekend is." },
      { title: "De volgende stap", subtitle: "Nodig uit tot een concrete vervolgstap.", eyebrow: "VOLGENDE STAP", body: "Pas deze oproep aan op het gesprek en de doelgroep.", bullets: ["Stel een vervolggesprek voor", "Vraag om feedback"], stats: ["Actie", "Eigenaar"], note: "Eindig met een open vraag en stem samen de vervolgstap af." },
    ],
  },
  ro: {
    names: ["Prezentare pentru startup", "Produs SaaS", "Prezentare de vânzări", "Propunere de afaceri", "Propunere de parteneriat", "Prezentare pentru investitori", "Demonstrație de produs", "Idee de afaceri nouă", "Pagină goală"],
    topics: ["un startup", "un produs SaaS", "o propunere pentru client", "o propunere de afaceri", "un parteneriat", "o rundă de investiții", "o demonstrație de produs", "o idee de afaceri nouă", "o prezentare goală"],
    slides: [
      { title: "Ideea ta, pe scurt", subtitle: "Prezintă ideea și publicul căruia i se adresează.", eyebrow: "INTRODUCERE", body: "Înlocuiește acest text cu o introducere scurtă și clară.", bullets: ["Descrie o nevoie", "Explică abordarea pe care vrei să o explorezi"], stats: ["De validat", "Ipoteza actuală"], note: "Explică de ce ideea poate fi relevantă și menționează întrebările deschise." },
      { title: "Provocarea", subtitle: "Descrie situația din perspectiva publicului țintă.", eyebrow: "PROVOCAREA", body: "Folosește exemple pe care le poți susține.", bullets: ["Adaugă o situație relevantă", "Menționează ce vrei să cercetezi"], stats: ["Adaugă sursa", "De verificat"], note: "Separă ipotezele proprii de informațiile confirmate." },
      { title: "O posibilă soluție", subtitle: "Explică modul în care abordarea răspunde nevoii.", eyebrow: "ABORDAREA", body: "Înlocuiește acest text cu elementele principale ale soluției.", bullets: ["Descrie primul pas", "Explică beneficiul pentru utilizator"], stats: ["Adaugă valoarea", "Adaugă eticheta"], note: "Întreabă care elemente sunt cele mai relevante pentru public." },
      { title: "Ce trebuie validat", subtitle: "Separă faptele, ipotezele și planurile.", eyebrow: "IPOTEZE ȘI PLAN", body: "Adaugă doar informații care pot fi verificate.", bullets: ["Descrie o ipoteză", "Menționează cum poate fi testată"], stats: ["Ipoteză", "De cercetat"], note: "Evită estimările fără susținere și precizează ce nu este încă cunoscut." },
      { title: "Următorul pas", subtitle: "Propune o acțiune concretă.", eyebrow: "URMĂTORUL PAS", body: "Adaptează invitația la conversație și la public.", bullets: ["Propune o discuție de continuare", "Solicită feedback"], stats: ["Acțiune", "Responsabil"], note: "Încheie cu o întrebare deschisă și stabiliți împreună pasul următor." },
    ],
  },
  es: {
    names: ["Presentación para startup", "Producto SaaS", "Presentación de ventas", "Propuesta de negocio", "Propuesta de colaboración", "Presentación para inversores", "Demostración del producto", "Nueva idea de negocio", "Lienzo en blanco"],
    topics: ["una startup", "un producto SaaS", "una propuesta para un cliente", "una propuesta de negocio", "una colaboración", "una ronda de inversión", "una demostración del producto", "una nueva idea de negocio", "una presentación en blanco"],
    slides: [
      { title: "Tu idea en pocas palabras", subtitle: "Presenta la idea y a quién va dirigida.", eyebrow: "INTRODUCCIÓN", body: "Sustituye este texto por una introducción breve y clara.", bullets: ["Describe una necesidad", "Explica el enfoque que quieres explorar"], stats: ["Por validar", "Hipótesis actual"], note: "Explica por qué la idea puede ser relevante y menciona las preguntas abiertas." },
      { title: "El reto", subtitle: "Describe la situación desde la perspectiva del público objetivo.", eyebrow: "EL RETO", body: "Utiliza ejemplos que puedas respaldar.", bullets: ["Añade una situación reconocible", "Indica qué quieres investigar"], stats: ["Añadir fuente", "Por comprobar"], note: "Distingue tus hipótesis de la información confirmada." },
      { title: "Una posible solución", subtitle: "Explica cómo tu enfoque responde a la necesidad.", eyebrow: "EL ENFOQUE", body: "Sustituye este texto por los elementos principales de la solución.", bullets: ["Describe el primer paso", "Explica el valor para el usuario"], stats: ["Añadir valor", "Añadir etiqueta"], note: "Pregunta qué elementos son más relevantes para el público." },
      { title: "Qué debemos validar", subtitle: "Separa los hechos, las hipótesis y los planes.", eyebrow: "HIPÓTESIS Y PLAN", body: "Añade únicamente información que puedas verificar.", bullets: ["Describe una hipótesis", "Explica cómo podrías comprobarla"], stats: ["Hipótesis", "Por investigar"], note: "Evita previsiones sin fundamento e indica qué se desconoce todavía." },
      { title: "El siguiente paso", subtitle: "Propón una acción concreta.", eyebrow: "SIGUIENTE PASO", body: "Adapta esta invitación a la conversación y al público.", bullets: ["Propón una conversación de seguimiento", "Pide comentarios"], stats: ["Acción", "Responsable"], note: "Termina con una pregunta abierta y acuerda el siguiente paso." },
    ],
  },
};

export function templateName(name: string, language: PresentationLanguage) {
  const index = templates.indexOf(name);
  return templateLanguageCopy[language].names[index] ?? name;
}

export function createTemplateSlides(name: string, language: PresentationLanguage = "en"): StudioSlide[] {
  const copy = templateLanguageCopy[language];
  if (name === "Blank canvas") {
    const blankCopy = {
      en: { title: "Start with your story", subtitle: "Add a subtitle", eyebrow: "PRESENTATION TITLE", body: "A short introduction to your idea.", notes: "Explain in one sentence why this story matters to your audience." },
      nl: { title: "Begin met jouw verhaal", subtitle: "Voeg een ondertitel toe", eyebrow: "PRESENTATIETITEL", body: "Een korte introductie van je idee.", notes: "Leg in één zin uit waarom dit verhaal belangrijk is voor je publiek." },
      ro: { title: "Începe cu povestea ta", subtitle: "Adaugă un subtitlu", eyebrow: "TITLUL PREZENTĂRII", body: "O scurtă introducere a ideii tale.", notes: "Explică într-o singură propoziție de ce această poveste este importantă pentru public." },
      es: { title: "Empieza con tu historia", subtitle: "Añade un subtítulo", eyebrow: "TÍTULO DE LA PRESENTACIÓN", body: "Una breve introducción a tu idea.", notes: "Explica en una frase por qué esta historia es importante para el público." },
    }[language];
    return [{
      id: "blank-1",
      title: blankCopy.title,
      subtitle: blankCopy.subtitle,
      layout: "cover",
      content: { eyebrow: blankCopy.eyebrow, body: blankCopy.body },
      notes: blankCopy.notes,
    }];
  }
  const templateIndex = templates.indexOf(name);
  const topic = copy.topics[templateIndex] ?? copy.topics[0];
  return copy.slides.map((item, index) => ({
    id: `template-${index + 1}`,
    title: index === 0 ? `${item.title}: ${topic}` : item.title,
    subtitle: item.subtitle,
    layout: (["cover", "content", "split", "stats", "cta"] as const)[index],
    content: {
      eyebrow: `${item.eyebrow} · ${String(index + 1).padStart(2, "0")}`,
      body: index === 0
        ? {
          en: `Replace this text with a short, clear introduction to ${topic}.`,
          nl: `Vervang deze tekst door een korte, duidelijke introductie van ${topic}.`,
          ro: `Înlocuiește acest text cu o introducere scurtă și clară despre ${topic}.`,
          es: `Sustituye este texto por una introducción breve y clara sobre ${topic}.`,
        }[language]
        : item.body,
      ...(index === 1 ? { bullets: item.bullets } : {}),
      ...(index === 3 ? { stats: item.stats.map((label) => ({ value: "[…]", label })) } : {}),
    },
    notes: item.note,
  }));
}
