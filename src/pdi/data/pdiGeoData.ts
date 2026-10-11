export interface PdiCountryConfig {
  code: string; // ISO 2 (ex: "DZ", "FR")
  name: string; // "Algérie", "France"
  flag: string; // "🇩🇿"
  phoneCode: string; // "+213"
  currency: "DZD" | "EUR" | "USD";
  currencySymbol: string; // "DZD", "€", "$"
  paymentGateway: "slickpay_baridimob" | "paddle";
  allowed: boolean; // Whitelist flag: true = visible in register, false = in excluded section
  defaultCities: string[];
}

export const PDI_DEFAULT_COUNTRIES: PdiCountryConfig[] = [
  {
    code: "DZ",
    name: "Algérie",
    flag: "🇩🇿",
    phoneCode: "+213",
    currency: "DZD",
    currencySymbol: "DZD",
    paymentGateway: "slickpay_baridimob",
    allowed: true,
    defaultCities: [
      "01 - Adrar", "02 - Chlef", "03 - Laghouat", "04 - Oum El Bouaghi", "05 - Batna",
      "06 - Béjaïa", "07 - Biskra", "08 - Béchar", "09 - Blida", "10 - Bouira",
      "11 - Tamanrasset", "12 - Tébessa", "13 - Tlemcen", "14 - Tiaret", "15 - Tizi Ouzou",
      "16 - Alger", "17 - Djelfa", "18 - Jijel", "19 - Sétif", "20 - Saïda",
      "21 - Skikda", "22 - Sidi Bel Abbès", "23 - Annaba", "24 - Guelma", "25 - Constantine",
      "26 - Médéa", "27 - Mostaganem", "28 - M'Sila", "29 - Mascara", "30 - Ouargla",
      "31 - Oran", "32 - El Bayadh", "33 - Illizi", "34 - Bordj Bou Arreridj", "35 - Boumerdès",
      "36 - El Tarf", "37 - Tindouf", "38 - Tissemsilt", "39 - El Oued", "40 - Khenchela",
      "41 - Souk Ahras", "42 - Tipaza", "43 - Mila", "44 - Aïn Defla", "45 - Naâma",
      "46 - Aïn Témouchent", "47 - Ghardaïa", "48 - Relizane", "49 - Timimoun", "50 - Bordj Badji Mokhtar",
      "51 - Ouled Djellal", "52 - Béni Abbès", "53 - In Salah", "54 - In Guezzam", "55 - Touggourt",
      "56 - Djanet", "57 - El M'Ghair", "58 - El Meniaa", "Hassi Messaoud (Base Pétrolière)", "Hassi R'Mel (Pôle Gazier)", "Skikda Zone Industrielle", "Arzew Zone Pétrochimique"
    ]
  },
  {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    phoneCode: "+33",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Paris", "Lyon", "Marseille", "Toulouse", "Nice", "Nantes", "Strasbourg", 
      "Montpellier", "Bordeaux", "Lille", "Rennes", "Toulon", "Reims", "Saint-Étienne", 
      "Le Havre", "Grenoble", "Dijon", "Angers", "Nîmes", "Villeurbanne", "Aix-en-Provence", "Autre ville..."
    ]
  },
  {
    code: "MA",
    name: "Maroc",
    flag: "🇲🇦",
    phoneCode: "+212",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Casablanca", "Rabat", "Fès", "Tanger", "Marrakech", "Agadir", "Meknès", 
      "Oujda", "Kenitra", "Tétouan", "Safi", "Mohammédia", "El Jadida", "Nador", "Autre ville..."
    ]
  },
  {
    code: "TN",
    name: "Tunisie",
    flag: "🇹🇳",
    phoneCode: "+216",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Tunis", "Sfax", "Sousse", "Bizerte", "Gabès", "Ariana", "Kairouan", 
      "Gafsa", "Monastir", "Ben Arous", "La Marsa", "Nabeul", "Autre ville..."
    ]
  },
  {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    phoneCode: "+1",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Montréal", "Québec", "Toronto", "Vancouver", "Calgary", "Ottawa", "Edmonton", 
      "Winnipeg", "Halifax", "Laval", "Gatineau", "Autre ville..."
    ]
  },
  {
    code: "BE",
    name: "Belgique",
    flag: "🇧🇪",
    phoneCode: "+32",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Bruxelles", "Anvers", "Gand", "Charleroi", "Liège", "Bruges", "Namur", 
      "Mons", "Louvain", "Tournai", "Autre ville..."
    ]
  },
  {
    code: "CH",
    name: "Suisse",
    flag: "🇨🇭",
    phoneCode: "+41",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Genève", "Zurich", "Lausanne", "Bâle", "Berne", "Lucerne", "Lugano", "Fribourg", "Neuchâtel", "Autre ville..."
    ]
  },
  {
    code: "SA",
    name: "Arabie Saoudite",
    flag: "🇸🇦",
    phoneCode: "+966",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Riyad", "Djeddah", "La Mecque", "Médine", "Dammam", "Khobar", "Dhahran (Aramco Hub)", "Jubail Industrial", "Yanbu", "Autre ville..."
    ]
  },
  {
    code: "AE",
    name: "Émirats Arabes Unis",
    flag: "🇦🇪",
    phoneCode: "+971",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Dubaï", "Abou Dabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Ruwais Hub", "Autre ville..."
    ]
  },
  {
    code: "QA",
    name: "Qatar",
    flag: "🇶🇦",
    phoneCode: "+974",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Doha", "Al Rayyan", "Al Wakrah", "Al Khor", "Ras Laffan Industrial", "Mesaieed", "Autre ville..."
    ]
  },
  {
    code: "DE",
    name: "Allemagne",
    flag: "🇩🇪",
    phoneCode: "+49",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Berlin", "Munich", "Francfort", "Hambourg", "Cologne", "Stuttgart", "Düsseldorf", "Leipzig", "Dortmund", "Autre ville..."
    ]
  },
  {
    code: "GB",
    name: "Royaume-Uni",
    flag: "🇬🇧",
    phoneCode: "+44",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Londres", "Manchester", "Birmingham", "Édimbourg", "Glasgow", "Bristol", "Liverpool", "Leeds", "Aberdeen (Oil & Gas Hub)", "Autre ville..."
    ]
  },
  {
    code: "US",
    name: "États-Unis",
    flag: "🇺🇸",
    phoneCode: "+1",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Houston (Piping & Energy Capital)", "New York", "Chicago", "Los Angeles", "Dallas", "Atlanta", "San Francisco", "Denver", "Seattle", "Autre ville..."
    ]
  },
  {
    code: "IT",
    name: "Italie",
    flag: "🇮🇹",
    phoneCode: "+39",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Rome", "Milan", "Naples", "Turin", "Palerme", "Gênes", "Bologne", "Florence", "Venise", "Autre ville..."
    ]
  },
  {
    code: "ES",
    name: "Espagne",
    flag: "🇪🇸",
    phoneCode: "+34",
    currency: "EUR",
    currencySymbol: "€",
    paymentGateway: "paddle",
    allowed: true,
    defaultCities: [
      "Madrid", "Barcelone", "Valence", "Séville", "Saragosse", "Malaga", "Bilbao", "Alicante", "Autre ville..."
    ]
  },
  // Excluded by default examples to demonstrate the Admin Whitelist / Blacklist toggle functionality
  {
    code: "KP",
    name: "Corée du Nord",
    flag: "🇰🇵",
    phoneCode: "+850",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: false, // Excluded
    defaultCities: ["Pyongyang", "Autre ville..."]
  },
  {
    code: "IR",
    name: "Iran",
    flag: "🇮🇷",
    phoneCode: "+98",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: false, // Excluded
    defaultCities: ["Téhéran", "Machhad", "Ispahan", "Autre ville..."]
  },
  {
    code: "SY",
    name: "Syrie",
    flag: "🇸🇾",
    phoneCode: "+963",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: false, // Excluded
    defaultCities: ["Damas", "Alep", "Homs", "Autre ville..."]
  },
  {
    code: "CU",
    name: "Cuba",
    flag: "🇨🇺",
    phoneCode: "+53",
    currency: "USD",
    currencySymbol: "$",
    paymentGateway: "paddle",
    allowed: false, // Excluded
    defaultCities: ["La Havane", "Santiago de Cuba", "Autre ville..."]
  }
];
