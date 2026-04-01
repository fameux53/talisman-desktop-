// Talisman — Complete Haitian Market Product Catalog
// Source: Research across Croix-des-Bossales, Marché en Fer, Pétionville market,
// Haitian boutik system, madan sara supply chains, and diaspora grocery stores.
// ~120 products across 15 categories covering what real machann sell daily.

export interface CatalogProduct {
  id: string;
  nameHT: string;
  nameFR: string;
  nameEN: string;
  emoji: string;
  category: string;
  unit: string;
  suggestedPrice: number; // in Haitian Gourdes (HTG)
  supplier?: string;
  sizes?: Record<string, number>;
}

export interface CatalogCategory {
  id: string;
  labelHT: string;
  labelFR: string;
  labelEN: string;
  emoji: string;
}

export const CATEGORIES: CatalogCategory[] = [
  { id: 'grains', labelHT: 'Sereyal & Grenn', labelFR: 'Céréales & Grains', labelEN: 'Grains & Cereals', emoji: '🌾' },
  { id: 'legumes', labelHT: 'Pwa & Legiminez', labelFR: 'Légumineuses', labelEN: 'Beans & Legumes', emoji: '🫘' },
  { id: 'oils', labelHT: 'Lwil & Grès', labelFR: 'Huiles & Graisses', labelEN: 'Oils & Fats', emoji: '🫒' },
  { id: 'produce', labelHT: 'Legim & Fèy', labelFR: 'Légumes & Feuilles', labelEN: 'Vegetables & Greens', emoji: '🥬' },
  { id: 'fruits', labelHT: 'Fwi', labelFR: 'Fruits', labelEN: 'Fruits', emoji: '🥭' },
  { id: 'roots', labelHT: 'Rasin & Viv', labelFR: 'Racines & Tubercules', labelEN: 'Roots & Tubers', emoji: '🍠' },
  { id: 'proteins', labelHT: 'Vyann & Pwason', labelFR: 'Viande & Poisson', labelEN: 'Meat & Fish', emoji: '🍖' },
  { id: 'dairy', labelHT: 'Lèt & Ze', labelFR: 'Produits Laitiers & Oeufs', labelEN: 'Dairy & Eggs', emoji: '🥚' },
  { id: 'drinks', labelHT: 'Bwason', labelFR: 'Boissons', labelEN: 'Beverages', emoji: '🥤' },
  { id: 'spices', labelHT: 'Epis & Kondiman', labelFR: 'Épices & Condiments', labelEN: 'Spices & Condiments', emoji: '🧂' },
  { id: 'prepared', labelHT: 'Manje Prepare & Goute', labelFR: 'Plats Préparés & Snacks', labelEN: 'Prepared Food & Snacks', emoji: '🍽️' },
  { id: 'household', labelHT: 'Pwodwi Kay', labelFR: 'Produits Ménagers', labelEN: 'Household Products', emoji: '🧹' },
  { id: 'hygiene', labelHT: 'Ijyèn & Bote', labelFR: 'Hygiène & Beauté', labelEN: 'Hygiene & Beauty', emoji: '🧴' },
  { id: 'tobacco', labelHT: 'Tabak & Diven', labelFR: 'Tabac & Divers', labelEN: 'Tobacco & Misc', emoji: '🚬' },
  { id: 'hardware', labelHT: 'Zouti & Ekipman', labelFR: 'Outils & Équipement', labelEN: 'Tools & Hardware', emoji: '🔧' },
  { id: 'alcohol', labelHT: 'Bwason Alkòl', labelFR: 'Boissons Alcoolisées', labelEN: 'Alcoholic Beverages', emoji: '🥃' },
  { id: 'raw_materials', labelHT: 'Matyè Premyè & Reyaktif', labelFR: 'Matières Premières & Réactifs', labelEN: 'Raw Materials & Chemicals', emoji: '🧪' },
  { id: 'fragrances', labelHT: 'Pafen & Fragrans', labelFR: 'Parfums & Fragrances', labelEN: 'Fragrances & Scents', emoji: '🌸' },
];

