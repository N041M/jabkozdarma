import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

/**
 * Tiny i18n layer: Czech + English, auto-detected from the device language.
 * On web, `?lang=cs` / `?lang=en` overrides detection (handy for testing and
 * for sharing links in a specific language).
 */

const en = {
  // tabs & titles
  tabMap: 'Map',
  tabProfile: 'Profile',
  appleTree: 'Apple tree',
  addTreeTitle: 'Add a tree',

  // map screen
  viewFlat: 'Switch to the plain top-down map',
  viewGo: 'Switch to the 3D view',
  legendRipe: 'Ripe now',
  legendUnripe: 'Unripe',
  legendNone: 'No report',
  needLocationToAdd: 'Adding a tree needs your location, so pins land where you actually are.',
  cancel: 'Cancel',
  routeTo: 'to {label}',
  routeFormat: '{dist} · {time} walk',
  minutes: '{m} min',
  hoursMinutes: '{h} h {m} min',

  // species
  speciesLabel: 'WHAT KIND OF TREE?',
  species_apple: 'Apple',
  species_pear: 'Pear',
  species_plum: 'Plum',
  species_cherry: 'Cherry',
  species_walnut: 'Walnut',
  species_other: 'Other fruit',

  // access
  access_public: 'Public land',
  access_roadside: 'Roadside',
  access_ask_owner: 'Ask the owner',

  // ripeness
  state_flowering: 'Flowering',
  state_unripe: 'Unripe',
  state_ripe: 'Ripe now',
  state_past: 'Past ripe',
  state_bare: 'Bare',

  // flags
  flag_gone: 'Tree is gone',
  flag_duplicate: 'Duplicate pin',
  flag_private: 'On private land',
  flag_wrong_info: 'Wrong info',

  // tree detail
  treeGone: 'This tree is no longer on the map.',
  unverified: 'Unverified',
  usualSeason: 'Usual season:',
  addedBy: 'Added by {name} · {when}',
  walkThere: 'Walk there',
  findingRoute: 'Finding a route…',
  routeError: 'Couldn’t get a walking route — check that location access is allowed and try again.',
  edit: 'Edit',
  howIsIt: 'How is it right now?',
  signInToReport: 'Sign in on the Profile screen to report ripeness.',
  reports: 'Reports',
  noReports: 'No reports yet',
  flagThanks: 'Thanks — flagged as “{reason}”. A moderator will take a look.',
  reportProblem: 'Report a problem with this pin',
  signInToFlag: 'Sign in to report a problem',
  deleteTree: 'Delete this pin',
  deleteConfirm: 'Tap again to delete permanently',

  // add/edit form
  duplicateWarning:
    'There {count, plural, one {is already a pin} other {are already # pins}} within 25 m of this spot. Check it isn’t the same tree before saving.',
  varietyLabel: 'VARIETY (IF KNOWN)',
  varietyPlaceholder: 'e.g. James Grieve',
  notesLabel: 'NOTES',
  notesPlaceholder: 'Where exactly is it? What are the apples like?',
  accessLabel: 'WHO CAN PICK HERE?',
  ownerHint:
    'Pins on private land show an “ask the owner” badge. Only add them with the owner’s blessing.',
  seasonLabel: 'WHEN IS IT RIPE?',
  notSure: 'Not sure',
  photoLabel: 'PHOTO',
  addPhoto: 'Add a photo of the tree',
  saveChanges: 'Save changes',
  addToMap: 'Add tree to the map',

  // profile
  joinTitle: 'Join in',
  joinCopy:
    'Browsing the map is free for everyone. Create a profile to add trees, report ripeness, and save favorites.',
  continueWithGoogle: 'Continue with Google',
  orEmail: 'or use email',
  googleError: 'Google sign-in didn’t start — please try again.',
  usernamePlaceholder: 'Username',
  usernameHint: 'Username is only needed the first time — returning pickers just enter their email.',
  emailPlaceholder: 'Your email',
  createProfile: 'Create profile',
  sendCode: 'Email me a sign-in link',
  sendingCode: 'Sending…',
  codeSentTo:
    'We emailed a sign-in link to {email}. Open it on this device — the app signs you in automatically.',
  waitingForLink: 'Waiting for you to open the link…',
  resendLink: 'Send the link again',
  sendError: 'Couldn’t send the email — check the address and try again.',
  rateLimitError:
    'Too many sign-in emails in the last hour — the free email service allows only a few. Continue with Google instead, or try again in about an hour.',
  changeEmail: 'Use a different email',
  localProfileNote:
    'Local profile for now — Apple, Google and email sign-in arrive when the Supabase backend is connected.',
  joined: 'Joined {when}',
  statTrees: 'trees added',
  statReports: 'reports',
  statFavorites: 'favorites',
  myTrees: 'My trees',
  favorites: 'Favorites',
  addedWhen: 'added {when}',
  signOut: 'Sign out',
  localMode: 'Local mode — your data stays on this device until the backend is connected.',
  backendConnected: 'Connected to Supabase',

  // language
  languageLabel: 'Language',
  langAuto: 'Device',

  // privacy & account
  privacyTitle: 'Privacy & your data',
  privacyLink: 'Privacy & your data',
  yourData: 'YOUR DATA',
  downloadData: 'Download my data',
  deleteAccount: 'Delete my account',
  deleteAccountConfirm: 'Tap again to delete your account permanently',
  deleteAccountWarning:
    'This erases your profile, your email and the trees and reports you added. It cannot be undone.',
  deleteAccountError: 'Couldn’t delete the account — please try again.',
  editName: 'Change name',
  saveName: 'Save',
  nameTaken: 'That name is already taken — try another.',

  // error recovery
  errorTitle: 'Something went wrong',
  errorRetry: 'Try again',
  errorReset: 'Reset app data',
  errorResetHint: 'If it keeps happening, resetting clears locally saved data and starts fresh.',

  // time
  today: 'today',
  yesterday: 'yesterday',
  daysAgo: '{n} days ago',
  monthAgo: 'a month ago',
  monthsAgo: '{n} months ago',

  // rail & camera ladder
  tabHarvest: 'Harvest',
  tabDex: 'Jablkodex',
  actPick: 'Pick',
  actAdd: 'Add',
  actRoute: 'Route',
  actDistrict: 'District',
  actArea: 'Area',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  locateMe: 'Center on me',
  cycleScale: 'Change the zoom stop',

  // context card
  cardNoTree: 'No tree within {r} m',
  cardNoTreeSub: 'Is there one here? Add it with the Add button.',
  cardInView: '{n, plural, one {# tree} other {# trees}} in view',
  cardBreak: '{ripe} ripe · {unripe} unripe · {none} unreported',
  cardBest: 'Most ripe: {name}',
  cardBestNearby: 'Most ripe nearby',
  cardBestSubNoLocation: '{n, plural, one {# tree} other {# trees}}, distance unknown',
  cardBestSub: '{n, plural, one {# tree} other {# trees}} · {d} · {t} walk',
  cardRegion: 'Prague and Central Bohemia',
  cardRegionSub: '{n, plural, one {# tree} other {# trees}} · {r} ripe right now',
  cardReport: 'Report',
  addFavorite: 'Save to favorites',
  removeFavorite: 'Remove from favorites',
  removePhoto: 'Remove photo',
  dismiss: 'Dismiss',
  metresAway: '{n} m away',
  densityLegend: 'TREES / KM²',
  seasonSixMonths: 'Ripe reports, last six months',

  // toasts
  toastPick: 'Picked · +25 XP',
  toastTree: 'Tree is on the map · +40 XP',
  toastReport: 'Reported · +15 XP',
  toastQuest: 'Weekly quest complete · +150 XP',
  toastRoute: 'Route to {name} · {d}',
  toastDex: 'New variety: {name}',
  toastDistrict: 'Camera flew to {name}',
  toastArea: 'Densest area selected',
  toastNothingNear: 'No tree near enough to pick',
  toastNoRoute: 'Couldn’t get a walking route right now',
  toastSignIn: 'Sign in on the Profile screen to contribute',

  // harvest list
  harvestTitle: 'Harvest',
  filterNear: 'Under 2 km',
  nearYou: 'Near you',
  harvestEmpty: 'Nothing matches these filters yet — try turning one off.',
  needLocationForList: 'Allow location and the list sorts by how far away each tree is.',

  // jablkodex
  dexTitle: 'Jablkodex',
  dexSubtitle: '{n} of {total} varieties found',
  level: 'Level {n} · Picker',
  xpProgress: '{xp} / {max} XP',
  questLabel: 'QUEST OF THE WEEK',
  questTitle: 'Report ripeness at 3 trees',
  questReward: '+150 XP',
  questHint: 'Resets on Monday',
  questDone: 'Done — a new quest lands on Monday',
  streakLabel: '{n, plural, one {# day} other {# days}} in a row',
  varieties: 'Varieties',
  notFound: 'Not found',

  // add a tree
  placedHere: 'The pin lands where you are standing.',
  saveReward: 'A new tree earns you 40 XP',

  // profile
  railSideLabel: 'RAIL SIDE',
  railRight: 'Right',
  railLeft: 'Left',
  railSideHint: 'Which edge the navigation rail sits on — put it under your thumb.',

  // months (short)
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  // weekdays (short), Monday first
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

const cs: typeof en = {
  tabMap: 'Mapa',
  tabProfile: 'Profil',
  appleTree: 'Jabloň',
  addTreeTitle: 'Přidat strom',

  viewFlat: 'Přepnout na jednoduchou mapu shora',
  viewGo: 'Přepnout na 3D zobrazení',
  legendRipe: 'Zralé teď',
  legendUnripe: 'Nezralé',
  legendNone: 'Bez hlášení',
  needLocationToAdd: 'Pro přidání stromu je potřeba vaše poloha, aby špendlík seděl tam, kde opravdu jste.',
  cancel: 'Zrušit',
  routeTo: 'cíl: {label}',
  routeFormat: '{dist} · {time} pěšky',
  minutes: '{m} min',
  hoursMinutes: '{h} h {m} min',

  speciesLabel: 'JAKÝ JE TO STROM?',
  species_apple: 'Jabloň',
  species_pear: 'Hrušeň',
  species_plum: 'Švestka',
  species_cherry: 'Třešeň',
  species_walnut: 'Ořešák',
  species_other: 'Jiné ovoce',

  access_public: 'Veřejné',
  access_roadside: 'U cesty',
  access_ask_owner: 'Se svolením majitele',

  state_flowering: 'Kvete',
  state_unripe: 'Nezralé',
  state_ripe: 'Zralé teď',
  state_past: 'Přezrálé',
  state_bare: 'Otrháno',

  flag_gone: 'Strom už tam není',
  flag_duplicate: 'Duplicitní špendlík',
  flag_private: 'Na soukromém pozemku',
  flag_wrong_info: 'Špatné údaje',

  treeGone: 'Tento strom už na mapě není.',
  unverified: 'Neověřeno',
  usualSeason: 'Obvyklá sezóna:',
  addedBy: 'Přidal(a) {name} · {when}',
  walkThere: 'Trasa pěšky',
  findingRoute: 'Hledám trasu…',
  routeError: 'Trasu se nepodařilo najít — zkontrolujte povolení polohy a zkuste to znovu.',
  edit: 'Upravit',
  howIsIt: 'Jak to tam teď vypadá?',
  signInToReport: 'Pro hlášení zralosti se přihlaste v Profilu.',
  reports: 'Hlášení',
  noReports: 'Zatím žádná hlášení',
  flagThanks: 'Díky — nahlášeno jako „{reason}“. Moderátor se na to podívá.',
  reportProblem: 'Nahlásit problém s tímto špendlíkem',
  signInToFlag: 'Pro nahlášení problému se přihlaste',
  deleteTree: 'Smazat tento špendlík',
  deleteConfirm: 'Klepněte znovu pro trvalé smazání',

  duplicateWarning:
    'V okruhu 25 m {count, plural, one {už jeden špendlík je} other {už # špendlíky jsou}}. Než strom uložíte, zkontrolujte, že nejde o ten samý.',
  varietyLabel: 'ODRŮDA (POKUD JI ZNÁTE)',
  varietyPlaceholder: 'např. Panenské české',
  notesLabel: 'POZNÁMKY',
  notesPlaceholder: 'Kde přesně strom stojí? Jaká jsou jablka?',
  accessLabel: 'KDO TU MŮŽE TRHAT?',
  ownerHint:
    'Špendlíky na soukromém pozemku mají odznak „se svolením majitele“. Přidávejte je jen s jeho souhlasem.',
  seasonLabel: 'KDY DOZRÁVÁ?',
  notSure: 'Nevím',
  photoLabel: 'FOTKA',
  addPhoto: 'Přidat fotku stromu',
  saveChanges: 'Uložit změny',
  addToMap: 'Přidat strom na mapu',

  joinTitle: 'Přidejte se',
  joinCopy:
    'Procházení mapy je zdarma pro všechny. Vytvořte si profil a můžete přidávat stromy, hlásit zralost a ukládat oblíbené.',
  continueWithGoogle: 'Pokračovat přes Google',
  orEmail: 'nebo použijte e-mail',
  googleError: 'Přihlášení přes Google se nepodařilo spustit — zkuste to prosím znovu.',
  usernamePlaceholder: 'Uživatelské jméno',
  usernameHint: 'Jméno je potřeba jen poprvé — kdo se vrací, zadá jen e-mail.',
  emailPlaceholder: 'Váš e-mail',
  createProfile: 'Vytvořit profil',
  sendCode: 'Poslat přihlašovací odkaz',
  sendingCode: 'Odesílám…',
  codeSentTo:
    'Poslali jsme přihlašovací odkaz na {email}. Otevřete ho na tomto zařízení — aplikace vás přihlásí automaticky.',
  waitingForLink: 'Čekám na otevření odkazu…',
  resendLink: 'Poslat odkaz znovu',
  sendError: 'E-mail se nepodařilo odeslat — zkontrolujte adresu a zkuste to znovu.',
  rateLimitError:
    'Za poslední hodinu se odeslalo příliš mnoho přihlašovacích e-mailů — bezplatná služba jich povolí jen pár. Použijte přihlášení přes Google, nebo to zkuste zhruba za hodinu.',
  changeEmail: 'Použít jiný e-mail',
  localProfileNote:
    'Zatím jen místní profil — přihlášení přes Apple, Google a e-mail přijde s připojením backendu.',
  joined: 'Členem {when}',
  statTrees: 'přidané stromy',
  statReports: 'hlášení',
  statFavorites: 'oblíbené',
  myTrees: 'Moje stromy',
  favorites: 'Oblíbené',
  addedWhen: 'přidáno {when}',
  signOut: 'Odhlásit se',
  localMode: 'Místní režim — data zůstávají v tomto zařízení, dokud není připojen backend.',
  backendConnected: 'Připojeno k Supabase',

  languageLabel: 'Jazyk',
  langAuto: 'Podle zařízení',

  privacyTitle: 'Soukromí a vaše data',
  privacyLink: 'Soukromí a vaše data',
  yourData: 'VAŠE DATA',
  downloadData: 'Stáhnout moje data',
  deleteAccount: 'Smazat účet',
  deleteAccountConfirm: 'Klepněte znovu pro trvalé smazání účtu',
  deleteAccountWarning:
    'Smaže se profil, e-mail i stromy a hlášení, které jste přidali. Akci nelze vzít zpět.',
  deleteAccountError: 'Účet se nepodařilo smazat — zkuste to prosím znovu.',
  editName: 'Změnit jméno',
  saveName: 'Uložit',
  nameTaken: 'Toto jméno je už obsazené — zkuste jiné.',

  errorTitle: 'Něco se pokazilo',
  errorRetry: 'Zkusit znovu',
  errorReset: 'Smazat místní data',
  errorResetHint: 'Pokud se to opakuje, smazání místních dat aplikaci obnoví do čistého stavu.',

  today: 'dnes',
  yesterday: 'včera',
  daysAgo: 'před {n} dny',
  monthAgo: 'před měsícem',
  monthsAgo: 'před {n} měsíci',

  tabHarvest: 'Sklizeň',
  tabDex: 'Jablkodex',
  actPick: 'Trhám',
  actAdd: 'Přidat',
  actRoute: 'Trasa',
  actDistrict: 'Čtvrť',
  actArea: 'Oblast',
  zoomIn: 'Přiblížit',
  zoomOut: 'Oddálit',
  locateMe: 'Zpět na mě',
  cycleScale: 'Změnit úroveň přiblížení',

  cardNoTree: 'Žádný strom do {r} m',
  cardNoTreeSub: 'Stojí tu jeden? Přidejte ho tlačítkem Přidat.',
  cardInView: '{n, plural, one {# strom} few {# stromy} other {# stromů}} v dohledu',
  cardBreak:
    '{ripe, plural, one {# zralý} few {# zralé} other {# zralých}} · {unripe, plural, one {# nezralý} few {# nezralé} other {# nezralých}} · {none} bez hlášení',
  cardBest: 'Nejvíc zralého: {name}',
  cardBestNearby: 'Nejvíc zralého poblíž',
  cardBestSubNoLocation:
    '{n, plural, one {# strom} few {# stromy} other {# stromů}} · vzdálenost neznámá',
  cardBestSub: '{n, plural, one {# strom} few {# stromy} other {# stromů}} · {d} · {t} pěšky',
  cardRegion: 'Praha a Střední Čechy',
  cardRegionSub:
    '{n, plural, one {# strom} few {# stromy} other {# stromů}} · {r, plural, one {# zralý} few {# zralé} other {# zralých}} právě teď',
  cardReport: 'Nahlásit',
  addFavorite: 'Přidat do oblíbených',
  removeFavorite: 'Odebrat z oblíbených',
  removePhoto: 'Odebrat fotku',
  dismiss: 'Zavřít',
  metresAway: '{n} m od vás',
  densityLegend: 'STROMŮ / KM²',
  seasonSixMonths: 'Hlášení zralosti za posledních šest měsíců',

  toastPick: 'Sklizeno · +25 XP',
  toastTree: 'Strom je na mapě · +40 XP',
  toastReport: 'Nahlášeno · +15 XP',
  toastQuest: 'Úkol týdne splněn · +150 XP',
  toastRoute: 'Trasa k {name} · {d}',
  toastDex: 'Nová odrůda: {name}',
  toastDistrict: 'Kamera přeletěla na {name}',
  toastArea: 'Vybrána oblast s nejvyšší hustotou',
  toastNothingNear: 'Žádný strom dost blízko na trhání',
  toastNoRoute: 'Trasu se teď nepodařilo najít',
  toastSignIn: 'Přispívat můžete po přihlášení v Profilu',

  harvestTitle: 'Sklizeň',
  filterNear: 'Do 2 km',
  nearYou: 'Blízko vás',
  harvestEmpty: 'Tomuto filtru zatím nic neodpovídá — zkuste některý vypnout.',
  needLocationForList: 'Povolte polohu a seznam se seřadí podle vzdálenosti.',

  dexTitle: 'Jablkodex',
  dexSubtitle: '{n} z {total} odrůd nalezeno',
  level: 'Úroveň {n} · Sběrač',
  xpProgress: '{xp} / {max} XP',
  questLabel: 'ÚKOL TÝDNE',
  questTitle: 'Nahlas zralost u 3 stromů',
  questReward: '+150 XP',
  questHint: 'Nový úkol v pondělí',
  questDone: 'Splněno — nový úkol v pondělí',
  streakLabel: '{n, plural, one {# den} few {# dny} other {# dní}} v řadě',
  varieties: 'Odrůdy',
  notFound: 'Nenalezeno',

  placedHere: 'Špendík padne tam, kde právě stojíte.',
  saveReward: 'Za nový strom získáte 40 XP',

  railSideLabel: 'STRANA LIŠTY',
  railRight: 'Vpravo',
  railLeft: 'Vlevo',
  railSideHint: 'Na kterém okraji stojí ovládací lišta — dejte si ji pod palec.',

  months: ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'],
  days: ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'],
};

export type Lang = 'cs' | 'en';
/** 'auto' follows the device language. */
export type LangPreference = Lang | 'auto';

const LANG_KEY = 'jabkozdarma-lang';

function isLang(v: unknown): v is Lang {
  return v === 'cs' || v === 'en';
}

/** Saved preference, read synchronously so the first render is correct. */
export function getLangPreference(): LangPreference {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const stored = window.localStorage?.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  }
  return 'auto';
}

