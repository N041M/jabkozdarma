import { lang } from './i18n';

export interface PrivacySection {
  heading: string;
  body: string[];
}

/**
 * Plain-language privacy notice (GDPR arts. 13–14). Kept as content rather
 * than i18n keys because it's long prose, not UI labels.
 *
 * NOTE FOR THE OPERATOR: fill in a contact address below before launch, and
 * confirm the Supabase project region really is in the EU.
 */
const en: PrivacySection[] = [
  {
    heading: 'The short version',
    body: [
      'You can browse the whole map without an account and without giving us anything. We ask for data only when you contribute: an email address to sign in, a username shown next to your pins, and the trees, reports and photos you choose to add.',
      'We run no advertising, no analytics and no third-party trackers. Nothing is sold or shared for marketing.',
    ],
  },
  {
    heading: 'What we store, and why',
    body: [
      'Email address — so you can sign in and get back into your account. Legal basis: performance of the contract (providing the service). Visible only to you and the operator, never shown publicly.',
      'Username — shown publicly next to trees and reports you add, so the community can see who contributed. Choose a nickname if you prefer not to use your real name; you can change it any time on this screen.',
      'Trees, ripeness reports, flags, favourites — the content of the service. Pins and reports are public; favourites are private to you.',
      'Photos you upload — public, attached to the tree. They are resized in your browser before upload, which removes camera metadata such as GPS coordinates from the original file.',
      'Your location — used on your device to centre the map, draw walking routes and check that a new pin is near you. It is never stored on our servers or attached to your profile.',
    ],
  },
  {
    heading: 'Where the data lives',
    body: [
      'The database and photo storage are provided by Supabase, hosted in the European Union.',
      'The site itself is served by GitHub Pages, which receives your IP address as part of delivering the page.',
      'Map tiles come from OpenFreeMap (OpenStreetMap data) and walking routes from the FOSSGIS OSRM service. When the map loads or you request a route, those services receive your IP address, and the route service receives the two coordinates of that route. They do not receive your account details.',
      'If you sign in with Google, Google handles that sign-in and tells us your email address and display name.',
    ],
  },
  {
    heading: 'How long we keep it',
    body: [
      'Your account and contributions are kept until you delete them. Deleting your account removes your profile, your email address, and the trees, reports, flags and favourites attached to it.',
      'Note that deleting your account also removes the pins you contributed, so the community loses them. If you would rather keep the map intact, delete individual pins first or leave them in place.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Under the GDPR you may access, correct, export, or erase your data, restrict or object to processing, and complain to a supervisory authority (in Czechia, the Úřad pro ochranu osobních údajů).',
      'Access and portability: use "Download my data" on this screen to get everything in your account as a JSON file.',
      'Correction: change your username on this screen; edit or delete your pins from their pages.',
      'Erasure: use "Delete my account" on this screen. It takes effect immediately.',
    ],
  },
  {
    heading: 'Storage on your device',
    body: [
      'The app stores your sign-in session, your language and map preferences, and a cached copy of the map data on your device. This is strictly necessary to make the app work, so no cookie banner is shown. There are no advertising or analytics cookies.',
    ],
  },
  {
    heading: 'Children',
    body: ['The service is not aimed at children under 16.'],
  },
  {
    heading: 'Contact',
    body: [
      'For any data question, or to exercise a right you cannot complete in the app, contact the operator of this site.',
    ],
  },
];