export const STARTER_PRODUCTS: CatalogProduct[] = [

  // ═══════════════════════════════════════════
  // 🌾 GRAINS & CEREALS (Sereyal & Grenn)
  // ═══════════════════════════════════════════
  { id: 'diri-blan', nameHT: 'Diri blan', nameFR: 'Riz blanc', nameEN: 'White rice', emoji: '🍚', category: 'grains', unit: 'mamit', suggestedPrice: 250 },
  { id: 'diri-lokal', nameHT: 'Diri lokal', nameFR: 'Riz local', nameEN: 'Local rice', emoji: '🍚', category: 'grains', unit: 'mamit', suggestedPrice: 200 },
  { id: 'diri-djondjn', nameHT: 'Djon djon (chanpyon nwa)', nameFR: 'Champignons noirs (djon djon)', nameEN: 'Black mushrooms (djon djon)', emoji: '🍄', category: 'grains', unit: 'mamit', suggestedPrice: 500 },
  { id: 'mayi-moulen', nameHT: 'Mayi moulen', nameFR: 'Maïs moulu', nameEN: 'Ground corn / cornmeal', emoji: '🌽', category: 'grains', unit: 'mamit', suggestedPrice: 150 },
  { id: 'mayi-griye', nameHT: 'Mayi griye', nameFR: 'Maïs grillé', nameEN: 'Roasted corn', emoji: '🌽', category: 'grains', unit: 'pyès', suggestedPrice: 25 },
  { id: 'pitimi', nameHT: 'Pitimi', nameFR: 'Millet', nameEN: 'Millet', emoji: '🌾', category: 'grains', unit: 'mamit', suggestedPrice: 200 },
  { id: 'farin-ble', nameHT: 'Farin ble', nameFR: 'Farine de blé', nameEN: 'Wheat flour', emoji: '🌾', category: 'grains', unit: 'sak', suggestedPrice: 350 },
  { id: 'farin-mayi', nameHT: 'Farin mayi', nameFR: 'Farine de maïs', nameEN: 'Corn flour', emoji: '🌽', category: 'grains', unit: 'sak', suggestedPrice: 300 },
  { id: 'espageti', nameHT: 'Espageti', nameFR: 'Spaghetti', nameEN: 'Spaghetti', emoji: '🍝', category: 'grains', unit: 'pakèt', suggestedPrice: 75 },
  { id: 'makaroni', nameHT: 'Makaroni', nameFR: 'Macaroni', nameEN: 'Macaroni', emoji: '🍝', category: 'grains', unit: 'pakèt', suggestedPrice: 75 },
  { id: 'pen', nameHT: 'Pen', nameFR: 'Pain', nameEN: 'Bread', emoji: '🍞', category: 'grains', unit: 'pyès', suggestedPrice: 25 },
  { id: 'pen-long', nameHT: 'Pen long', nameFR: 'Baguette', nameEN: 'Long bread / baguette', emoji: '🥖', category: 'grains', unit: 'pyès', suggestedPrice: 50 },
  { id: 'kasav', nameHT: 'Kasav', nameFR: 'Cassave', nameEN: 'Cassava bread', emoji: '🫓', category: 'grains', unit: 'pyès', suggestedPrice: 50 },
  { id: 'bonbon-amidon', nameHT: 'Bonbon amidon', nameFR: 'Bonbon amidon', nameEN: 'Starch cookies', emoji: '🍪', category: 'grains', unit: 'pakèt', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🫘 BEANS & LEGUMES (Pwa & Legiminez)
  // ═══════════════════════════════════════════
  { id: 'pwa-wouj', nameHT: 'Pwa wouj', nameFR: 'Haricots rouges', nameEN: 'Red kidney beans', emoji: '🫘', category: 'legumes', unit: 'mamit', suggestedPrice: 300 },
  { id: 'pwa-nwa', nameHT: 'Pwa nwa', nameFR: 'Haricots noirs', nameEN: 'Black beans', emoji: '🫘', category: 'legumes', unit: 'mamit', suggestedPrice: 325 },
  { id: 'pwa-blan', nameHT: 'Pwa blan', nameFR: 'Haricots blancs', nameEN: 'White beans', emoji: '🫘', category: 'legumes', unit: 'mamit', suggestedPrice: 300 },
  { id: 'pwa-kongo', nameHT: 'Pwa kongo', nameFR: 'Pois congo (pigeon peas)', nameEN: 'Pigeon peas', emoji: '🫘', category: 'legumes', unit: 'mamit', suggestedPrice: 275 },
  { id: 'pwa-vet', nameHT: 'Pwa vèt', nameFR: 'Petits pois', nameEN: 'Green peas', emoji: '🫛', category: 'legumes', unit: 'mamit', suggestedPrice: 250 },
  { id: 'lantiy', nameHT: 'Lantiy', nameFR: 'Lentilles', nameEN: 'Lentils', emoji: '🫘', category: 'legumes', unit: 'mamit', suggestedPrice: 275 },
  { id: 'pistach', nameHT: 'Pistach (arachid)', nameFR: 'Arachides', nameEN: 'Peanuts', emoji: '🥜', category: 'legumes', unit: 'mamit', suggestedPrice: 200 },
  { id: 'pistach-griye', nameHT: 'Pistach griye', nameFR: 'Arachides grillées', nameEN: 'Roasted peanuts', emoji: '🥜', category: 'legumes', unit: 'ti sak', suggestedPrice: 50 },
  { id: 'manba', nameHT: 'Manba (bè pistach)', nameFR: 'Beurre d\'arachide', nameEN: 'Peanut butter', emoji: '🥜', category: 'legumes', unit: 'boutèy', suggestedPrice: 150 },

  // ═══════════════════════════════════════════
  // 🛢️ OILS & FATS (Lwil & Grès)
  // ═══════════════════════════════════════════
  { id: 'lwil-kizin', nameHT: 'Lwil kizin', nameFR: 'Huile de cuisine', nameEN: 'Cooking oil', emoji: '🍶', category: 'oils', unit: 'boutèy', suggestedPrice: 200 },
  { id: 'lwil-oliv', nameHT: 'Lwil doliv', nameFR: 'Huile d\'olive', nameEN: 'Olive oil', emoji: '🫒', category: 'oils', unit: 'boutèy', suggestedPrice: 350 },
  { id: 'lwil-maskreti', nameHT: 'Lwil maskreti', nameFR: 'Huile de ricin', nameEN: 'Castor oil', emoji: '🍶', category: 'oils', unit: 'boutèy', suggestedPrice: 150 },
  { id: 'lwil-kokoye', nameHT: 'Lwil kokoye', nameFR: 'Huile de coco', nameEN: 'Coconut oil', emoji: '🥥', category: 'oils', unit: 'boutèy', suggestedPrice: 175 },
  { id: 'mantèg', nameHT: 'Mantèg', nameFR: 'Margarine / beurre', nameEN: 'Butter / margarine', emoji: '🧈', category: 'oils', unit: 'pyès', suggestedPrice: 100 },
  { id: 'saindou', nameHT: 'Saindou', nameFR: 'Saindoux', nameEN: 'Lard', emoji: '🧈', category: 'oils', unit: 'liv', suggestedPrice: 125 },

  // ═══════════════════════════════════════════
  // 🥬 VEGETABLES & GREENS (Legim & Fèy)
  // ═══════════════════════════════════════════
  { id: 'tomat', nameHT: 'Tomat', nameFR: 'Tomate', nameEN: 'Tomato', emoji: '🍅', category: 'produce', unit: 'liv', suggestedPrice: 75 },
  { id: 'zonyon', nameHT: 'Zonyon', nameFR: 'Oignon', nameEN: 'Onion', emoji: '🧅', category: 'produce', unit: 'liv', suggestedPrice: 60 },
  { id: 'lay', nameHT: 'Lay', nameFR: 'Ail', nameEN: 'Garlic', emoji: '🧄', category: 'produce', unit: 'tèt', suggestedPrice: 25 },
  { id: 'piman-bouk', nameHT: 'Piman bouk', nameFR: 'Piment habanero', nameEN: 'Scotch bonnet pepper', emoji: '🫑', category: 'produce', unit: 'liv', suggestedPrice: 100 },
  { id: 'piman-dous', nameHT: 'Piman dous', nameFR: 'Poivron', nameEN: 'Bell pepper', emoji: '🫑', category: 'produce', unit: 'liv', suggestedPrice: 80 },
  { id: 'chou', nameHT: 'Chou', nameFR: 'Chou', nameEN: 'Cabbage', emoji: '🥬', category: 'produce', unit: 'pyès', suggestedPrice: 50 },
  { id: 'kawot', nameHT: 'Kawòt', nameFR: 'Carotte', nameEN: 'Carrot', emoji: '🥕', category: 'produce', unit: 'liv', suggestedPrice: 50 },
  { id: 'berejèn', nameHT: 'Berejèn', nameFR: 'Aubergine', nameEN: 'Eggplant', emoji: '🍆', category: 'produce', unit: 'pyès', suggestedPrice: 30 },
  { id: 'mirliton', nameHT: 'Mirliton', nameFR: 'Chayote', nameEN: 'Chayote squash', emoji: '🥒', category: 'produce', unit: 'pyès', suggestedPrice: 25 },
  { id: 'kalalou', nameHT: 'Kalalou (okra)', nameFR: 'Gombo', nameEN: 'Okra', emoji: '🥒', category: 'produce', unit: 'liv', suggestedPrice: 75 },
  { id: 'epina', nameHT: 'Zepina', nameFR: 'Épinards', nameEN: 'Spinach', emoji: '🥬', category: 'produce', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'lalo', nameHT: 'Lalo (jute)', nameFR: 'Feuilles de jute', nameEN: 'Jute leaves (lalo)', emoji: '🌿', category: 'produce', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'watercress', nameHT: 'Kreson', nameFR: 'Cresson', nameEN: 'Watercress', emoji: '🌿', category: 'produce', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'pèsi', nameHT: 'Pèsi', nameFR: 'Persil', nameEN: 'Parsley', emoji: '🌿', category: 'produce', unit: 'pakèt', suggestedPrice: 15 },
  { id: 'seleri', nameHT: 'Sèlri', nameFR: 'Céleri', nameEN: 'Celery', emoji: '🌿', category: 'produce', unit: 'pakèt', suggestedPrice: 20 },

  // ═══════════════════════════════════════════
  // 🥭 FRUITS (Fwi)
  // ═══════════════════════════════════════════
  { id: 'bannann-jaun', nameHT: 'Bannann jaune (myri)', nameFR: 'Banane mûre', nameEN: 'Ripe banana', emoji: '🍌', category: 'fruits', unit: 'rejim', suggestedPrice: 75 },
  { id: 'bannann-vèt', nameHT: 'Bannann vèt (plantain)', nameFR: 'Banane plantain', nameEN: 'Green plantain', emoji: '🍌', category: 'fruits', unit: 'rejim', suggestedPrice: 100 },
  { id: 'mango', nameHT: 'Mango', nameFR: 'Mangue', nameEN: 'Mango', emoji: '🥭', category: 'fruits', unit: 'pyès', suggestedPrice: 25 },
  { id: 'mango-fransik', nameHT: 'Mango fransik', nameFR: 'Mangue Francique', nameEN: 'Francique mango', emoji: '🥭', category: 'fruits', unit: 'pyès', suggestedPrice: 50 },
  { id: 'zaboka', nameHT: 'Zaboka', nameFR: 'Avocat', nameEN: 'Avocado', emoji: '🥑', category: 'fruits', unit: 'pyès', suggestedPrice: 50 },
  { id: 'sitron', nameHT: 'Sitron', nameFR: 'Citron vert', nameEN: 'Lime', emoji: '🍋', category: 'fruits', unit: 'douzèn', suggestedPrice: 100 },
  { id: 'zoranj', nameHT: 'Zoranj', nameFR: 'Orange', nameEN: 'Orange', emoji: '🍊', category: 'fruits', unit: 'douzèn', suggestedPrice: 100 },
  { id: 'grenadia', nameHT: 'Grenadia', nameFR: 'Fruit de la passion', nameEN: 'Passion fruit', emoji: '🟡', category: 'fruits', unit: 'pyès', suggestedPrice: 15 },
  { id: 'korosol', nameHT: 'Kowosòl', nameFR: 'Corossol', nameEN: 'Soursop', emoji: '🍈', category: 'fruits', unit: 'pyès', suggestedPrice: 75 },
  { id: 'papay', nameHT: 'Papay', nameFR: 'Papaye', nameEN: 'Papaya', emoji: '🟠', category: 'fruits', unit: 'pyès', suggestedPrice: 50 },
  { id: 'kokoye', nameHT: 'Kokoye', nameFR: 'Noix de coco', nameEN: 'Coconut', emoji: '🥥', category: 'fruits', unit: 'pyès', suggestedPrice: 30 },
  { id: 'yanm-frans', nameHT: 'Chadèk', nameFR: 'Pamplemousse', nameEN: 'Grapefruit', emoji: '🟡', category: 'fruits', unit: 'pyès', suggestedPrice: 25 },
  { id: 'anana', nameHT: 'Anana', nameFR: 'Ananas', nameEN: 'Pineapple', emoji: '🍍', category: 'fruits', unit: 'pyès', suggestedPrice: 75 },
  { id: 'kenèp', nameHT: 'Kenèp', nameFR: 'Quenette', nameEN: 'Spanish lime (kenep)', emoji: '🍇', category: 'fruits', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'kachiman', nameHT: 'Kachiman', nameFR: 'Cachiman', nameEN: 'Sugar apple', emoji: '🍏', category: 'fruits', unit: 'pyès', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🍠 ROOTS & TUBERS (Rasin & Viv)
  // ═══════════════════════════════════════════
  { id: 'patat', nameHT: 'Patat', nameFR: 'Patate douce', nameEN: 'Sweet potato', emoji: '🍠', category: 'roots', unit: 'liv', suggestedPrice: 50 },
  { id: 'yanm', nameHT: 'Yanm', nameFR: 'Igname', nameEN: 'Yam', emoji: '🍠', category: 'roots', unit: 'liv', suggestedPrice: 60 },
  { id: 'manyok', nameHT: 'Manyòk', nameFR: 'Manioc', nameEN: 'Cassava', emoji: '🥔', category: 'roots', unit: 'liv', suggestedPrice: 40 },
  { id: 'malanga', nameHT: 'Malanga', nameFR: 'Malanga', nameEN: 'Malanga / taro', emoji: '🥔', category: 'roots', unit: 'liv', suggestedPrice: 50 },
  { id: 'lam', nameHT: 'Lam (fwi a pen)', nameFR: 'Fruit à pain', nameEN: 'Breadfruit', emoji: '🫓', category: 'roots', unit: 'pyès', suggestedPrice: 50 },
  { id: 'mazonbèl', nameHT: 'Mazonbèl', nameFR: 'Pomme de terre', nameEN: 'Potato', emoji: '🥔', category: 'roots', unit: 'liv', suggestedPrice: 60 },

  // ═══════════════════════════════════════════
  // 🍖 MEAT & FISH (Vyann & Pwason)
  // ═══════════════════════════════════════════
  { id: 'vyann-bèf', nameHT: 'Vyann bèf', nameFR: 'Viande de boeuf', nameEN: 'Beef', emoji: '🥩', category: 'proteins', unit: 'liv', suggestedPrice: 500 },
  { id: 'vyann-kabrit', nameHT: 'Vyann kabrit', nameFR: 'Viande de chèvre', nameEN: 'Goat meat', emoji: '🥩', category: 'proteins', unit: 'liv', suggestedPrice: 450 },
  { id: 'vyann-kochon', nameHT: 'Vyann kochon', nameFR: 'Viande de porc', nameEN: 'Pork', emoji: '🥩', category: 'proteins', unit: 'liv', suggestedPrice: 400 },
  { id: 'poul', nameHT: 'Poul', nameFR: 'Poulet', nameEN: 'Chicken', emoji: '🍗', category: 'proteins', unit: 'pyès', suggestedPrice: 500 },
  { id: 'taso', nameHT: 'Taso (vyann seche)', nameFR: 'Tasseau (viande séchée)', nameEN: 'Dried fried meat (tasso)', emoji: '🥩', category: 'proteins', unit: 'liv', suggestedPrice: 600 },
  { id: 'griot', nameHT: 'Griyo', nameFR: 'Griot (porc frit)', nameEN: 'Fried pork (griot)', emoji: '🍖', category: 'proteins', unit: 'liv', suggestedPrice: 550 },
  { id: 'pwason-fre', nameHT: 'Pwason frè', nameFR: 'Poisson frais', nameEN: 'Fresh fish', emoji: '🐟', category: 'proteins', unit: 'liv', suggestedPrice: 350 },
  { id: 'pwason-seche', nameHT: 'Pwason seche', nameFR: 'Poisson séché', nameEN: 'Dried fish', emoji: '🐟', category: 'proteins', unit: 'liv', suggestedPrice: 400 },
  { id: 'aranso', nameHT: 'Aransò', nameFR: 'Hareng saur', nameEN: 'Smoked herring', emoji: '🐟', category: 'proteins', unit: 'liv', suggestedPrice: 350 },
  { id: 'lanbi', nameHT: 'Lanbi', nameFR: 'Lambi (conque)', nameEN: 'Conch', emoji: '🐚', category: 'proteins', unit: 'liv', suggestedPrice: 500 },
  { id: 'kribich', nameHT: 'Kribich', nameFR: 'Écrevisse', nameEN: 'Crayfish', emoji: '🦐', category: 'proteins', unit: 'liv', suggestedPrice: 400 },
  { id: 'sirik', nameHT: 'Sirik (krab)', nameFR: 'Crabe', nameEN: 'Crab', emoji: '🦀', category: 'proteins', unit: 'pyès', suggestedPrice: 150 },
  { id: 'chiktay', nameHT: 'Chiktay (mori)', nameFR: 'Morue séchée effilochée', nameEN: 'Shredded salted cod', emoji: '🐟', category: 'proteins', unit: 'liv', suggestedPrice: 450 },

  // ═══════════════════════════════════════════
  // 🥚 DAIRY & EGGS (Lèt & Ze)
  // ═══════════════════════════════════════════
  { id: 'ze', nameHT: 'Ze', nameFR: 'Oeufs', nameEN: 'Eggs', emoji: '🥚', category: 'dairy', unit: 'douzèn', suggestedPrice: 250 },
  { id: 'lèt-konbine', nameHT: 'Lèt konbine', nameFR: 'Lait concentré', nameEN: 'Evaporated milk', emoji: '🥛', category: 'dairy', unit: 'bwat', suggestedPrice: 100 },
  { id: 'lèt-poud', nameHT: 'Lèt an poud', nameFR: 'Lait en poudre', nameEN: 'Powdered milk', emoji: '🥛', category: 'dairy', unit: 'pakèt', suggestedPrice: 75 },
  { id: 'fromaj', nameHT: 'Fwomaj', nameFR: 'Fromage', nameEN: 'Cheese', emoji: '🧀', category: 'dairy', unit: 'pyès', suggestedPrice: 150 },

  // ═══════════════════════════════════════════
  // 🥤 BEVERAGES (Bwason)
  // ═══════════════════════════════════════════
  { id: 'dlo', nameHT: 'Dlo', nameFR: 'Eau', nameEN: 'Water', emoji: '💧', category: 'drinks', unit: 'galon', suggestedPrice: 25 },
  { id: 'dlo-sache', nameHT: 'Dlo sache', nameFR: 'Eau en sachet', nameEN: 'Water sachet', emoji: '💧', category: 'drinks', unit: 'sache', suggestedPrice: 5 },
  { id: 'kola', nameHT: 'Kola', nameFR: 'Soda', nameEN: 'Soda', emoji: '🥤', category: 'drinks', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'kola-lakay', nameHT: 'Kola Lakay', nameFR: 'Kola Lakay', nameEN: 'Kola Lakay (local soda)', emoji: '🥤', category: 'drinks', unit: 'boutèy', suggestedPrice: 50 },
  { id: 'ji-fwi', nameHT: 'Ji natirèl', nameFR: 'Jus naturel', nameEN: 'Natural juice', emoji: '🧃', category: 'drinks', unit: 'boutèy', suggestedPrice: 50 },
  { id: 'ji-kan', nameHT: 'Ji kann', nameFR: 'Jus de canne', nameEN: 'Sugarcane juice', emoji: '🧃', category: 'drinks', unit: 'vè', suggestedPrice: 25 },
  { id: 'kafe', nameHT: 'Kafe', nameFR: 'Café', nameEN: 'Coffee', emoji: '☕', category: 'drinks', unit: 'liv', suggestedPrice: 300 },
  { id: 'te', nameHT: 'Te', nameFR: 'Thé', nameEN: 'Tea', emoji: '☕', category: 'drinks', unit: 'pakèt', suggestedPrice: 50 },
  { id: 'chokola', nameHT: 'Chokola (boul kakawo)', nameFR: 'Chocolat (boules de cacao)', nameEN: 'Cocoa balls (chocolate)', emoji: '🍫', category: 'drinks', unit: 'pyès', suggestedPrice: 50 },
  { id: 'akasan', nameHT: 'Akasan', nameFR: 'Akasan (boisson maïs)', nameEN: 'Akasan (corn drink)', emoji: '🥛', category: 'drinks', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'mabi', nameHT: 'Mabi', nameFR: 'Mabi', nameEN: 'Mabi (bark drink)', emoji: '🥤', category: 'drinks', unit: 'boutèy', suggestedPrice: 50 },

  // ═══════════════════════════════════════════
  // 🌶️ SPICES & CONDIMENTS (Epis & Kondiman)
  // ═══════════════════════════════════════════
  { id: 'sèl', nameHT: 'Sèl', nameFR: 'Sel', nameEN: 'Salt', emoji: '🧂', category: 'spices', unit: 'mamit', suggestedPrice: 100 },
  { id: 'sik', nameHT: 'Sik', nameFR: 'Sucre', nameEN: 'Sugar', emoji: '🍬', category: 'grains', unit: 'mamit', suggestedPrice: 200 },
  { id: 'sik-blan', nameHT: 'Sik blan (rafine)', nameFR: 'Sucre blanc', nameEN: 'White sugar', emoji: '🍬', category: 'grains', unit: 'liv', suggestedPrice: 75 },
  { id: 'epis-konpòt', nameHT: 'Epis (melanj)', nameFR: 'Épices (mélange)', nameEN: 'Spice mix (epis)', emoji: '🧄', category: 'spices', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'tomatpas', nameHT: 'Tòmat pàs', nameFR: 'Concentré de tomate', nameEN: 'Tomato paste', emoji: '🥫', category: 'spices', unit: 'bwat', suggestedPrice: 50 },
  { id: 'vinèg', nameHT: 'Vinèg', nameFR: 'Vinaigre', nameEN: 'Vinegar', emoji: '🫙', category: 'spices', unit: 'boutèy', suggestedPrice: 50 },
  { id: 'magi', nameHT: 'Magi (kib buyon)', nameFR: 'Cube Maggi', nameEN: 'Maggi bouillon cube', emoji: '🟫', category: 'spices', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'pikliz', nameHT: 'Pikliz', nameFR: 'Pikliz (condiment piquant)', nameEN: 'Pikliz (spicy slaw)', emoji: '🥗', category: 'spices', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'kanèl', nameHT: 'Kanèl', nameFR: 'Cannelle', nameEN: 'Cinnamon', emoji: '🪵', category: 'spices', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'klou-jiròf', nameHT: 'Klou jiròf', nameFR: 'Clou de girofle', nameEN: 'Cloves', emoji: '🌿', category: 'spices', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'vaniy', nameHT: 'Vaniy', nameFR: 'Vanille', nameEN: 'Vanilla extract', emoji: '🧴', category: 'spices', unit: 'boutèy', suggestedPrice: 50 },
  { id: 'sitwon-poud', nameHT: 'Sitrik', nameFR: 'Acide citrique', nameEN: 'Citric acid', emoji: '🍋', category: 'spices', unit: 'pakèt', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🍽️ PREPARED FOOD & SNACKS (Manje Prepare & Goute)
  // ═══════════════════════════════════════════
  { id: 'pate', nameHT: 'Pate (pati)', nameFR: 'Pâté haïtien', nameEN: 'Haitian patty', emoji: '🥟', category: 'prepared', unit: 'pyès', suggestedPrice: 50 },
  { id: 'akra', nameHT: 'Akra (malanga fri)', nameFR: 'Acras de malanga', nameEN: 'Malanga fritters', emoji: '🧆', category: 'prepared', unit: 'pyès', suggestedPrice: 25 },
  { id: 'bannann-peze', nameHT: 'Bannann peze', nameFR: 'Bananes pesées', nameEN: 'Fried plantains (tostones)', emoji: '🍌', category: 'prepared', unit: 'pòsyon', suggestedPrice: 50 },
  { id: 'marinad', nameHT: 'Marinad', nameFR: 'Marinades (beignets)', nameEN: 'Haitian fritters', emoji: '🧆', category: 'prepared', unit: 'pyès', suggestedPrice: 10 },
  { id: 'labouyi-bannann', nameHT: 'Labouyi bannann', nameFR: 'Bouillie de banane', nameEN: 'Plantain porridge', emoji: '🥣', category: 'prepared', unit: 'bòl', suggestedPrice: 50 },
  { id: 'dous-makos', nameHT: 'Dous makòs', nameFR: 'Douceurs macoss', nameEN: 'Haitian fudge', emoji: '🍬', category: 'prepared', unit: 'pyès', suggestedPrice: 25 },
  { id: 'tablèt', nameHT: 'Tablèt (nwa/pistach)', nameFR: 'Tablette (noix/arachide)', nameEN: 'Peanut/coconut brittle', emoji: '🍬', category: 'prepared', unit: 'pyès', suggestedPrice: 25 },
  { id: 'bonbon-siwo', nameHT: 'Bonbon siwo', nameFR: 'Bonbon sirop', nameEN: 'Syrup candy', emoji: '🍭', category: 'prepared', unit: 'pyès', suggestedPrice: 10 },
  { id: 'biskwit', nameHT: 'Biskwit', nameFR: 'Biscuits', nameEN: 'Crackers / cookies', emoji: '🍪', category: 'prepared', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'chips', nameHT: 'Chips', nameFR: 'Chips', nameEN: 'Chips / snacks', emoji: '🍟', category: 'prepared', unit: 'pakèt', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🧹 HOUSEHOLD PRODUCTS (Pwodwi Kay)
  // ═══════════════════════════════════════════
  { id: 'chabon', nameHT: 'Chabon', nameFR: 'Charbon de bois', nameEN: 'Charcoal', emoji: '🪨', category: 'household', unit: 'sak', suggestedPrice: 500 },
  { id: 'gaz', nameHT: 'Gaz (kerozin)', nameFR: 'Kérosène', nameEN: 'Kerosene', emoji: '⛽', category: 'household', unit: 'galon', suggestedPrice: 300 },
  { id: 'gaz-pwopan', nameHT: 'Gaz pwopan', nameFR: 'Gaz propane', nameEN: 'Propane gas', emoji: '🔥', category: 'household', unit: 'galon', suggestedPrice: 400 },
  { id: 'bouji', nameHT: 'Bouji', nameFR: 'Bougie', nameEN: 'Candle', emoji: '🔥', category: 'household', unit: 'pyès', suggestedPrice: 25 },
  { id: 'alimèt', nameHT: 'Alimèt', nameFR: 'Allumettes', nameEN: 'Matches', emoji: '🔥', category: 'household', unit: 'bwat', suggestedPrice: 10 },
  { id: 'klowòks', nameHT: 'Klowòks', nameFR: 'Javel', nameEN: 'Bleach', emoji: '🧴', category: 'household', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'savon-lès', nameHT: 'Savon lès', nameFR: 'Savon à lessive', nameEN: 'Laundry soap', emoji: '🧼', category: 'household', unit: 'pyès', suggestedPrice: 50 },
  { id: 'savon-kizin', nameHT: 'Savon kizin', nameFR: 'Savon de cuisine', nameEN: 'Dish soap', emoji: '🧼', category: 'household', unit: 'boutèy', suggestedPrice: 50 },
  { id: 'detèjan', nameHT: 'Detèjan (poud)', nameFR: 'Détergent en poudre', nameEN: 'Laundry detergent', emoji: '🧴', category: 'household', unit: 'pakèt', suggestedPrice: 50 },
  { id: 'bale', nameHT: 'Balè', nameFR: 'Balai', nameEN: 'Broom', emoji: '🧹', category: 'household', unit: 'pyès', suggestedPrice: 100 },
  { id: 'sache-plastik', nameHT: 'Sache plastik', nameFR: 'Sac plastique', nameEN: 'Plastic bags', emoji: '🧺', category: 'household', unit: 'pakèt', suggestedPrice: 25 },
  { id: 'papye-twalèt', nameHT: 'Papye twalèt', nameFR: 'Papier toilette', nameEN: 'Toilet paper', emoji: '🧻', category: 'household', unit: 'woulo', suggestedPrice: 50 },
  { id: 'pil-batri', nameHT: 'Pil (batri)', nameFR: 'Piles', nameEN: 'Batteries', emoji: '🔋', category: 'household', unit: 'pè', suggestedPrice: 50 },

  // ═══════════════════════════════════════════
  // 🧴 HYGIENE & BEAUTY (Ijyèn & Bote)
  // ═══════════════════════════════════════════
  { id: 'savon-kò', nameHT: 'Savon (kò)', nameFR: 'Savon corporel', nameEN: 'Body soap / bar soap', emoji: '🧼', category: 'hygiene', unit: 'pyès', suggestedPrice: 50 },
  { id: 'dantifris', nameHT: 'Dantifris', nameFR: 'Dentifrice', nameEN: 'Toothpaste', emoji: '🦷', category: 'hygiene', unit: 'tib', suggestedPrice: 75 },
  { id: 'bros-dan', nameHT: 'Bwòs dan', nameFR: 'Brosse à dents', nameEN: 'Toothbrush', emoji: '🦷', category: 'hygiene', unit: 'pyès', suggestedPrice: 50 },
  { id: 'chanpou', nameHT: 'Chanpou', nameFR: 'Shampooing', nameEN: 'Shampoo', emoji: '🧴', category: 'hygiene', unit: 'boutèy', suggestedPrice: 100 },
  { id: 'krèm-cheve', nameHT: 'Krèm cheve', nameFR: 'Crème capillaire', nameEN: 'Hair cream', emoji: '🧴', category: 'hygiene', unit: 'bwat', suggestedPrice: 75 },
  { id: 'deodoran', nameHT: 'Deodoran', nameFR: 'Déodorant', nameEN: 'Deodorant', emoji: '🧴', category: 'hygiene', unit: 'pyès', suggestedPrice: 100 },
  { id: 'koteks', nameHT: 'Kotèks (sèvyèt)', nameFR: 'Serviettes hygiéniques', nameEN: 'Sanitary pads', emoji: '🩹', category: 'hygiene', unit: 'pakèt', suggestedPrice: 100 },
  { id: 'lwil-cheve', nameHT: 'Lwil cheve', nameFR: 'Huile capillaire', nameEN: 'Hair oil', emoji: '🧴', category: 'hygiene', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'vaslin', nameHT: 'Vaslin', nameFR: 'Vaseline', nameEN: 'Petroleum jelly', emoji: '🫙', category: 'hygiene', unit: 'bwat', suggestedPrice: 50 },
  { id: 'koloy', nameHT: 'Kolòy', nameFR: 'Eau de cologne', nameEN: 'Cologne / perfume', emoji: '🧴', category: 'hygiene', unit: 'boutèy', suggestedPrice: 150 },

  // ═══════════════════════════════════════════
  // 🚬 TOBACCO & MISC (Tabak & Diven)
  // ═══════════════════════════════════════════
  { id: 'sigarèt', nameHT: 'Sigarèt', nameFR: 'Cigarettes', nameEN: 'Cigarettes', emoji: '🚬', category: 'tobacco', unit: 'pakèt', suggestedPrice: 100 },
  { id: 'sigarèt-detay', nameHT: 'Sigarèt (detay)', nameFR: 'Cigarettes (à l\'unité)', nameEN: 'Cigarettes (single)', emoji: '🚬', category: 'tobacco', unit: 'pyès', suggestedPrice: 10 },
  { id: 'kat-telefòn', nameHT: 'Kat telefòn (recharj)', nameFR: 'Carte de recharge téléphone', nameEN: 'Phone top-up card', emoji: '📱', category: 'tobacco', unit: 'pyès', suggestedPrice: 100 },
  { id: 'tikit-borlèt', nameHT: 'Tikè borlèt', nameFR: 'Ticket de loterie', nameEN: 'Lottery ticket', emoji: '🎰', category: 'tobacco', unit: 'pyès', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🔧 TOOLS & HARDWARE (Zouti & Ekipman)
  // ═══════════════════════════════════════════
  { id: 'manchèt', nameHT: 'Manchèt', nameFR: 'Machette', nameEN: 'Machete', emoji: '🔪', category: 'hardware', unit: 'pyès', suggestedPrice: 500 },
  { id: 'kou', nameHT: 'Kou (pikawo)', nameFR: 'Houe / pioche', nameEN: 'Hoe / pickaxe', emoji: '⛏️', category: 'hardware', unit: 'pyès', suggestedPrice: 350 },
  { id: 'kòd', nameHT: 'Kòd', nameFR: 'Corde', nameEN: 'Rope', emoji: '🪢', category: 'hardware', unit: 'mèt', suggestedPrice: 10 },
  { id: 'klou', nameHT: 'Klou', nameFR: 'Clous', nameEN: 'Nails', emoji: '🔩', category: 'hardware', unit: 'liv', suggestedPrice: 100 },

  // ═══════════════════════════════════════════
  // 🥃 RHUM BARBANCOURT (Haiti's #1 rum brand)
  // ═══════════════════════════════════════════
  { id: 'barbancourt-blan', nameHT: 'Ronm Barbancourt Blan', nameFR: 'Rhum Barbancourt Blanc', nameEN: 'Barbancourt White Rum', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 350 },
  { id: 'barbancourt-3star', nameHT: 'Ronm Barbancourt 3 Etwal (4 an)', nameFR: 'Rhum Barbancourt 3 Étoiles (4 ans)', nameEN: 'Barbancourt 3-Star (4yr)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 500 },
  { id: 'barbancourt-5star', nameHT: 'Ronm Barbancourt 5 Etwal (8 an)', nameFR: 'Rhum Barbancourt 5 Étoiles (8 ans)', nameEN: 'Barbancourt 5-Star Reserve (8yr)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 800 },
  { id: 'barbancourt-estate', nameHT: 'Ronm Barbancourt Rezèv Domèn (15 an)', nameFR: 'Rhum Barbancourt Réserve du Domaine (15 ans)', nameEN: 'Barbancourt Estate Reserve (15yr)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 2000 },
  { id: 'barbancourt-pango', nameHT: 'Barbancourt Pango (ronm fwi)', nameFR: 'Barbancourt Pango (rhum fruité)', nameEN: 'Barbancourt Pango (fruit rum)', emoji: '🍹', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },

  // ═══════════════════════════════════════════
  // 🥃 BAKARA RUM (Haiti's #2 rum, popular with youth)
  // ═══════════════════════════════════════════
  { id: 'bakara-blan', nameHT: 'Ronm Bakara Blan', nameFR: 'Rhum Bakara Blanc', nameEN: 'Bakara White Rum', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 250 },
  { id: 'bakara-8', nameHT: 'Ronm Bakara 8 An', nameFR: 'Rhum Bakara 8 Ans', nameEN: 'Bakara 8-Year Rum', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 500 },
  { id: 'bakara-12', nameHT: 'Ronm Bakara Gran Rezèv 12 An', nameFR: 'Rhum Bakara Grande Réserve 12 Ans', nameEN: 'Bakara Grand Reserve 12yr', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 800 },
  { id: 'bakara-18', nameHT: 'Ronm Bakara Rezèv Dò 18 An', nameFR: 'Rhum Bakara Réserve d\'Or 18 Ans', nameEN: 'Bakara Reserve D\'Or 18yr', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 1500 },
  { id: 'bakara-grenadya', nameHT: 'Bakara Grenadya', nameFR: 'Bakara Grenadya (passion)', nameEN: 'Bakara Passionfruit Rum', emoji: '🍹', category: 'alcohol', unit: 'boutèy', suggestedPrice: 300 },
  { id: 'bakara-kanèl', nameHT: 'Bakara Kanèl', nameFR: 'Bakara Cannelle', nameEN: 'Bakara Cinnamon Rum', emoji: '🍹', category: 'alcohol', unit: 'boutèy', suggestedPrice: 300 },
  { id: 'bakara-lanni', nameHT: 'Bakara Lanni (zanis)', nameFR: 'Bakara Anis Étoilé', nameEN: 'Bakara Star Anise Rum', emoji: '🍹', category: 'alcohol', unit: 'boutèy', suggestedPrice: 300 },

  // ═══════════════════════════════════════════
  // 🥃 VIEUX LABBÉ (Berling S.A. — Barbancourt family branch)
  // ═══════════════════════════════════════════
  { id: 'vieux-labbe-blan', nameHT: 'Ronm Vyè Labe Blan', nameFR: 'Rhum Vieux Labbé Blanc', nameEN: 'Vieux Labbé White Rum', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 300 },
  { id: 'vieux-labbe-3star', nameHT: 'Ronm Vyè Labe 3 Etwal (3 an)', nameFR: 'Rhum Vieux Labbé 3 Étoiles (3 ans)', nameEN: 'Vieux Labbé 3-Star (3yr)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 450 },
  { id: 'vieux-labbe-5star', nameHT: 'Ronm Vyè Labe 5 Etwal (7 an)', nameFR: 'Rhum Vieux Labbé 5 Étoiles (7 ans)', nameEN: 'Vieux Labbé 5-Star (7yr)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 700 },
  { id: 'vieux-labbe-10', nameHT: 'Ronm Vyè Labe 10 An', nameFR: 'Rhum Vieux Labbé 10 Ans', nameEN: 'Vieux Labbé 10-Year', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 1200 },

  // ═══════════════════════════════════════════
  // 🥃 BOUKMAN BOTANICAL RHUM
  // ═══════════════════════════════════════════
  { id: 'boukman', nameHT: 'Ronm Boukman Botanik', nameFR: 'Rhum Boukman Botanical', nameEN: 'Boukman Botanical Rhum', emoji: '🌿', category: 'alcohol', unit: 'boutèy', suggestedPrice: 1000 },

  // ═══════════════════════════════════════════
  // 🥃 KLEREN / CLAIRIN (artisanal cane spirit)
  // ═══════════════════════════════════════════
  { id: 'kleren-nati', nameHT: 'Kleren natirèl', nameFR: 'Clairin nature', nameEN: 'Kleren (plain)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 100 },
  { id: 'kleren-sitron', nameHT: 'Kleren sitron', nameFR: 'Clairin au citron', nameEN: 'Kleren with lime', emoji: '🍋', category: 'alcohol', unit: 'boutèy', suggestedPrice: 125 },
  { id: 'kleren-kanèl', nameHT: 'Kleren kanèl', nameFR: 'Clairin à la cannelle', nameEN: 'Kleren with cinnamon', emoji: '🫙', category: 'alcohol', unit: 'boutèy', suggestedPrice: 125 },
  { id: 'kleren-miel', nameHT: 'Kleren myèl', nameFR: 'Clairin au miel', nameEN: 'Kleren with honey', emoji: '🍯', category: 'alcohol', unit: 'boutèy', suggestedPrice: 150 },
  { id: 'kleren-zanmann', nameHT: 'Kleren zanmann', nameFR: 'Clairin aux amandes', nameEN: 'Kleren with almonds', emoji: '🥜', category: 'alcohol', unit: 'boutèy', suggestedPrice: 150 },
  { id: 'tranpe', nameHT: 'Tranpe (kleren ak fèy/rasin)', nameFR: 'Trempé (clairin infusé)', nameEN: 'Trempé (infused kleren with roots/leaves)', emoji: '🌿', category: 'alcohol', unit: 'boutèy', suggestedPrice: 150 },
  { id: 'kleren-sajous', nameHT: 'Kleren Sajous', nameFR: 'Clairin Sajous', nameEN: 'Clairin Sajous (artisan)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 200 },
  { id: 'kleren-casimir', nameHT: 'Kleren Kazimi (Vaval)', nameFR: 'Clairin Casimir (Vaval)', nameEN: 'Clairin Casimir (Vaval)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 200 },
  { id: 'kleren-le-rocher', nameHT: 'Kleren Le Rocher', nameFR: 'Clairin Le Rocher', nameEN: 'Clairin Le Rocher', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 175 },
  { id: 'kleren-detay', nameHT: 'Kleren (detay / vè)', nameFR: 'Clairin (au verre)', nameEN: 'Kleren (by the glass/shot)', emoji: '🥃', category: 'alcohol', unit: 'vè', suggestedPrice: 25 },

  // ═══════════════════════════════════════════
  // 🍺 BEER (Byè)
  // ═══════════════════════════════════════════
  { id: 'prestige', nameHT: 'Byè Prestige', nameFR: 'Bière Prestige', nameEN: 'Prestige Beer', emoji: '🍺', category: 'alcohol', unit: 'boutèy', suggestedPrice: 100 },
  { id: 'prestige-gwo', nameHT: 'Byè Prestige (gwo boutèy)', nameFR: 'Bière Prestige (grande)', nameEN: 'Prestige Beer (large bottle)', emoji: '🍺', category: 'alcohol', unit: 'gwo boutèy', suggestedPrice: 150 },
  { id: 'prestige-lite', nameHT: 'Byè Prestige Lite', nameFR: 'Bière Prestige Light', nameEN: 'Prestige Light Beer', emoji: '🍺', category: 'alcohol', unit: 'boutèy', suggestedPrice: 100 },
  { id: 'presidente', nameHT: 'Byè Presidente', nameFR: 'Bière Presidente', nameEN: 'Presidente Beer (imported DR)', emoji: '🍺', category: 'alcohol', unit: 'boutèy', suggestedPrice: 125 },
  { id: 'heineken', nameHT: 'Byè Heineken', nameFR: 'Bière Heineken', nameEN: 'Heineken Beer (imported)', emoji: '🍺', category: 'alcohol', unit: 'boutèy', suggestedPrice: 150 },
  { id: 'guinness', nameHT: 'Byè Guinness', nameFR: 'Bière Guinness', nameEN: 'Guinness Stout (imported)', emoji: '🍺', category: 'alcohol', unit: 'boutèy', suggestedPrice: 175 },

  // ═══════════════════════════════════════════
  // 🍷 TRADITIONAL HAITIAN ALCOHOLIC DRINKS
  // ═══════════════════════════════════════════
  { id: 'kremas', nameHT: 'Kremas', nameFR: 'Crémasse', nameEN: 'Kremas (coconut cream liqueur)', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 250 },
  { id: 'kremas-vaniy', nameHT: 'Kremas vaniy', nameFR: 'Crémasse vanille', nameEN: 'Kremas vanilla', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 275 },
  { id: 'kremas-kafe', nameHT: 'Kremas kafe', nameFR: 'Crémasse café', nameEN: 'Kremas coffee', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 275 },
  { id: 'kremas-kokoye', nameHT: 'Kremas kokoye', nameFR: 'Crémasse coco', nameEN: 'Kremas coconut', emoji: '🥥', category: 'alcohol', unit: 'boutèy', suggestedPrice: 275 },

  // ═══════════════════════════════════════════
  // 🥃 BERLING S.A. LIQUEURS (Haitian-made)
  // ═══════════════════════════════════════════
  { id: 'berling-kokoya', nameHT: 'Likè Berling Kokoya', nameFR: 'Liqueur Berling Kokoya', nameEN: 'Berling Kokoya Liqueur', emoji: '🥥', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },
  { id: 'berling-cafe', nameHT: 'Likè Berling Kafe', nameFR: 'Liqueur Berling Café', nameEN: 'Berling Coffee Liqueur', emoji: '☕', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },
  { id: 'berling-creme', nameHT: 'Krèm Berling', nameFR: 'Crème Berling', nameEN: 'Berling Cream Liqueur', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },

  // ═══════════════════════════════════════════
  // 🍷 IMPORTED SPIRITS (sold in boutik & depo)
  // ═══════════════════════════════════════════
  { id: 'vodka-jeneral', nameHT: 'Vodka', nameFR: 'Vodka', nameEN: 'Vodka (imported)', emoji: '🍸', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },
  { id: 'wiski', nameHT: 'Wiski', nameFR: 'Whisky', nameEN: 'Whisky (imported)', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 600 },
  { id: 'diven-wouj', nameHT: 'Diven wouj', nameFR: 'Vin rouge', nameEN: 'Red wine', emoji: '🍷', category: 'alcohol', unit: 'boutèy', suggestedPrice: 500 },
  { id: 'diven-blan', nameHT: 'Diven blan', nameFR: 'Vin blanc', nameEN: 'White wine', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 500 },
  { id: 'chanpay', nameHT: 'Chanpay / Mouseux', nameFR: 'Champagne / Mousseux', nameEN: 'Champagne / Sparkling wine', emoji: '🍾', category: 'alcohol', unit: 'boutèy', suggestedPrice: 800 },
  { id: 'brandy', nameHT: 'Brandi', nameFR: 'Brandy', nameEN: 'Brandy', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 500 },
  { id: 'jin', nameHT: 'Jin', nameFR: 'Gin', nameEN: 'Gin', emoji: '🍸', category: 'alcohol', unit: 'boutèy', suggestedPrice: 450 },
  { id: 'tekila', nameHT: 'Tekila', nameFR: 'Tequila', nameEN: 'Tequila', emoji: '🥃', category: 'alcohol', unit: 'boutèy', suggestedPrice: 600 },
  { id: 'likè', nameHT: 'Likè (diven)', nameFR: 'Liqueur (divers)', nameEN: 'Liqueur (various)', emoji: '🥂', category: 'alcohol', unit: 'boutèy', suggestedPrice: 400 },

  // ═══════════════════════════════════════════
  // 🍹 MIXERS & COCKTAIL INGREDIENTS
  // ═══════════════════════════════════════════
  { id: 'grenadine', nameHT: 'Siwo grenadine', nameFR: 'Sirop de grenadine', nameEN: 'Grenadine syrup', emoji: '🍹', category: 'alcohol', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'bitter', nameHT: 'Biter Angostura', nameFR: 'Angostura Bitters', nameEN: 'Angostura Bitters', emoji: '🫙', category: 'alcohol', unit: 'boutèy', suggestedPrice: 200 },
  { id: 'siwo-kann', nameHT: 'Siwo kann', nameFR: 'Sirop de canne', nameEN: 'Cane syrup', emoji: '🍯', category: 'alcohol', unit: 'boutèy', suggestedPrice: 75 },
  { id: 'glas', nameHT: 'Glas (pou bwason)', nameFR: 'Glace (pour boissons)', nameEN: 'Ice (for drinks)', emoji: '🧊', category: 'alcohol', unit: 'sak', suggestedPrice: 50 },

  // ═══════════════════════════════════════════
  // 🧹 RONESOUS/CORNET — FINISHED HOUSEHOLD PRODUCTS
  // ═══════════════════════════════════════════
  { id: 'savon-likid-ronesous', nameHT: 'Savon likid', nameFR: 'Savon liquide', nameEN: 'Liquid soap', emoji: '🧴', category: 'household', unit: 'galon', suggestedPrice: 300, supplier: 'Ronesous Production', sizes: { '5-6gal': 300, '10-12gal': 550 } },
  { id: 'dezenfektan', nameHT: 'Dezenfektan', nameFR: 'Désinfectant', nameEN: 'Disinfectant', emoji: '🧴', category: 'household', unit: 'galon', suggestedPrice: 200, supplier: 'Ronesous Production' },
  { id: 'pin-oil', nameHT: 'Pin-oil (netwayan)', nameFR: 'Pin-oil (nettoyant)', nameEN: 'Pine oil cleaner', emoji: '🌲', category: 'household', unit: 'galon', suggestedPrice: 160, supplier: 'Ronesous Production', sizes: { '1gal': 160, '5-6gal': 300, '10-12gal': 260 } },
  { id: 'vinèg-netwayan', nameHT: 'Vinèg (netwayan)', nameFR: 'Vinaigre (nettoyant)', nameEN: 'Cleaning vinegar', emoji: '🫙', category: 'household', unit: 'galon', suggestedPrice: 160, supplier: 'Ronesous Production', sizes: { '1gal': 160, '5-6gal': 200, '10-12gal': 560 } },
  { id: 'dlo-javèl-ronesous', nameHT: 'Dlo javèl', nameFR: 'Eau de javel', nameEN: 'Bleach (Javel water)', emoji: '🧴', category: 'household', unit: 'galon', suggestedPrice: 50, supplier: 'Ronesous Production', sizes: { '1gal': 50, '3gal': 150, '5-6gal': 300 } },
  { id: 'suavitèl', nameHT: 'Suavitèl (adoucizan)', nameFR: 'Suavitel (adoucissant)', nameEN: 'Fabric softener (Suavitel)', emoji: '🧴', category: 'household', unit: 'galon', suggestedPrice: 280, supplier: 'Ronesous Production', sizes: { '3gal': 280, '5-6gal': 550 } },
  { id: 'espray-ensektisid', nameHT: 'Espray ensektisid', nameFR: 'Spray insecticide', nameEN: 'Insecticide spray', emoji: '🪳', category: 'household', unit: 'galon', suggestedPrice: 230, supplier: 'Ronesous Production', sizes: { '1gal': 230, '2gal': 450 } },

  // ═══════════════════════════════════════════
  // 🧴 RONESOUS/CORNET — BEAUTY & HYGIENE PRODUCTS
  // ═══════════════════════════════════════════
  { id: 'chanpou-ronesous', nameHT: 'Chanpou', nameFR: 'Shampoing', nameEN: 'Shampoo', emoji: '🧴', category: 'hygiene', unit: 'galon', suggestedPrice: 260, supplier: 'Ronesous Production', sizes: { '3gal': 260, '5-6gal': 450 } },
  { id: 'jèl-beny', nameHT: 'Jèl benyen', nameFR: 'Gel douche', nameEN: 'Shower gel', emoji: '🧴', category: 'hygiene', unit: 'galon', suggestedPrice: 280, supplier: 'Ronesous Production', sizes: { '3gal': 280, '5-6gal': 500 } },
  { id: 'pomad-cheve', nameHT: 'Pomad cheve', nameFR: 'Pommade cheveux', nameEN: 'Hair pomade', emoji: '🧴', category: 'hygiene', unit: 'galon', suggestedPrice: 580, supplier: 'Ronesous Production' },
  { id: 'pomad-doulè', nameHT: 'Pomad doulè', nameFR: 'Pommade douleur', nameEN: 'Pain relief balm', emoji: '💊', category: 'hygiene', unit: 'galon', suggestedPrice: 530, supplier: 'Ronesous Production' },
  { id: 'rens-cheve', nameHT: 'Rens (kondisyonè)', nameFR: 'Après-shampoing', nameEN: 'Hair conditioner', emoji: '🧴', category: 'hygiene', unit: 'galon', suggestedPrice: 360, supplier: 'Ronesous Production' },
  { id: 'krèm-po', nameHT: 'Krèm po', nameFR: 'Crème pour la peau', nameEN: 'Skin cream', emoji: '🧴', category: 'hygiene', unit: 'galon', suggestedPrice: 400, supplier: 'Ronesous Production' },
  { id: 'pafen-lwil', nameHT: 'Pafen (baz lwil)', nameFR: "Parfum à l'huile", nameEN: 'Oil-based perfume', emoji: '🌹', category: 'hygiene', unit: 'boutèy', suggestedPrice: 350, supplier: 'Ronesous Production', sizes: { '16oz': 350, '10-12gal': 720 } },
  { id: 'pafen-dlo', nameHT: 'Pafen (baz dlo)', nameFR: "Parfum à l'eau", nameEN: 'Water-based perfume', emoji: '🌹', category: 'hygiene', unit: 'boutèy', suggestedPrice: 300, supplier: 'Ronesous Production' },

  // ═══════════════════════════════════════════
  // 🧪 RAW MATERIALS & CHEMICALS
  // ═══════════════════════════════════════════

  // Surfactants & Bases
  { id: 'texapon', nameHT: 'Texapon (sifaktan)', nameFR: 'Texapon (tensioactif)', nameEN: 'Texapon (surfactant)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 310, supplier: 'Ronesous', sizes: { '16oz': 50, '0.5gal': 165, '1gal': 310 } },
  { id: 'comperlan', nameHT: 'Konpèlan', nameFR: 'Comperlan', nameEN: 'Comperlan (thickener)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 600, supplier: 'Ronesous', sizes: { '16oz': 75, '0.5gal': 200, '1gal': 600 } },
  { id: 'pasta', nameHT: 'Pasta (baz savon)', nameFR: 'Pasta (base savon)', nameEN: 'Pasta (soap base)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 300, supplier: 'Ronesous', sizes: { '16oz': 15, '0.5gal': 180, '1gal': 300 } },
  { id: 'ammonio', nameHT: 'Ammonio', nameFR: 'Ammonio', nameEN: 'Ammonio (surfactant)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 600, supplier: 'Ronesous', sizes: { '2oz': 15, '16oz': 100, '0.5gal': 200, '1gal': 600 } },
  { id: 'mousse', nameHT: 'Mous (ajan mous)', nameFR: 'Mousse (agent moussant)', nameEN: 'Mousse (foaming agent)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 530, supplier: 'Ronesous', sizes: { '2oz': 15, '16oz': 85, '0.5gal': 250, '1gal': 530 } },
  { id: 'nonylphenol', nameHT: 'Nonilpenol', nameFR: 'Nonylphenol', nameEN: 'Nonylphenol', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 600, supplier: 'Ronesous', sizes: { '2oz': 15, '16oz': 180, '0.5gal': 300, '1gal': 600 } },
  { id: 'betaina', nameHT: 'Betaina', nameFR: 'Bétaïne', nameEN: 'Betaine (surfactant)', emoji: '🧪', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 90, supplier: 'Cornet', sizes: { '16oz': 90, '1gal': 400 } },
  { id: 'plantarin', nameHT: 'Plantaren', nameFR: 'Plantaren', nameEN: 'Plantaren (mild surfactant)', emoji: '🧪', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 130, supplier: 'Cornet', sizes: { '16oz': 130, '1gal': 900 } },

  // Acids & Bases
  { id: 'asid-sitrik', nameHT: 'Asid sitrik', nameFR: 'Acide citrique', nameEN: 'Citric acid', emoji: '🧪', category: 'raw_materials', unit: 'liv', suggestedPrice: 80, supplier: 'Ronesous' },
  { id: 'asid-asetik', nameHT: 'Asid asetik', nameFR: 'Acide acétique', nameEN: 'Acetic acid', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 450, supplier: 'Ronesous', sizes: { '16oz': 20, '0.5gal': 230, '1gal': 450 } },
  { id: 'asid-silfrik', nameHT: 'Asid silfrik', nameFR: 'Acide sulfurique', nameEN: 'Sulfuric acid', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 550, supplier: 'Ronesous' },
  { id: 'asid-fosforik', nameHT: 'Asid fosforik', nameFR: 'Acide phosphorique', nameEN: 'Phosphoric acid', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 600, supplier: 'Ronesous', sizes: { '16oz': 100, '0.5gal': 300, '1gal': 600 } },
  { id: 'soud-kostik', nameHT: 'Soud kostik', nameFR: 'Soude caustique', nameEN: 'Caustic soda (lye)', emoji: '🧪', category: 'raw_materials', unit: 'pakèt', suggestedPrice: 60, supplier: 'Ronesous' },
  { id: 'benzoat', nameHT: 'Benzoat sodyom', nameFR: 'Benzoate de sodium', nameEN: 'Sodium benzoate', emoji: '🧪', category: 'raw_materials', unit: 'liv', suggestedPrice: 80, supplier: 'Ronesous' },

  // Oils, Waxes & Emollients
  { id: 'gliserin', nameHT: 'Gliserin', nameFR: 'Glycérine', nameEN: 'Glycerine', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 400, supplier: 'Ronesous', sizes: { '16oz': 60, '0.5gal': 200, '1gal': 400 } },
  { id: 'vaslin-likid', nameHT: 'Vaslin likid', nameFR: 'Vaseline liquide', nameEN: 'Liquid petroleum jelly', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 550, supplier: 'Cornet', sizes: { '16oz': 90, '1gal': 550 } },
  { id: 'vaslin-solid', nameHT: 'Vaslin solid', nameFR: 'Vaseline solide', nameEN: 'Solid petroleum jelly', emoji: '🧪', category: 'raw_materials', unit: 'liv', suggestedPrice: 60, supplier: 'Ronesous', sizes: { 'liv': 60, '0.5gal': 210, 'bokit': 1120 } },
  { id: 'lanolin', nameHT: 'Lanolin', nameFR: 'Lanoline', nameEN: 'Lanolin', emoji: '🧪', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 110, supplier: 'Ronesous' },
  { id: 'silikon-346', nameHT: 'Silikon 346', nameFR: 'Silicone 346', nameEN: 'Silicone 346', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 650, supplier: 'Cornet', sizes: { '16oz': 120, '1gal': 650 } },
  { id: 'silikon-245', nameHT: 'Silikon 245', nameFR: 'Silicone 245', nameEN: 'Silicone 245', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 500, supplier: 'Cornet', sizes: { '16oz': 100, '1gal': 500 } },
  { id: 'setiol-v', nameHT: 'Setiol-V', nameFR: 'Cetiol-V', nameEN: 'Cetiol-V (emollient)', emoji: '🧪', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 320, supplier: 'Cornet', sizes: { '2oz': 50, '16oz': 320 } },
  { id: 'sepijel', nameHT: 'Sepijèl', nameFR: 'Sepigel', nameEN: 'Sepigel (gelling agent)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },

  // Solvents & Alcohols
  { id: 'alkol-izopropil', nameHT: 'Alkòl izopwopil', nameFR: 'Alcool isopropylique', nameEN: 'Isopropyl alcohol', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 450, supplier: 'Ronesous', sizes: { '2oz': 10, '16oz': 70, '0.5gal': 230, '1gal': 450 } },
  { id: 'alkol-etilik', nameHT: 'Alkòl etilik', nameFR: 'Alcool éthylique', nameEN: 'Ethanol', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 700, supplier: 'Cornet', sizes: { '16oz': 120, '1gal': 700 } },
  { id: 'aseton', nameHT: 'Aseton', nameFR: 'Acétone pure', nameEN: 'Pure acetone', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 400, supplier: 'Cornet', sizes: { '16oz': 60, '1gal': 400 } },
  { id: 'formol', nameHT: 'Fòmòl', nameFR: 'Formol', nameEN: 'Formaldehyde', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 350, supplier: 'Cornet', sizes: { '2oz': 10, '16oz': 60, '1gal': 350 } },
  { id: 'ppg', nameHT: 'Pwopilèn glikol (PPG)', nameFR: 'Propylène glycol', nameEN: 'Propylene glycol (PPG)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 550, supplier: 'Cornet', sizes: { '16oz': 100, '1gal': 550 } },

  // Vitamins & Additives
  { id: 'vitamin-e', nameHT: 'Vitamin E', nameFR: 'Vitamine E', nameEN: 'Vitamin E', emoji: '💊', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 140, supplier: 'Cornet', sizes: { '2oz': 140, '16oz': 1120 } },
  { id: 'vitamin-b5', nameHT: 'Vitamin B5', nameFR: 'Vitamine B5', nameEN: 'Vitamin B5 (panthenol)', emoji: '💊', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 90, supplier: 'Cornet' },
  { id: 'vitamin-c', nameHT: 'Vitamin C', nameFR: 'Vitamine C', nameEN: 'Vitamin C', emoji: '💊', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 50, supplier: 'Cornet' },
  { id: 'koloran-karamèl', nameHT: 'Koloran karamèl', nameFR: 'Colorant caramel', nameEN: 'Caramel colorant', emoji: '🎨', category: 'raw_materials', unit: 'galon', suggestedPrice: 1700, supplier: 'Cornet', sizes: { '2oz': 30, '16oz': 240, '1gal': 1700 } },
  { id: 'gom-zantan', nameHT: 'Gòm zantan', nameFR: 'Gomme xanthane', nameEN: 'Xanthan gum', emoji: '🧪', category: 'raw_materials', unit: 'boutèy', suggestedPrice: 400, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 400 } },

  // Preservatives
  { id: 'bronidox', nameHT: 'Bronidox (prezèvatif)', nameFR: 'Bronidox (conservateur)', nameEN: 'Bronidox (preservative)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 1700, supplier: 'Cornet', sizes: { '2oz': 30, '16oz': 240, '1gal': 1700 } },
  { id: 'fiador', nameHT: 'Fiadò (fiksatè)', nameFR: 'Fiador (fixateur)', nameEN: 'Fiador (fixative)', emoji: '🧪', category: 'raw_materials', unit: 'galon', suggestedPrice: 1500, supplier: 'Cornet', sizes: { '2oz': 25, '16oz': 180, '1gal': 1500 } },

  // Packaging
  { id: 'bouchon-galon', nameHT: 'Bouchon galon', nameFR: 'Bouchon gallon', nameEN: 'Gallon bottle cap', emoji: '🧢', category: 'raw_materials', unit: 'douzèn', suggestedPrice: 100, supplier: 'Ronesous' },
  { id: 'boutèy-pafen-1', nameHT: 'Boutèy pafen (senp)', nameFR: 'Bouteille parfum (simple)', nameEN: 'Perfume bottle (simple)', emoji: '🧴', category: 'raw_materials', unit: 'douzèn', suggestedPrice: 60, supplier: 'Ronesous' },
  { id: 'boutèy-pafen-2', nameHT: 'Boutèy pafen (estil)', nameFR: 'Bouteille parfum (style)', nameEN: 'Perfume bottle (fancy)', emoji: '🧴', category: 'raw_materials', unit: 'douzèn', suggestedPrice: 450, supplier: 'Ronesous' },
  { id: 'tallowate', nameHT: 'Bokit Tallowate (baz savon)', nameFR: 'Seau Tallowate (base savon)', nameEN: 'Tallowate bucket (soap base)', emoji: '🪣', category: 'raw_materials', unit: 'bokit', suggestedPrice: 650, supplier: 'Ronesous' },

  // ═══════════════════════════════════════════
  // 🌸 FRAGRANCES (Pafen & Fragrans)
  // ═══════════════════════════════════════════
  { id: 'frag-briz-marin', nameHT: 'Fragrans Briz Marin', nameFR: 'Fragrance Brise Marine', nameEN: 'Sea Breeze fragrance', emoji: '🌊', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },
  { id: 'frag-pin', nameHT: 'Fragrans Lwil Pin', nameFR: 'Fragrance Huile de Pin', nameEN: 'Pine oil fragrance', emoji: '🌲', category: 'fragrances', unit: 'galon', suggestedPrice: 1700, supplier: 'Cornet', sizes: { '2oz': 30, '16oz': 240, '1gal': 1700 } },
  { id: 'frag-melon', nameHT: 'Fragrans Melon', nameFR: 'Fragrance Melon', nameEN: 'Melon fragrance', emoji: '🍈', category: 'fragrances', unit: 'galon', suggestedPrice: 3600, supplier: 'Cornet', sizes: { '2oz': 70, '16oz': 500, '1gal': 3600 } },
  { id: 'frag-zoranj', nameHT: 'Fragrans Zoranj', nameFR: 'Fragrance Orange', nameEN: 'Orange fragrance', emoji: '🍊', category: 'fragrances', unit: 'galon', suggestedPrice: 3600, supplier: 'Cornet', sizes: { '2oz': 70, '16oz': 500, '1gal': 3600 } },
  { id: 'frag-floral', nameHT: 'Fragrans Floral', nameFR: 'Fragrance Florale', nameEN: 'Floral fragrance', emoji: '🌺', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },
  { id: 'frag-aloe', nameHT: 'Fragrans Aloe Vera', nameFR: 'Fragrance Aloe Vera', nameEN: 'Aloe Vera fragrance', emoji: '🌿', category: 'fragrances', unit: 'galon', suggestedPrice: 4500, supplier: 'Cornet', sizes: { '2oz': 90, '16oz': 650, '1gal': 4500 } },
  { id: 'frag-mango', nameHT: 'Fragrans Mango', nameFR: 'Fragrance Mangue', nameEN: 'Mango fragrance', emoji: '🥭', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },
  { id: 'frag-kanèl', nameHT: 'Fragrans Kanèl', nameFR: 'Fragrance Cannelle', nameEN: 'Cinnamon fragrance', emoji: '🪵', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },
  { id: 'frag-lavand', nameHT: 'Fragrans Lavand', nameFR: 'Fragrance Lavande', nameEN: 'Lavender fragrance', emoji: '💐', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 450, '1gal': 3000 } },
  { id: 'frag-sitron', nameHT: 'Fragrans Sitron', nameFR: 'Fragrance Citron', nameEN: 'Lemon fragrance', emoji: '🍋', category: 'fragrances', unit: 'galon', suggestedPrice: 2500, supplier: 'Cornet', sizes: { '2oz': 50, '16oz': 350, '1gal': 2500 } },
  { id: 'frag-bebe', nameHT: 'Fragrans Bebe (Baby James)', nameFR: 'Fragrance Bébé (Baby James)', nameEN: 'Baby fragrance (Baby James)', emoji: '👶', category: 'fragrances', unit: 'galon', suggestedPrice: 3900, supplier: 'Cornet', sizes: { '2oz': 80, '16oz': 600, '1gal': 3900 } },
  { id: 'frag-frèz', nameHT: 'Fragrans Frèz', nameFR: 'Fragrance Fraise', nameEN: 'Strawberry fragrance', emoji: '🍓', category: 'fragrances', unit: 'galon', suggestedPrice: 3000, supplier: 'Cornet', sizes: { '2oz': 50, '16oz': 400, '1gal': 3000 } },
  { id: 'frag-pom', nameHT: 'Fragrans Pòm', nameFR: 'Fragrance Pomme', nameEN: 'Apple fragrance', emoji: '🍎', category: 'fragrances', unit: 'galon', suggestedPrice: 2000, supplier: 'Cornet', sizes: { '2oz': 45, '16oz': 320, '1gal': 2000 } },
  { id: 'frag-anana', nameHT: 'Fragrans Anana', nameFR: 'Fragrance Ananas', nameEN: 'Pineapple fragrance', emoji: '🍍', category: 'fragrances', unit: 'galon', suggestedPrice: 3050, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 400, '1gal': 3050 } },
  { id: 'frag-myèl', nameHT: 'Fragrans Myèl', nameFR: 'Fragrance Miel', nameEN: 'Honey fragrance', emoji: '🍯', category: 'fragrances', unit: 'galon', suggestedPrice: 3500, supplier: 'Cornet', sizes: { '2oz': 60, '16oz': 480, '1gal': 3500 } },
  { id: 'frag-cheri', nameHT: 'Fragrans Cheri', nameFR: 'Fragrance Cerise', nameEN: 'Cherry fragrance', emoji: '🍒', category: 'fragrances', unit: 'galon', suggestedPrice: 5000, supplier: 'Cornet', sizes: { '2oz': 100, '16oz': 700, '1gal': 5000 } },
  { id: 'frag-sitronèl', nameHT: 'Fragrans Sitronèl', nameFR: 'Fragrance Citronnelle', nameEN: 'Citronella fragrance', emoji: '🌿', category: 'fragrances', unit: 'galon', suggestedPrice: 3100, supplier: 'Cornet', sizes: { '2oz': 50, '16oz': 370, '1gal': 3100 } },
  { id: 'frag-suavitèl', nameHT: 'Fragrans Suavitèl', nameFR: 'Fragrance Suavitel', nameEN: 'Suavitel-type fragrance', emoji: '🌸', category: 'fragrances', unit: 'boutèy', suggestedPrice: 30, supplier: 'Ronesous' },
  { id: 'frag-mistolin', nameHT: 'Fragrans Mistoline', nameFR: 'Fragrance Mistoline', nameEN: 'Mistoline-type fragrance', emoji: '🌸', category: 'fragrances', unit: 'galon', suggestedPrice: 150, supplier: 'Ronesous', sizes: { '1oz': 30, '1gal': 150 } },
  { id: 'frag-pafen', nameHT: 'Fragrans Pafen (konsantre)', nameFR: 'Fragrance Parfum (concentrée)', nameEN: 'Perfume fragrance (concentrated)', emoji: '🌹', category: 'fragrances', unit: 'boutèy', suggestedPrice: 90, supplier: 'Ronesous' },
];

// Total: ~245 products across 18 categories
// Suppliers: Ronesous Production (Marin 5, Tel: 3783-1959) | Cornet Production (Tel: 4401-4045)