function detectLang(): Lang {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // ?lang= wins, so a shared link can pin the language
    const param = new URLSearchParams(window.location.search).get('lang');
    if (isLang(param)) return param;
    const stored = window.localStorage?.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  }
  return getLocales()[0]?.languageCode === 'cs' ? 'cs' : 'en';
}

export const lang: Lang = detectLang();
const dict = lang === 'cs' ? cs : en;

/**
 * Save the choice and re-open the app so every label is rebuilt. Strings are
 * resolved once at module load, so a reload is the honest way to apply it.
 */
export function setLangPreference(pref: LangPreference): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (pref === 'auto') window.localStorage?.removeItem(LANG_KEY);
  else window.localStorage?.setItem(LANG_KEY, pref);
  // drop any ?lang= override so the saved choice actually takes effect
  const url = new URL(window.location.href);
  url.searchParams.delete('lang');
  window.location.replace(url.toString());
}

type StringKey = {
  [K in keyof typeof en]: (typeof en)[K] extends string ? K : never;
}[keyof typeof en];

/**
 * Which plural branch a count takes. Czech needs three: `strom` for one,
 * `stromy` for two through four, `stromů` for everything else — including
 * zero. English collapses `few` into `other`.
 */
function pluralForm(n: number): 'one' | 'few' | 'other' {
  if (n === 1) return 'one';
  if (lang === 'cs' && n >= 2 && n <= 4) return 'few';
  return 'other';
}

/** Translate, filling {placeholders}. Handles the plural forms we need. */
export function t(key: StringKey, params?: Record<string, string | number>): string {
  let s = dict[key];
  if (params) {
    // minimal ICU-ish plural: {count, plural, one {...} few {...} other {...}}
    // — `few` is optional, and falls back to `other` when a string omits it.
    s = s.replace(
      /\{(\w+), plural, one \{([^}]*)\}(?: few \{([^}]*)\})? other \{([^}]*)\}\}/g,
      (_, name, one, few, other) => {
        const n = Number(params[name] ?? 0);
        const form = pluralForm(n);
        const chosen = form === 'one' ? one : form === 'few' ? (few ?? other) : other;
        return chosen.replaceAll('#', String(n));
      }
    );
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
  }
  return s;
}

export function monthShort(m: number): string {
  return dict.months[m - 1] ?? '';
}

/** Short weekday name, Monday-first — the order the streak row reads in. */
export function dayShort(i: number): string {
  return dict.days[i] ?? '';
}

/** 1.2 km with a decimal comma in Czech. */
export function formatKm(km: number): string {
  const value = km >= 10 ? String(Math.round(km)) : km.toFixed(1);
  return `${lang === 'cs' ? value.replace('.', ',') : value} km`;
}