const cs: PrivacySection[] = [
  {
    heading: 'Stručně',
    body: [
      'Celou mapu si můžete prohlížet bez účtu a bez toho, abyste nám cokoli sdělili. Údaje potřebujeme, až když chcete přispívat: e-mail pro přihlášení, uživatelské jméno zobrazené u vašich špendlíků a stromy, hlášení a fotky, které sami přidáte.',
      'Neprovozujeme reklamu, analytiku ani sledovací nástroje třetích stran. Nic neprodáváme ani nesdílíme pro marketing.',
    ],
  },
  {
    heading: 'Co ukládáme a proč',
    body: [
      'E-mailová adresa — abyste se mohli přihlásit a vrátit ke svému účtu. Právní základ: plnění smlouvy (poskytování služby). Vidíte ji jen vy a provozovatel, veřejně se nezobrazuje.',
      'Uživatelské jméno — zobrazuje se veřejně u stromů a hlášení, které přidáte, aby bylo vidět, kdo přispěl. Můžete použít přezdívku; jméno lze kdykoli změnit na této obrazovce.',
      'Stromy, hlášení zralosti, nahlášené problémy, oblíbené — samotný obsah služby. Špendlíky a hlášení jsou veřejné, oblíbené jsou soukromé.',
      'Nahrané fotky — veřejné, připojené ke stromu. Před nahráním se ve vašem prohlížeči zmenší, čímž se z původního souboru odstraní metadata fotoaparátu včetně GPS souřadnic.',
      'Vaše poloha — používá se ve vašem zařízení k vycentrování mapy, vykreslení trasy pěšky a ověření, že nový špendlík přidáváte poblíž sebe. Neukládáme ji na server ani ji nepřipojujeme k profilu.',
    ],
  },
  {
    heading: 'Kde data leží',
    body: [
      'Databázi a úložiště fotek zajišťuje Supabase s provozem v Evropské unii.',
      'Samotné stránky servíruje GitHub Pages, který při doručení stránky obdrží vaši IP adresu.',
      'Mapové dlaždice poskytuje OpenFreeMap (data OpenStreetMap) a trasy pěšky služba FOSSGIS OSRM. Při načtení mapy nebo výpočtu trasy tyto služby obdrží vaši IP adresu a služba tras dva body dané trasy. Údaje o vašem účtu nedostávají.',
      'Pokud se přihlásíte přes Google, přihlášení zpracovává Google a předá nám vaši e-mailovou adresu a zobrazované jméno.',
    ],
  },
  {
    heading: 'Jak dlouho data uchováváme',
    body: [
      'Účet a příspěvky uchováváme, dokud je nesmažete. Smazání účtu odstraní profil, e-mailovou adresu i stromy, hlášení a oblíbené, které k němu patří.',
      'Pozor: smazáním účtu zmizí i špendlíky, které jste přidali, takže o ně komunita přijde. Pokud chcete mapu zachovat, smažte raději jednotlivé špendlíky, nebo je nechte být.',
    ],
  },
  {
    heading: 'Vaše práva',
    body: [
      'Podle GDPR máte právo na přístup, opravu, přenositelnost i výmaz svých údajů, na omezení zpracování či námitku a na stížnost u dozorového úřadu (v ČR Úřad pro ochranu osobních údajů).',
      'Přístup a přenositelnost: tlačítkem „Stáhnout moje data“ na této obrazovce získáte vše ze svého účtu jako soubor JSON.',
      'Oprava: uživatelské jméno změníte na této obrazovce, špendlíky upravíte nebo smažete na jejich stránce.',
      'Výmaz: tlačítko „Smazat účet“ na této obrazovce. Provede se okamžitě.',
    ],
  },
  {
    heading: 'Úložiště ve vašem zařízení',
    body: [
      'Aplikace si ve vašem zařízení ukládá přihlášení, jazyk a nastavení mapy a kopii mapových dat. To je nezbytné pro fungování aplikace, proto nezobrazujeme cookie lištu. Žádné reklamní ani analytické cookies nepoužíváme.',
    ],
  },
  {
    heading: 'Děti',
    body: ['Služba není určena dětem mladším 16 let.'],
  },
  {
    heading: 'Kontakt',
    body: [
      'S jakýmkoli dotazem k údajům, nebo pokud chcete uplatnit právo, které nelze vyřídit v aplikaci, se obraťte na provozovatele těchto stránek.',
    ],
  },
];

export const privacySections: PrivacySection[] = lang === 'cs' ? cs : en;
