(function () {
  const floatLogo = document.getElementById("floatLogo");
  if (!floatLogo) return;

  const STORAGE_KEY = "abstore_chatbot_history_v1";
  const MAX_HISTORY = 40;
  const PAGE_SIZE = 5;
  let lastProductCtx = null;
  let chatState = createChatState();

  // ─── Text normalization (English + Arabic) ────────────────────────
  const ARABIC_DIACRITICS = /[ً-ْٰـ]/g;
  function normalize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(ARABIC_DIACRITICS, "")
      .replace(/[إأآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function paddedNormal(text) {
    return " " + normalize(text) + " ";
  }

  function hasAnyWord(haystackPadded, words) {
    for (const w of words) {
      const nw = normalize(w);
      if (nw && haystackPadded.includes(" " + nw + " ")) return true;
    }
    return false;
  }

  function matchesPhrase(haystackPadded, phrase) {
    const norm = normalize(phrase);
    if (!norm) return false;
    const padded = " " + norm + " ";
    const isShort = norm.length <= 4 || !norm.includes(" ");
    return isShort
      ? haystackPadded.includes(padded)
      : (haystackPadded.includes(padded) || haystackPadded.includes(norm));
  }

  function matchesAnyPhrase(haystackPadded, phrases) {
    return phrases.some((phrase) => matchesPhrase(haystackPadded, phrase));
  }

  function detectOption(haystackPadded, options) {
    for (const option of options) {
      if (matchesAnyPhrase(haystackPadded, option.keys)) return option;
    }
    return null;
  }

  function isArabicText(text) {
    return /[\u0600-\u06FF]/.test(String(text || ""));
  }

  function createChatState() {
    return {
      advisorProfile: null,
      awaitingAdvisor: false,
    };
  }

  function resetChatState() {
    chatState = createChatState();
  }

  function cloneProfile(profile) {
    return profile
      ? {
          arabic: !!profile.arabic,
          category: profile.category || null,
          recipient: profile.recipient || null,
          brand: profile.brand || null,
          vibe: profile.vibe || null,
          occasion: profile.occasion || null,
          season: profile.season || null,
          intensity: profile.intensity || null,
          size: profile.size || null,
          budget: profile.budget || null,
        }
      : null;
  }

  function mergeProfile(base, incoming) {
    const merged = cloneProfile(base) || {
      arabic: false,
      category: null,
      recipient: null,
      brand: null,
      vibe: null,
      occasion: null,
      season: null,
      intensity: null,
      size: null,
      budget: null,
    };
    if (!incoming) return merged;
    if (incoming.category) merged.category = incoming.category;
    if (incoming.recipient) merged.recipient = incoming.recipient;
    if (incoming.brand) merged.brand = incoming.brand;
    if (incoming.vibe) merged.vibe = incoming.vibe;
    if (incoming.occasion) merged.occasion = incoming.occasion;
    if (incoming.season) merged.season = incoming.season;
    if (incoming.intensity) merged.intensity = incoming.intensity;
    if (incoming.size) merged.size = incoming.size;
    if (incoming.budget) merged.budget = incoming.budget;
    if (incoming.arabic) merged.arabic = true;
    return merged;
  }

  function countSignals(profile) {
    if (!profile) return 0;
    return [
      profile.category,
      profile.recipient,
      profile.brand,
      profile.vibe,
      profile.occasion,
      profile.season,
      profile.intensity,
      profile.size,
      profile.budget,
    ].filter(Boolean).length;
  }

  function renderSuggestionButtons(labels) {
    if (!Array.isArray(labels) || !labels.length) return "";
    const buttons = labels
      .map(
        (label) =>
          `<button type="button" class="float-chatbot-suggestion" data-text="${escapeHtml(label)}">${escapeHtml(label)}</button>`,
      )
      .join("");
    return `<div class="float-chatbot-suggestions">${buttons}</div>`;
  }

  // ─── Catalog ─────────────────────────────────────────────────────
  let catalogPromise = null;
  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch("api/chatbot_catalog.php", {
        credentials: "same-origin",
      })
        .then((r) => r.json())
        .then((data) => (data && data.success ? data.products || [] : []))
        .catch(() => []);
    }
    return catalogPromise;
  }

  function formatPrice(value) {
    if (typeof value !== "number" || !isFinite(value)) return "";
    return "₪" + value.toFixed(2);
  }

  function productLink(p) {
    const params = new URLSearchParams();
    if (p.category && p.category !== "all") params.set("category", p.category);
    params.set("quickview", p.id);
    return "products.html?" + params.toString();
  }

  function onProductCardClick(event) {
    const card = event.target.closest(".bot-prod");
    if (!card) return;
    const id = Number(card.dataset.productId || 0);
    if (!id) return;
    const onProductsPage =
      /\/products\.html(?:$|\?|#)/.test(
        window.location.pathname + window.location.search,
      ) ||
      window.location.pathname.endsWith("/products.html") ||
      document.getElementById("quickViewModal");
    if (onProductsPage && typeof window.quickView === "function") {
      event.preventDefault();
      window.quickView(id);
      setOpen(false);
    }
  }

  function productImage(p) {
    if (!p.image_url) return "";
    const url =
      p.image_url.startsWith("http") || p.image_url.startsWith("/")
        ? p.image_url
        : "/" + p.image_url;
    return url;
  }

  function renderProductList(title, products, emptyMsg) {
    if (!products.length) return emptyMsg;
    const items = products
      .map((p) => {
        const img = productImage(p);
        const price = formatPrice(p.price);
        const old =
          p.old_price && p.old_price > p.price
            ? ` <span class="bot-prod-old">${formatPrice(p.old_price)}</span>`
            : "";
        const stars = p.stars
          ? `<span class="bot-prod-stars">★ ${Number(p.stars).toFixed(1)}</span>`
          : "";
        const badge = p.badge
          ? `<span class="bot-prod-badge">${escapeHtml(String(p.badge))}</span>`
          : "";
        const imgTag = img
          ? `<img src="${img}" alt="" class="bot-prod-img" loading="lazy">`
          : '<div class="bot-prod-img bot-prod-img-empty"></div>';
        return `
        <a class="bot-prod" href="${productLink(p)}" data-product-id="${p.id}">
          ${imgTag}
          <div class="bot-prod-info">
            <div class="bot-prod-brand">${escapeHtml(String(p.brand || ""))}</div>
            <div class="bot-prod-name">${escapeHtml(String(p.name || ""))} ${badge}</div>
            <div class="bot-prod-meta"><span class="bot-prod-price">${price}</span>${old} ${stars}</div>
          </div>
        </a>`;
      })
      .join("");
    let hint = "";
    if (lastProductCtx) {
      const remaining =
        lastProductCtx.filtered.length - lastProductCtx.offset;
      const more =
        remaining > 0
          ? `${remaining} more available — say "more" to see them. `
          : "";
      hint = `<div class="bot-prod-hint">${more}Refine with "cheaper", "pricier", "under 300", or "between 100 and 400".</div>`;
    }
    return `<div class="bot-prod-title">${escapeHtml(title)}</div><div class="bot-prod-list">${items}</div><a class="bot-prod-more" href="products.html">See full collection →</a>${hint}`;
  }

  // ─── Product context (powers refinements) ────────────────────────
  function setProductCtx(label, filtered) {
    lastProductCtx = { label, filtered, offset: 0 };
  }

  function nextSlice() {
    if (!lastProductCtx) return [];
    const slice = lastProductCtx.filtered.slice(
      lastProductCtx.offset,
      lastProductCtx.offset + PAGE_SIZE,
    );
    lastProductCtx.offset += slice.length;
    return slice;
  }

  async function productIntent(label, filter, emptyMsg) {
    const products = await loadCatalog();
    const filtered = (filter ? products.filter(filter) : products.slice())
      .sort((a, b) => (b.stars || 0) - (a.stars || 0));
    if (!filtered.length) return emptyMsg;
    setProductCtx(label, filtered);
    return renderProductList(label, nextSlice(), emptyMsg);
  }

  function brandMatcher(...needles) {
    const lowered = needles.map((n) => n.toLowerCase());
    return (p) => {
      const b = String(p.brand || "").toLowerCase();
      return lowered.some((n) => b.includes(n));
    };
  }

  async function brandIntent(brandLabel, ...needles) {
    return productIntent(
      `${brandLabel} picks from our shelves`,
      brandMatcher(...needles),
      `We don't have ${brandLabel} loaded in the catalog right now — browse the <a href="products.html">full collection</a> or <a href="contact.html">contact us</a> to check stock.`,
    );
  }

  // ─── Refinements (re-slice / re-sort / price-filter last list) ───
  const WORDS_MORE = ["more", "show more", "more please", "next", "another", "give me more", "بعد", "كمان", "اكثر", "زيد"];
  const WORDS_CHEAPER = ["cheaper", "less expensive", "lower price", "cheapest", "ارخص", "اقل سعر"];
  const WORDS_PRICIER = ["pricier", "more expensive", "higher price", "most expensive", "expensive", "اغلي", "اعلي سعر", "اغلي سعر"];

  function extractBudget(normalizedPaddedText) {
    const between =
      normalizedPaddedText.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/) ||
      normalizedPaddedText.match(/\s(\d+)\s+to\s+(\d+)\s/) ||
      normalizedPaddedText.match(/\sمن\s+(\d+)\s+(?:ل|الي|إلى)\s*(\d+)\s/);
    if (between) {
      const lo = Math.min(+between[1], +between[2]);
      const hi = Math.max(+between[1], +between[2]);
      return {
        type: "between",
        lo,
        hi,
        labelEn: `between ₪${lo} and ₪${hi}`,
        labelAr: `بين ₪${lo} و₪${hi}`,
        filter: (p) => (p.price || 0) >= lo && (p.price || 0) <= hi,
      };
    }

    const under =
      normalizedPaddedText.match(/\b(?:under|below|less than|cheaper than|max|up to)\s+(\d+)/) ||
      normalizedPaddedText.match(/\s(?:تحت|اقل من|بحدود|حتي)\s*(\d+)/);
    if (under) {
      const cap = +under[1];
      return {
        type: "under",
        cap,
        labelEn: `under ₪${cap}`,
        labelAr: `تحت ₪${cap}`,
        filter: (p) => (p.price || 0) <= cap,
      };
    }

    const over =
      normalizedPaddedText.match(/\b(?:over|above|more than|at least|min|from)\s+(\d+)/) ||
      normalizedPaddedText.match(/\s(?:فوق|اكثر من|اعلي من)\s*(\d+)/);
    if (over) {
      const floor = +over[1];
      return {
        type: "over",
        floor,
        labelEn: `over ₪${floor}`,
        labelAr: `فوق ₪${floor}`,
        filter: (p) => (p.price || 0) >= floor,
      };
    }

    return null;
  }

  async function tryRefinement(rawText) {
    if (!lastProductCtx) return null;
    const n = paddedNormal(rawText);

    const budget = extractBudget(n);
    if (budget && budget.type === "between") {
      const refined = lastProductCtx.filtered.filter(budget.filter);
      if (!refined.length) {
        return `No matches between ₪${budget.lo} and ₪${budget.hi} — try a wider range.`;
      }
      setProductCtx(`${lastProductCtx.label} — ₪${budget.lo}–${budget.hi}`, refined);
      return renderProductList(lastProductCtx.label, nextSlice(), "Nothing in range.");
    }

    if (budget && budget.type === "under") {
      const refined = lastProductCtx.filtered.filter(budget.filter);
      if (!refined.length) return `No matches under ₪${budget.cap} — try a higher cap.`;
      setProductCtx(`${lastProductCtx.label} — under ₪${budget.cap}`, refined);
      return renderProductList(lastProductCtx.label, nextSlice(), "Nothing in range.");
    }

    if (budget && budget.type === "over") {
      const refined = lastProductCtx.filtered.filter(budget.filter);
      if (!refined.length) return `No matches over ₪${budget.floor}.`;
      setProductCtx(`${lastProductCtx.label} — over ₪${budget.floor}`, refined);
      return renderProductList(lastProductCtx.label, nextSlice(), "Nothing in range.");
    }

    if (hasAnyWord(n, WORDS_MORE)) {
      if (lastProductCtx.offset >= lastProductCtx.filtered.length) {
        return 'That\'s the full list — try a different category or browse <a href="products.html">all products</a>.';
      }
      return renderProductList(
        "More " + lastProductCtx.label.toLowerCase(),
        nextSlice(),
        "That's all I have.",
      );
    }

    if (hasAnyWord(n, WORDS_CHEAPER)) {
      lastProductCtx.filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
      lastProductCtx.offset = 0;
      return renderProductList(
        lastProductCtx.label + " — cheapest first",
        nextSlice(),
        "Nothing to sort.",
      );
    }

    if (hasAnyWord(n, WORDS_PRICIER)) {
      lastProductCtx.filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
      lastProductCtx.offset = 0;
      return renderProductList(
        lastProductCtx.label + " — priciest first",
        nextSlice(),
        "Nothing to sort.",
      );
    }

    return null;
  }

  const ADVISOR_BLOCKERS = [
    "delivery",
    "shipping",
    "track",
    "order status",
    "return",
    "refund",
    "exchange",
    "pay",
    "payment",
    "card",
    "paypal",
    "cash on delivery",
    "account",
    "login",
    "register",
    "contact",
    "phone",
    "open",
    "close",
    "address",
    "location",
    "توصيل",
    "شحن",
    "ارجاع",
    "استرجاع",
    "دفع",
    "حساب",
    "تسجيل",
    "اتصال",
    "رقم",
    "عنوان",
  ];

  const ADVISOR_TRIGGERS = [
    "recommend",
    "suggest",
    "help me find",
    "help me choose",
    "which perfume",
    "what perfume",
    "looking for",
    "i want",
    "i need",
    "choose for me",
    "pick for me",
    "انصحني",
    "اقترح",
    "كيف اختار",
    "ساعدني",
    "بدي",
    "عايز",
    "اريد",
    "أريد",
  ];

  const PERFUME_CONTEXT_WORDS = [
    "perfume",
    "fragrance",
    "scent",
    "smell",
    "cologne",
    "edp",
    "edt",
    "parfum",
    "عطر",
    "عطور",
    "ريحة",
    "برفان",
  ];

  const ADVISOR_CATEGORY_OPTIONS = [
    {
      keys: ["men", "man", "male", "masculine", "رجالي", "للرجال", "للشباب"],
      labelEn: "men's",
      labelAr: "رجالية",
      filter: (p) => p.category === "him",
    },
    {
      keys: ["women", "woman", "female", "feminine", "نسائي", "للنساء", "حريمي"],
      labelEn: "women's",
      labelAr: "نسائية",
      filter: (p) => p.category === "her",
    },
    {
      keys: ["unisex", "shared", "both gender", "يونيسكس", "للجنسين"],
      labelEn: "unisex",
      labelAr: "يونيسكس",
      filter: (p) => p.category === "unisex",
    },
    {
      keys: ["niche", "exclusive", "luxury", "rare", "نيش", "فاخر", "حصري"],
      labelEn: "niche",
      labelAr: "نيش",
      filter: (p) => p.category === "niche",
    },
  ];

  const ADVISOR_RECIPIENT_OPTIONS = [
    {
      keys: ["wife", "girlfriend", "fiancee", "mom", "mother", "sister", "daughter", "زوجتي", "مرتي", "للبنت", "لزوجتي", "لامي", "لأمي", "لاختي", "لأختي"],
      labelEn: "for a woman",
      labelAr: "لإمرأة",
      category: ADVISOR_CATEGORY_OPTIONS[1],
    },
    {
      keys: ["husband", "boyfriend", "fiance", "dad", "father", "brother", "son", "زوجي", "لزوجي", "لجوزي", "لزوج", "لابوي", "لأبوي", "لأبي", "لاخوي", "لأخوي", "لاخي", "لأخي"],
      labelEn: "for a man",
      labelAr: "لرجل",
      category: ADVISOR_CATEGORY_OPTIONS[0],
    },
  ];

  const ADVISOR_VIBE_OPTIONS = [
    {
      keys: ["fresh", "citrus", "clean", "aquatic", "summer", "منعش", "حمضي", "نظيف", "مائي"],
      labelEn: "fresh and clean",
      labelAr: "منعش ونظيف",
    },
    {
      keys: ["sweet", "gourmand", "vanilla", "caramel", "حلو", "فانيلا", "غورماند"],
      labelEn: "sweet and cozy",
      labelAr: "حلو ودافي",
    },
    {
      keys: ["woody", "cedar", "sandalwood", "خشبي", "صندل", "ارز"],
      labelEn: "woody and polished",
      labelAr: "خشبي ومرتب",
    },
    {
      keys: ["floral", "rose", "jasmine", "زهري", "وردي", "ورد", "ياسمين"],
      labelEn: "floral and elegant",
      labelAr: "زهري وناعم",
    },
    {
      keys: ["oud", "agarwood", "عود"],
      labelEn: "oud-forward",
      labelAr: "مرتكز على العود",
    },
    {
      keys: ["spicy", "pepper", "cardamom", "cinnamon", "بهارات", "حار", "فلفل", "هيل", "قرفه", "قرفة"],
      labelEn: "spicy and warm",
      labelAr: "حار ودافي",
    },
    {
      keys: ["musky", "musk", "مسك", "بودري", "powdery", "soft skin scent"],
      labelEn: "musky and soft",
      labelAr: "مسكي وناعم",
    },
    {
      keys: ["amber", "resin", "عنبر", "ambery"],
      labelEn: "amber-rich",
      labelAr: "عنبر دافئ",
    },
    {
      keys: ["fruity", "apple", "berry", "peach", "فاكهي", "تفاح", "خوخ", "توت"],
      labelEn: "fruity and playful",
      labelAr: "فاكهي ومرح",
    },
    {
      keys: ["leather", "suede", "جلد", "شمواه"],
      labelEn: "leathery and bold",
      labelAr: "جلدي وجريء",
    },
    {
      keys: ["smoky", "incense", "بخور", "دخاني", "smoke"],
      labelEn: "smoky and dramatic",
      labelAr: "دخاني وملفت",
    },
  ];

  const ADVISOR_OCCASION_OPTIONS = [
    {
      keys: ["office", "work", "meeting", "professional", "مكتب", "شغل", "دوام", "اجتماع"],
      labelEn: "office wear",
      labelAr: "للدوام",
    },
    {
      keys: ["date", "romantic", "dinner", "موعد", "رومانسي", "عشاء"],
      labelEn: "a date",
      labelAr: "للموعد",
    },
    {
      keys: ["wedding", "bride", "groom", "عرس", "زفاف", "عروس", "عريس"],
      labelEn: "a wedding",
      labelAr: "للعرس",
    },
    {
      keys: ["party", "club", "night out", "سهرة", "حفلة", "خروج بالليل"],
      labelEn: "night outings",
      labelAr: "للسهرة",
    },
    {
      keys: ["daily", "everyday", "signature", "daily wear", "يومي", "كل يوم", "سيجنتشر"],
      labelEn: "everyday wear",
      labelAr: "للاستخدام اليومي",
    },
    {
      keys: ["gift", "present", "birthday", "anniversary", "هدية", "عيد ميلاد", "مناسبة"],
      labelEn: "gifting",
      labelAr: "كهدية",
    },
  ];

  const ADVISOR_SEASON_OPTIONS = [
    {
      keys: ["summer", "hot weather", "heat", "صيف", "حر"],
      labelEn: "summer",
      labelAr: "الصيف",
    },
    {
      keys: ["winter", "cold weather", "شتا", "شتاء", "برد"],
      labelEn: "winter",
      labelAr: "الشتا",
    },
    {
      keys: ["spring", "ربيع"],
      labelEn: "spring",
      labelAr: "الربيع",
    },
    {
      keys: ["autumn", "fall", "خريف"],
      labelEn: "autumn",
      labelAr: "الخريف",
    },
  ];

  const ADVISOR_INTENSITY_OPTIONS = [
    {
      keys: ["light", "soft", "subtle", "not strong", "هادئ", "خفيف", "مش قوي"],
      labelEn: "soft projection",
      labelAr: "بهدوء وانتشار خفيف",
    },
    {
      keys: ["moderate", "balanced", "everyday strength", "medium", "متوازن", "وسط", "معتدل"],
      labelEn: "balanced performance",
      labelAr: "بأداء متوازن",
    },
    {
      keys: ["strong", "beast mode", "long lasting", "project", "loud", "قوي", "فواح", "ثبات عالي"],
      labelEn: "strong projection and good longevity",
      labelAr: "بقوة وثبات عالي",
    },
  ];

  const ADVISOR_BRAND_OPTIONS = [
    { keys: ["chanel"], labelEn: "Chanel", labelAr: "شانيل", filter: brandMatcher("chanel") },
    { keys: ["dior", "sauvage"], labelEn: "Dior", labelAr: "ديور", filter: brandMatcher("dior") },
    { keys: ["tom ford", "tomford"], labelEn: "Tom Ford", labelAr: "توم فورد", filter: brandMatcher("tom ford", "tomford") },
    { keys: ["creed", "aventus"], labelEn: "Creed", labelAr: "كريد", filter: brandMatcher("creed") },
    { keys: ["armani", "acqua di gio", "code"], labelEn: "Armani", labelAr: "أرماني", filter: brandMatcher("armani") },
    { keys: ["ysl", "yves saint laurent", "saint laurent", "libre"], labelEn: "YSL", labelAr: "واي اس ال", filter: brandMatcher("ysl", "saint laurent") },
    { keys: ["versace", "dylan blue", "eros"], labelEn: "Versace", labelAr: "فيرساتشي", filter: brandMatcher("versace") },
    { keys: ["jo malone", "jomalone"], labelEn: "Jo Malone", labelAr: "جو مالون", filter: brandMatcher("jo malone", "jomalone") },
    { keys: ["byredo"], labelEn: "Byredo", labelAr: "بايريدو", filter: brandMatcher("byredo") },
    { keys: ["maison francis", "francis kurkdjian", "baccarat", "mfk"], labelEn: "Maison Francis Kurkdjian", labelAr: "مايسون فرانسيس كوركدجيان", filter: brandMatcher("francis", "maison") },
    { keys: ["parfums de marly", "de marly", "marly"], labelEn: "Parfums de Marly", labelAr: "بارفامز دي مارلي", filter: brandMatcher("marly") },
    { keys: ["xerjoff", "naxos", "erba pura"], labelEn: "Xerjoff", labelAr: "زيرجوف", filter: brandMatcher("xerjoff") },
    { keys: ["initio", "oud for greatness"], labelEn: "Initio", labelAr: "إنيشيو", filter: brandMatcher("initio") },
    { keys: ["amouage"], labelEn: "Amouage", labelAr: "أمواج", filter: brandMatcher("amouage") },
    { keys: ["prada"], labelEn: "Prada", labelAr: "برادا", filter: brandMatcher("prada") },
    { keys: ["gucci"], labelEn: "Gucci", labelAr: "غوتشي", filter: brandMatcher("gucci") },
    { keys: ["valentino", "born in roma"], labelEn: "Valentino", labelAr: "فالنتينو", filter: brandMatcher("valentino") },
    { keys: ["hermes", "hermès", "terre d"], labelEn: "Hermes", labelAr: "هيرمس", filter: brandMatcher("hermes", "hermès") },
    { keys: ["paco rabanne", "rabanne", "invictus", "1 million"], labelEn: "Rabanne", labelAr: "رابان", filter: brandMatcher("rabanne", "paco") },
    { keys: ["lancome", "lancôme", "la vie est belle"], labelEn: "Lancome", labelAr: "لانكوم", filter: brandMatcher("lancome", "lancôme") },
  ];

  function extractBottleSize(normalizedPaddedText) {
    const sizeMatch = normalizedPaddedText.match(/\b(30|50|60|75|90|100|120|125|150|200)\s*(?:ml|ملي|مل)\b/);
    if (!sizeMatch) return null;
    const size = Number(sizeMatch[1]);
    return {
      value: size,
      labelEn: `${size} ml`,
      labelAr: `${size} مل`,
      filter: (p) => String(p.size || "").includes(String(size)),
    };
  }

  function analyzeAdvisorRequest(rawText) {
    const normalized = paddedNormal(rawText);
    if (matchesAnyPhrase(normalized, ADVISOR_BLOCKERS)) return null;

    const arabic = isArabicText(rawText);
    const hasPerfumeContext = matchesAnyPhrase(normalized, PERFUME_CONTEXT_WORDS);
    const hasTrigger = matchesAnyPhrase(normalized, ADVISOR_TRIGGERS);
    const category = detectOption(normalized, ADVISOR_CATEGORY_OPTIONS);
    const recipient = detectOption(normalized, ADVISOR_RECIPIENT_OPTIONS);
    const brand = detectOption(normalized, ADVISOR_BRAND_OPTIONS);
    const vibe = detectOption(normalized, ADVISOR_VIBE_OPTIONS);
    const occasion = detectOption(normalized, ADVISOR_OCCASION_OPTIONS);
    const season = detectOption(normalized, ADVISOR_SEASON_OPTIONS);
    const intensity = detectOption(normalized, ADVISOR_INTENSITY_OPTIONS);
    const size = extractBottleSize(normalized);
    const budget = extractBudget(normalized);

    const incoming = {
      arabic,
      category: category || (recipient ? recipient.category : null),
      recipient,
      brand,
      vibe,
      occasion,
      season,
      intensity,
      size,
      budget,
    };

    const incomingSignals = countSignals(incoming);
    const priorProfile = cloneProfile(chatState.advisorProfile);
    const merged = mergeProfile(priorProfile, incoming);
    const mergedSignals = countSignals(merged);
    const continuingAdvisor = !!(chatState.awaitingAdvisor || priorProfile);
    const perfumeLikeRequest =
      hasTrigger ||
      hasPerfumeContext ||
      (continuingAdvisor && incomingSignals > 0) ||
      incomingSignals >= 2;

    if (!perfumeLikeRequest) return null;

    if (incomingSignals === 0) {
      return {
        kind: "clarify",
        arabic,
        profile: mergedSignals ? merged : mergeProfile(null, { arabic }),
      };
    }

    if (!hasTrigger && !hasPerfumeContext && !continuingAdvisor && incomingSignals < 2) {
      return null;
    }

    return {
      kind: "recommend",
      arabic,
      profile: merged,
    };
  }

  function buildAdvisorClarifier(profile) {
    const arabic = !!(profile && profile.arabic);
    const known = [];
    if (profile && profile.category) known.push(arabic ? profile.category.labelAr : profile.category.labelEn);
    if (profile && profile.brand) known.push(arabic ? profile.brand.labelAr : profile.brand.labelEn);
    if (profile && profile.vibe) known.push(arabic ? profile.vibe.labelAr : profile.vibe.labelEn);
    if (profile && profile.occasion) known.push(arabic ? profile.occasion.labelAr : profile.occasion.labelEn);
    if (profile && profile.budget) known.push(arabic ? profile.budget.labelAr : profile.budget.labelEn);

    const summary = known.length
      ? arabic
        ? `<div>لحد الآن فهمت: <b>${escapeHtml(known.join(" / "))}</b>.</div>`
        : `<div>So far I’ve got: <b>${escapeHtml(known.join(" / "))}</b>.</div>`
      : "";

    const ask = arabic
      ? "<div>أعطيني 1 أو 2 تفاصيل كمان: رجالي أو نسائي، منعش أو حلو أو عود، للاستخدام اليومي أو للسهرة، وبرضه ممكن تحدد ميزانية.</div>"
      : "<div>Give me 1 or 2 more clues: men’s or women’s, fresh / sweet / oud, daily or evening, and a budget if you have one.</div>";

    const suggestions = arabic
      ? ["رجالي", "نسائي", "منعش", "زهري", "للدوام", "للسهرة", "تحت 300", "عود"]
      : ["For men", "For women", "Fresh", "Floral", "For office", "For a date", "Under 300", "Oud"];

    return `${summary}${ask}${renderSuggestionButtons(suggestions)}`;
  }

  async function buildAdvisorReply(profile) {
    const products = await loadCatalog();
    let filtered = products.slice();
    if (profile.category) filtered = filtered.filter(profile.category.filter);
    if (profile.brand) filtered = filtered.filter(profile.brand.filter);
    if (profile.size) filtered = filtered.filter(profile.size.filter);
    if (profile.budget) filtered = filtered.filter(profile.budget.filter);
    filtered.sort((a, b) => (b.stars || 0) - (a.stars || 0) || (a.price || 0) - (b.price || 0));

    const label = profile.arabic ? "ترشيحات مناسبة إلك" : "Picks that fit your brief";
    const intro = profile.arabic
      ? [
          `<div>جمّعت طلبك كالتالي: <b>${profile.category ? profile.category.labelAr : "خيارات مناسبة"}<\/b>${profile.recipient ? ` ${profile.recipient.labelAr}` : ""}${profile.occasion ? ` ${profile.occasion.labelAr}` : ""}${profile.season ? ` في ${profile.season.labelAr}` : ""}.</div>`,
          profile.brand ? `<div>بركّز على <b>${profile.brand.labelAr}</b>.</div>` : "",
          profile.vibe ? `<div>الطابع المطلوب: <b>${profile.vibe.labelAr}</b>.</div>` : "",
          profile.intensity ? `<div>الأداء المفضل: <b>${profile.intensity.labelAr}</b>.</div>` : "",
          profile.size ? `<div>الحجم المطلوب: <b>${profile.size.labelAr}</b>.</div>` : "",
          profile.budget ? `<div>الميزانية الملتقطة: <b>${profile.budget.labelAr}</b>.</div>` : "",
        ].filter(Boolean).join("")
      : [
          `<div>I mapped your request to <b>${profile.category ? profile.category.labelEn : "well-rounded"}<\/b> picks${profile.recipient ? ` ${profile.recipient.labelEn}` : ""}${profile.occasion ? ` for ${profile.occasion.labelEn}` : ""}${profile.season ? ` in ${profile.season.labelEn}` : ""}.</div>`,
          profile.brand ? `<div>I’ll lean toward <b>${profile.brand.labelEn}</b>.</div>` : "",
          profile.vibe ? `<div>Target vibe: <b>${profile.vibe.labelEn}</b>.</div>` : "",
          profile.intensity ? `<div>Performance target: <b>${profile.intensity.labelEn}</b>.</div>` : "",
          profile.size ? `<div>Bottle size noted: <b>${profile.size.labelEn}</b>.</div>` : "",
          profile.budget ? `<div>Budget noted: <b>${profile.budget.labelEn}</b>.</div>` : "",
        ].filter(Boolean).join("");

    if (!filtered.length) {
      const suggestions = profile.arabic
        ? renderSuggestionButtons(["وسع الميزانية", "غير الحجم", "رجالي", "نسائي", "المزيد"])
        : renderSuggestionButtons(["Relax the budget", "Change size", "For men", "For women", "Show more"]);
      return `${intro}<div>${profile.arabic
        ? 'ما لقيت نفس الفلتر بالمخزون الحالي، لكن تقدر تغيّر الميزانية أو المقاس أو تتصفح <a href="products.html">كل المنتجات</a>.'
        : 'I couldn’t find an exact catalog match for that filter, but you can relax the budget, change the size, or browse the <a href="products.html">full collection</a>.'}</div>${suggestions}`;
    }

    setProductCtx(label, filtered);
    const hint = profile.arabic
      ? "<div>إذا بدك أضيّقها أكثر، قلّي مثلاً: أرخص، أغلى، تحت 300، بين 200 و400، أو اعرض المزيد.</div>"
      : '<div>If you want me to tighten this up, say things like "cheaper", "pricier", "under 300", "between 200 and 400", or "more".</div>';
    return `${intro}${renderProductList(label, nextSlice(), "Nothing matched that brief.")}${hint}`;
  }

  const intents = [
    {
      keys: [
        "hello",
        "hi ",
        "hey",
        "salam",
        "marhaba",
        "good morning",
        "good evening",
      ],
      reply: () =>
        "Hi! Welcome to AB Store. Ask me about delivery, returns, payment, our boutique, or how to pick a perfume.",
    },
    {
      keys: ["men", "man", "him", "male", "guy", "boy", "masculine"],
      async: true,
      reply: () =>
        productIntent(
          "Top picks for men",
          (p) => p.category === "him",
          'No men’s fragrances loaded yet — try the <a href="products.html?category=him">men’s collection</a>.',
        ),
    },
    {
      keys: ["women", "woman", "her", "female", "lady", "girl", "feminine"],
      async: true,
      reply: () =>
        productIntent(
          "Top picks for women",
          (p) => p.category === "her",
          'No women’s fragrances loaded yet — try the <a href="products.html?category=her">women’s collection</a>.',
        ),
    },
    {
      keys: ["unisex", "shared", "both gender"],
      async: true,
      reply: () =>
        productIntent(
          "Top unisex picks",
          (p) => p.category === "unisex",
          'No unisex fragrances loaded yet — try the <a href="products.html?category=unisex">unisex collection</a>.',
        ),
    },
    {
      keys: ["niche", "rare", "exclusive", "luxury picks"],
      async: true,
      reply: () =>
        productIntent(
          "Niche & exclusive picks",
          (p) => p.category === "niche",
          'No niche fragrances loaded yet — see the <a href="products.html?category=niche">niche collection</a>.',
        ),
    },
    {
      keys: [
        "best",
        "top",
        "popular",
        "bestseller",
        "highest rated",
        "must have",
      ],
      async: true,
      reply: () =>
        productIntent(
          "Our top-rated fragrances",
          null,
          "Catalog is loading — please try again in a moment.",
        ),
    },
    {
      keys: ["cheap", "affordable", "budget", "under "],
      async: true,
      reply: async () => {
        const products = await loadCatalog();
        const sorted = products
          .slice()
          .sort((a, b) => (a.price || 0) - (b.price || 0))
          .slice(0, 5);
        return renderProductList(
          "Most affordable picks",
          sorted,
          "Catalog is still loading.",
        );
      },
    },
    {
      keys: ["sale", "discount", "offer", "deal"],
      async: true,
      reply: () =>
        productIntent(
          "Currently on sale",
          (p) => p.old_price && p.old_price > p.price,
          'No active sales right now — check back soon or browse <a href="products.html">all products</a>.',
        ),
    },
    {
      keys: [
        "delivery",
        "shipping",
        "ship",
        "arrive",
        "how long until",
        "when will i get",
      ],
      reply: () =>
        "Standard delivery takes 2–4 business days. Express delivery is available on selected orders at checkout.",
    },
    {
      keys: ["track", "order status", "where is my order", "tracking"],
      reply: () =>
        'Once your order is confirmed, our team contacts you by email or phone with the delivery status. You can also call <a href="tel:+970594369494">+970 59-4369494</a>.',
    },
    {
      keys: ["original", "authentic", "fake", "genuine", "real perfume"],
      reply: () =>
        "Yes — every fragrance at AB Store is sourced from trusted distributors and sold as 100% original stock.",
    },
    {
      keys: ["return", "refund", "exchange"],
      reply: () =>
        "We accept returns for unopened items in their original packaging. Damaged or incorrect orders are handled as a priority.",
    },
    {
      keys: ["contact", "support", "help me", "reach you", "call you", "phone"],
      reply: () =>
        'Call <a href="tel:+970594369494">+970 59-4369494</a>, email <a href="mailto:contact@abstore.com">contact@abstore.com</a>, or use the <a href="contact.html">contact page</a>.',
    },
    {
      keys: ["pay", "payment", "card", "paypal", "cash on delivery", "cod"],
      reply: () =>
        "We accept card payments, PayPal, and cash on delivery for eligible orders.",
    },
    {
      keys: ["hour", "hours", "boutique hours", "open", "close", "when are you", "working time"],
      reply: () =>
        "Boutique hours: Sun–Thu 10:00–20:00, Saturday 10:00–16:00, Friday closed.",
    },
    {
      keys: [
        "address",
        "location",
        "where are you",
        "boutique",
        "visit",
        "store address",
      ],
      reply: () =>
        "Our boutique is in Qalqilya, West Bank, Palestine. Drop by Sun–Thu 10:00–20:00.",
    },
    {
      keys: ["loyalty", "points", "reward", "member", "tier"],
      reply: () =>
        'AB Store has a loyalty program with Bronze, Silver, Gold and higher tiers. Sign in and open the <a href="loyalty.html">loyalty page</a> to see your points and rewards.',
    },
    {
      keys: [
        "account",
        "login",
        "log in",
        "sign in",
        "register",
        "sign up",
        "create account",
      ],
      reply: () =>
        '<a href="login.html">Sign in</a> or <a href="auth/register.php">create an account</a> to track orders and earn loyalty points.',
    },
    {
      keys: [
        "product",
        "browse",
        "catalog",
        "shop",
        "collection",
        "perfume list",
      ],
      reply: () =>
        'Browse the full collection on the <a href="products.html">products page</a> — filter by brand, family, or price.',
    },
    {
      keys: ["notes", "top note", "heart note", "base note", "pyramid"],
      reply: () =>
        "A fragrance has three layers: <b>top notes</b> (first 15 min, usually citrus/fresh), <b>heart notes</b> (the main character — florals, spice), and <b>base notes</b> (the long-lasting trail — woods, musk, amber).",
    },
    {
      keys: [
        "longevity",
        "last long",
        "how long does",
        "sillage",
        "projection",
      ],
      reply: () =>
        "<b>Longevity</b> is how long a perfume stays on your skin (4–10+ hours depending on concentration). <b>Sillage</b> is the scent trail it leaves around you. EDP usually outlasts EDT.",
    },
    {
      keys: [
        "choose",
        "pick",
        "recommend",
        "suggest",
        "which perfume",
        "help me find",
      ],
      reply: () =>
        'Tell me what you like — fresh & citrusy, sweet & gourmand, woody, floral, or oud — and I can point you to a family. Or browse curated picks on <a href="products.html">products</a>.',
    },
    {
      keys: ["signature scent", "daily perfume", "everyday perfume", "one perfume only"],
      reply: () =>
        "For a signature scent, stay versatile: fresh woods, soft musk, clean citrus, or a smooth floral. You want something that feels like you, not something that wears you.",
    },
    {
      keys: ["first perfume", "beginner", "starter perfume", "new to perfume"],
      reply: () =>
        "If you're just starting, go with something easy to wear: fresh citrus, soft woody, or clean floral. Avoid very smoky oud or ultra-sweet gourmands until you know your taste.",
    },
    {
      keys: ["compliment", "compliment getter", "people notice", "attention"],
      reply: () =>
        "Compliment-getters are usually clean-fresh, softly sweet, or smooth woody scents with good balance. The trick is noticeable, not overpowering.",
    },
    {
      keys: ["blind buy", "safe buy", "safe blind buy"],
      reply: () =>
        "For a blind buy, stay with crowd-pleasers: fresh citrus, clean musk, soft vanilla, or versatile florals. If you can, test on skin first at the boutique.",
    },
    {
      keys: ["strong perfume", "powerful perfume", "beast mode"],
      reply: () =>
        "If you want strong performance, look for richer EDP or Parfum styles with amber, oud, vanilla, woods, or spice. Just go easy on the sprays.",
    },
    {
      keys: ["light perfume", "soft perfume", "not too strong", "subtle perfume"],
      reply: () =>
        "For a soft presence, choose fresh citrus, green notes, neroli, tea, light musk, or airy florals. These stay elegant without filling the room.",
    },
    {
      keys: ["teen", "young", "student", "university"],
      reply: () =>
        "For a younger vibe, fresh fruity, sporty citrus, or clean sweet scents usually land best. Keep it fun, easy, and not too heavy.",
    },
    {
      keys: ["mature", "elegant", "classy", "sophisticated"],
      reply: () =>
        "For a more elegant feel, try refined woods, iris, soft leather, rose, amber, or polished musks. Smooth beats loud.",
    },
    {
      keys: ["oud", "agarwood"],
      reply: () =>
        'Oud is a deep, resinous wood note — warm, smoky, long-lasting. Great for evenings and cooler weather. See oud-leaning options on <a href="products.html">products</a>.',
    },
    {
      keys: ["fresh", "citrus", "summer"],
      reply: () =>
        "For fresh & citrusy scents look for top notes like bergamot, lemon, or neroli — light and breathable, perfect for daytime and warm weather.",
    },
    {
      keys: ["floral", "rose", "jasmine"],
      reply: () =>
        "Floral perfumes (rose, jasmine, tuberose, peony) are elegant and versatile — great for daily wear and gifting.",
    },
    {
      keys: ["sweet", "gourmand", "vanilla", "caramel"],
      reply: () =>
        "Sweet / gourmand scents lean on vanilla, caramel and tonka — cozy, warm, ideal for evenings and cooler months.",
    },
    {
      keys: ["woody", "cedar", "sandalwood"],
      reply: () =>
        "Woody fragrances (cedar, sandalwood, vetiver) feel grounded and refined — versatile for office and evening wear.",
    },
    {
      keys: ["edp", "edt", "parfum", "concentration", "cologne"],
      reply: () =>
        "<b>EDT</b> (Eau de Toilette) ~5–15% oils, lighter, 3–5h. <b>EDP</b> (Eau de Parfum) ~15–20%, richer, 5–8h. <b>Parfum/Extrait</b> ~20–40%, the most intense and longest lasting.",
    },
    {
      keys: ["gift", "present", "birthday", "anniversary"],
      reply: () =>
        'For gifting, an EDP in a versatile floral or fresh family is a safe bet. Browse the <a href="products.html">collection</a> — we can pack a gift-ready selection at the boutique.',
    },
    {
      keys: ["about", "who are you", "what is ab store", "your story"],
      reply: () =>
        'AB Store is a curated luxury perfume boutique. Read more on the <a href="about.html">about page</a>.',
    },
    {
      keys: ["cart", "checkout", "buy", "order now"],
      reply: () =>
        'Add items from the <a href="products.html">products page</a> to your <a href="cart.html">cart</a>, then complete checkout — card, PayPal, or cash on delivery.',
    },
    {
      keys: ["thank", "shukran", "appreciate"],
      reply: () =>
        "You’re welcome! Anything else about our perfumes or services?",
    },
    {
      keys: ["bye", "goodbye", "see you", "cya"],
      reply: () => "Thanks for visiting AB Store — have a fragrant day!",
    },

    // ─── About the website ───────────────────────────────────────────────
    {
      keys: [
        "what is this site",
        "what is this website",
        "what does this site",
        "this website",
        "this site about",
      ],
      reply: () =>
        "AB Store is an online luxury perfume boutique. You can browse fragrances, read reviews, add to cart, earn loyalty points, and contact our team — all from this site.",
    },
    {
      keys: ["features", "what can i do", "site features", "what features"],
      reply: () =>
        "You can: <b>browse perfumes</b> by gender or family, <b>add to cart & checkout</b>, <b>track loyalty points</b>, <b>leave reviews</b>, and <b>contact</b> the boutique. Sign in to save your activity.",
    },
    {
      keys: ["pages", "sections", "menu", "navigation", "how to navigate"],
      reply: () =>
        'Main pages: <a href="index.html">Home</a> · <a href="products.html">Products</a> · <a href="loyalty.html">Loyalty</a> · <a href="about.html">About</a> · <a href="contact.html">Contact</a> · <a href="cart.html">Cart</a>.',
    },
    {
      keys: ["search", "find perfume", "find product", "how to search"],
      reply: () =>
        'Open the <a href="products.html">products page</a> and use the filters (category, brand, price, rating) to narrow down. You can also browse by men / women / unisex / niche.',
    },
    {
      keys: ["wishlist", "favorite", "favourite", "save for later"],
      reply: () =>
        "You can add perfumes to your wishlist from any product card after signing in — they’ll be saved to your account.",
    },
    {
      keys: ["review", "rating", "stars", "feedback"],
      reply: () =>
        "Every product page has star ratings and customer reviews. Once you receive an order, sign in to leave your own review.",
    },
    {
      keys: ["language", "arabic", "english", "عربي", "انجليزي", "بتحكي عربي"],
      reply: () =>
        "I understand both English and Arabic — اسأل بأي لغة وبفهمك. The site itself is in English for now.",
    },
    {
      keys: ["mobile", "phone", "responsive", "tablet"],
      reply: () =>
        "The site is fully responsive — it works on phone, tablet, and desktop. The chat bubble follows you on every page.",
    },
    {
      keys: ["admin", "employee", "staff", "dashboard"],
      reply: () =>
        "Admins and employees have their own dashboard for managing products, users, reviews, and orders. Regular users won’t see it.",
    },
    {
      keys: ["secure", "safe", "privacy", "data", "protect"],
      reply: () =>
        "Your account is protected with hashed passwords and CSRF-secured forms. We don’t share your data with third parties.",
    },

    // ─── Brands ──────────────────────────────────────────────────────────
    {
      keys: ["chanel"],
      async: true,
      reply: () => brandIntent("Chanel", "chanel"),
    },
    {
      keys: ["dior", "sauvage"],
      async: true,
      reply: () => brandIntent("Dior", "dior"),
    },
    {
      keys: ["tom ford", "tomford"],
      async: true,
      reply: () => brandIntent("Tom Ford", "tom ford", "tomford"),
    },
    {
      keys: ["creed", "aventus"],
      async: true,
      reply: () => brandIntent("Creed", "creed"),
    },
    {
      keys: ["armani", "acqua di gio", "code"],
      async: true,
      reply: () => brandIntent("Armani", "armani"),
    },
    {
      keys: ["ysl", "yves saint laurent", "saint laurent", "libre"],
      async: true,
      reply: () => brandIntent("YSL", "ysl", "saint laurent"),
    },
    {
      keys: ["versace", "dylan blue", "eros"],
      async: true,
      reply: () => brandIntent("Versace", "versace"),
    },
    {
      keys: ["jo malone", "jomalone"],
      async: true,
      reply: () => brandIntent("Jo Malone", "jo malone", "jomalone"),
    },
    {
      keys: ["byredo"],
      async: true,
      reply: () => brandIntent("Byredo", "byredo"),
    },
    {
      keys: ["maison francis", "francis kurkdjian", "baccarat", "mfk"],
      async: true,
      reply: () => brandIntent("Maison Francis Kurkdjian", "francis", "maison"),
    },
    {
      keys: ["parfums de marly", "de marly", "marly"],
      async: true,
      reply: () => brandIntent("Parfums de Marly", "marly"),
    },
    {
      keys: ["xerjoff", "naxos", "erba pura"],
      async: true,
      reply: () => brandIntent("Xerjoff", "xerjoff"),
    },
    {
      keys: ["initio", "oud for greatness"],
      async: true,
      reply: () => brandIntent("Initio", "initio"),
    },
    {
      keys: ["amouage"],
      async: true,
      reply: () => brandIntent("Amouage", "amouage"),
    },
    {
      keys: ["prada"],
      async: true,
      reply: () => brandIntent("Prada", "prada"),
    },
    {
      keys: ["gucci"],
      async: true,
      reply: () => brandIntent("Gucci", "gucci"),
    },
    {
      keys: ["valentino", "born in roma"],
      async: true,
      reply: () => brandIntent("Valentino", "valentino"),
    },
    {
      keys: ["hermes", "hermès", "terre d"],
      async: true,
      reply: () => brandIntent("Hermès", "hermes", "hermès"),
    },
    {
      keys: ["paco rabanne", "rabanne", "invictus", "1 million"],
      async: true,
      reply: () => brandIntent("Paco Rabanne", "rabanne", "paco"),
    },
    {
      keys: ["lancome", "lancôme", "la vie est belle"],
      async: true,
      reply: () => brandIntent("Lancôme", "lancome", "lancôme"),
    },

    // ─── Occasions & seasons ─────────────────────────────────────────────
    {
      keys: ["date", "romantic", "dinner", "valentine"],
      reply: () =>
        "For a date, lean on warm sweet or musky scents — vanilla, amber, rose, or a soft oud. EDP concentration keeps you wrapped in scent all evening.",
    },
    {
      keys: ["wedding", "bride", "groom"],
      reply: () =>
        "Weddings call for elegant, memorable scents — think rose, oud, white florals, or a refined woody-amber. Apply lightly so it doesn't compete with the day.",
    },
    {
      keys: ["office", "work", "professional", "meeting"],
      reply: () =>
        "For the office, pick something clean and confident — light woods, soft musks, or fresh citrus. Avoid heavy projection in shared spaces.",
    },
    {
      keys: ["gym", "workout", "sport", "running"],
      reply: () =>
        "Skip perfume during workouts — sweat changes the scent. A light deodorant or body mist works better.",
    },
    {
      keys: ["club", "night out", "party", "evening out"],
      reply: () =>
        "For a night out, go bold — sweet gourmands, intense oud, or a strong spicy-woody EDP. Strong sillage is welcome here.",
    },
    {
      keys: ["winter", "cold weather", "cold season"],
      reply: () =>
        "Winter favors warm, heavy scents — oud, amber, vanilla, leather, tobacco. They project better in cold air.",
    },
    {
      keys: ["spring", "spring time"],
      reply: () =>
        "Spring loves soft florals and green-fresh notes — rose, jasmine, fig, or a light fruity-floral EDT.",
    },
    {
      keys: ["autumn", "fall", "october", "november"],
      reply: () =>
        "For autumn try spicy-woody scents — cinnamon, sandalwood, leather, tobacco, or a soft amber.",
    },
    {
      keys: ["beach", "vacation", "holiday scent", "travel scent"],
      reply: () =>
        "For beach or vacation, cool aquatic and citrus scents win — salt, neroli, bergamot, light coconut. Easy and unobtrusive.",
    },

    // ─── How to use / care ───────────────────────────────────────────────
    {
      keys: [
        "how to apply",
        "how to spray",
        "pulse point",
        "where to spray",
        "where do i spray",
      ],
      reply: () =>
        "Spray on pulse points — wrists, neck, behind the ears, inside the elbow. Hold the bottle 15–20 cm away. Don't rub your wrists, it crushes the top notes.",
    },
    {
      keys: ["how many sprays", "too much perfume", "how much to spray"],
      reply: () =>
        "2–4 sprays for daytime, 4–6 for evening or stronger projection. EDP needs fewer sprays than EDT.",
    },
    {
      keys: [
        "store perfume",
        "storage",
        "how to store",
        "keep perfume",
        "sunlight",
        "fridge",
      ],
      reply: () =>
        "Keep perfumes in their box, away from direct sunlight, heat, and humidity. A cool dark drawer is perfect. Avoid the bathroom — steam degrades them.",
    },
    {
      keys: ["expire", "expiration", "shelf life", "go bad", "off smell"],
      reply: () =>
        "Unopened perfumes last 3–5 years. Once opened, 2–3 years is typical. Signs of going off: darker color, sour or metallic smell.",
    },
    {
      keys: ["layer", "layering", "mix perfume", "combine perfume"],
      reply: () =>
        "Layering works best when one scent is simple (a musk, vanilla, or rose) and the other has character. Apply the heavier one first, the lighter on top.",
    },
    {
      keys: ["headache", "allergy", "allergic", "sensitive skin", "irritation"],
      reply: () =>
        "If you have sensitive skin, spray on clothing instead of skin, or try an alcohol-free oil-based version. Patch-test a small area first.",
    },
    {
      keys: ["pregnant", "pregnancy", "baby"],
      reply: () =>
        "Many people prefer lighter, alcohol-light scents during pregnancy due to heightened smell sensitivity. Soft musks and clean florals are usually safest.",
    },

    // ─── Samples, sizes, decants ─────────────────────────────────────────
    {
      keys: ["sample", "tester", "try before", "smell first", "decant"],
      reply: () =>
        "Visit the boutique to test on a blotter or your skin before buying. Ask staff for a sample of any in-stock fragrance.",
    },
    {
      keys: ["size", "ml", "30ml", "50ml", "100ml", "200ml", "bottle size"],
      reply: () =>
        "Most fragrances come in 50 ml and 100 ml; some come in 30 ml or 200 ml. Bigger bottle = better price per ml.",
    },
    {
      keys: ["refill", "refillable"],
      reply: () =>
        "A few brands offer refillable bottles — ask at the boutique or check the specific product page for refill availability.",
    },
    {
      keys: ["travel size", "carry on", "airport", "100ml flight"],
      reply: () =>
        "For flights, take 30 ml or 50 ml — anything ≤100 ml fits airline carry-on liquid rules (in a clear pouch).",
    },

    // ─── Niche vs designer / vegan ───────────────────────────────────────
    {
      keys: ["niche vs", "designer vs niche", "what is niche"],
      reply: () =>
        "<b>Designer</b> houses (Dior, Chanel, YSL…) make crowd-pleasing scents at scale. <b>Niche</b> houses (Amouage, MFK, Initio…) focus on artistry, rarer notes, higher concentrations — and a higher price.",
    },
    {
      keys: ["vegan", "cruelty free", "animal", "halal perfume"],
      reply: () =>
        "Most modern perfumes use synthetic equivalents. For specifics on a brand's vegan/cruelty-free or halal status, <a href=\"contact.html\">contact us</a> and we'll check the product details for you.",
    },

    // ─── Orders, shipping, payment edge cases ────────────────────────────
    {
      keys: ["cancel order", "cancel my order", "stop my order"],
      reply: () =>
        'You can cancel before the order ships. Call <a href="tel:+970594369494">+970 59-4369494</a> or email <a href="mailto:contact@abstore.com">contact@abstore.com</a> with your order number.',
    },
    {
      keys: ["change address", "wrong address", "update shipping", "modify order"],
      reply: () =>
        'To change your shipping address or order details, contact us quickly at <a href="tel:+970594369494">+970 59-4369494</a> — we can update before dispatch.',
    },
    {
      keys: [
        "damaged",
        "broken",
        "wrong item",
        "missing item",
        "leaked",
        "leak",
      ],
      reply: () =>
        'Sorry about that! Take a photo and email it with your order number to <a href="mailto:contact@abstore.com">contact@abstore.com</a> — we treat damaged/wrong items as a priority.',
    },
    {
      keys: ["international", "outside palestine", "ship abroad", "worldwide"],
      reply: () =>
        'We focus on Palestine and nearby areas. For international requests, <a href="contact.html">contact us</a> and we will quote shipping case-by-case.',
    },
    {
      keys: ["bulk", "wholesale", "corporate", "company order", "event order"],
      reply: () =>
        'For bulk, corporate, or event orders we offer special pricing. Email <a href="mailto:contact@abstore.com">contact@abstore.com</a> with quantities and we will get back to you.',
    },
    {
      keys: ["currency", "shekel", "dollar", "euro", "price in"],
      reply: () =>
        "Prices on the site are in ILS (₪). For other currencies, ask at checkout or the boutique — we can quote in USD/EUR for international orders.",
    },
    {
      keys: ["receipt", "invoice", "tax invoice", "vat"],
      reply: () =>
        'A receipt is included with every order. For a formal tax invoice, mention it when ordering or email <a href="mailto:contact@abstore.com">contact@abstore.com</a>.',
    },

    // ─── Gifting & extras ────────────────────────────────────────────────
    {
      keys: ["gift wrap", "wrap", "gift packaging", "gift box"],
      reply: () =>
        "Yes — we can gift-wrap any order. Mention it in the order notes or ask at the boutique. Free for standard wrap.",
    },
    {
      keys: ["gift card", "voucher", "gift voucher"],
      reply: () =>
        'Gift cards in custom amounts are available at the boutique. Online gift cards are coming soon — <a href="contact.html">contact us</a> to arrange one now.',
    },
    {
      keys: ["birthday reward", "birthday gift", "birthday discount"],
      reply: () =>
        "Loyalty members get a small birthday surprise — make sure your birthday is set on your account.",
    },
    {
      keys: ["refer", "referral", "invite friend"],
      reply: () =>
        'Refer a friend at the boutique and both of you earn loyalty points on their first order. Ask staff or <a href="contact.html">contact us</a> for details.',
    },

    // ─── Marketing / community ───────────────────────────────────────────
    {
      keys: ["newsletter", "subscribe", "email list", "mailing list"],
      reply: () =>
        'Sign up at the bottom of the <a href="index.html">home page</a> to get new arrivals and exclusive offers in your inbox.',
    },
    {
      keys: ["instagram", "follow you", "social media", "facebook", "tiktok"],
      reply: () =>
        'Follow AB Store on social media for new arrivals, restocks, and offers. Links are in the <a href="index.html">footer</a> and on the <a href="contact.html">contact page</a>.',
    },
    {
      keys: ["restock", "back in stock", "out of stock", "sold out"],
      reply: () =>
        'If a perfume is sold out, <a href="contact.html">contact us</a> and we can notify you when it is restocked.',
    },

    // ─── Easter egg: best doctor ─────────────────────────────────────────
    {
      keys: ["doctor", "دكتور", "الدكتور", "مدرس", "بروف"],
      priority: true,
      reply: () =>
        "The best doctor at AB Store is <b>Dr. Sufyan Smara</b>. 🩺<br>أفضل دكتور هو <b>د. سفيان سمارة</b>.",
    },

    // ─── Easter egg: best person to talk to ──────────────────────────────
    {
      keys: [
        "best person",
        "who should i talk",
        "who to talk to",
        "who can help me best",
        "best person to talk",
        "best employee",
        "who is the best",
        "best staff",
        "best one",
        "best worker",
        "افضل شخص",
        "أفضل شخص",
        "مين افضل",
        "مين أفضل",
        "احسن شخص",
        "أحسن شخص",
        "مين احكي",
        "مين أحكي",
        "مين اسأل",
        "مين أسأل",
        "مين بساعدني",
      ],
      reply: () =>
        "The best person to talk to at AB Store is <b>Mrs. Maysoon Ahsayer</b> — she’ll take great care of you. ✨<br>أفضل شخص هو <b>الأستاذة ميسون عشاير</b> — راح تساعدك بكل شي.",
    },

    // ─── Arabic synonyms for existing topics ─────────────────────────────
    {
      keys: ["مرحبا", "مرحبتين", "اهلا", "أهلا", "هلا", "كيفك", "السلام عليكم"],
      reply: () =>
        "أهلاً وسهلاً في AB Store! اسألني عن العطور، التوصيل، الإرجاع، طرق الدفع، أو ساعات المحل.",
    },
    {
      keys: ["توصيل", "شحن", "متى يوصل", "كم يوم"],
      reply: () =>
        "التوصيل العادي خلال 2–4 أيام عمل. وفي خيار توصيل سريع لبعض الطلبات عند الدفع.",
    },
    {
      keys: ["ارجاع", "إرجاع", "استرجاع", "استرداد"],
      reply: () =>
        "بنقبل إرجاع المنتجات غير المفتوحة بعلبتها الأصلية. وأي طلب فيه عطل أو خطأ بنعالجه بأولوية.",
    },
    {
      keys: ["دفع", "كاش", "فيزا", "باي بال"],
      reply: () =>
        "بنقبل الدفع بالبطاقة، PayPal، والدفع كاش عند الاستلام للطلبات المؤهلة.",
    },
    {
      keys: ["اصلي", "أصلي", "مزور", "تقليد", "اوريجينال"],
      reply: () => "كل العطور عندنا أصلية 100% ومن موزعين موثوقين.",
    },
    {
      keys: ["دوام", "ساعات", "مفتوح", "متى تفتحوا", "متى يفتح"],
      reply: () =>
        "دوام المحل: الأحد–الخميس 10:00–20:00، السبت 10:00–16:00، والجمعة مغلق.",
    },
    {
      keys: ["عنوان", "وين المحل", "فين المحل", "مكان", "موقع المحل"],
      reply: () =>
        "محلنا في قلقيلية، الضفة الغربية، فلسطين. تفضّل تزورنا أحد–خميس 10:00–20:00.",
    },
    {
      keys: ["اتصال", "تواصل", "رقم", "ايميل", "إيميل"],
      reply: () =>
        'اتصل على <a href="tel:+970594369494">+970 59-4369494</a>، أو راسلنا <a href="mailto:contact@abstore.com">contact@abstore.com</a>، أو من <a href="contact.html">صفحة التواصل</a>.',
    },
    {
      keys: ["عطر", "عطور", "كيف اختار", "انصحني", "اقترح", "افضل عطر"],
      reply: () =>
        'قلّي شو بتحب — منعش وحامض (بركَموت، ليمون)، حلو (فانيلا)، خشبي، أو عود — وبدلّك على عيلة العطر المناسبة. أو شوف الاختيارات على <a href="products.html">صفحة المنتجات</a>.',
    },
    {
      keys: ["سيجنتشر", "عطر يومي", "عطر لكل يوم", "عطر ثابت"],
      reply: () =>
        "إذا بدك عطر سيجنتشر، اختَر شي مرن: أخشاب نظيفة، مسك ناعم، حمضيات رايقة، أو زهري مرتب. المهم يحسّسك إنه منك وإلك.",
    },
    {
      keys: ["اول عطر", "أول عطر", "مبتدئ", "لسا جديد بالعطور"],
      reply: () =>
        "إذا لسا جديد بالعطور، ابدأ بشي سهل: حمضي منعش، خشبي ناعم، أو زهري نظيف. لا تبدأ بعود دخاني ثقيل أو حلاوة قوية كثير.",
    },
    {
      keys: ["يلفت", "ملفت", "مجاملة", "يعجب الناس", "فواح حلو"],
      reply: () =>
        "العطر الملفت عادة بكون منعش مرتب، أو حلو بشكل موزون، أو خشبي ناعم بثبات جيد. الفكرة يبين، مش يزعج.",
    },
    {
      keys: ["بلايند باي", "شراء بدون تجربة", "عطر آمن"],
      reply: () =>
        "للشراء بدون تجربة، خلك مع الخيارات السهلة: حمضيات، مسك نظيف، فانيلا هادئة، أو زهري مرن. والأفضل تجرّبه على الجلد إذا قدرت.",
    },
    {
      keys: ["قوي كثير", "فواح كثير", "ثبات قوي", "وحش"],
      reply: () =>
        "إذا بدك أداء قوي، دور على EDP أو Parfum غني فيه عنبر، عود، فانيلا، أخشاب أو بهارات. بس خفف عدد الرشات.",
    },
    {
      keys: ["خفيف", "ناعم", "مش قوي", "هادئ"],
      reply: () =>
        "إذا بدك عطر هادي، خلك مع الحمضيات، النيرولي، الشاي، المسك الخفيف، أو الأزهار الهوائية. مرتب بدون ما يسيطر على المكان.",
    },
    {
      keys: ["طالب", "جامعة", "صغير", "مراهق"],
      reply: () =>
        "للجامعة أو العمر الأصغر، العطور الفاكهية المنعشة، الحمضيات الرياضية، أو الحلاوة النظيفة عادةً بتزبط أكثر.",
    },
    {
      keys: ["راقي", "كلاس", "كلاسي", "ناضج", "فخم"],
      reply: () =>
        "إذا بدك إحساس راقي، جرّب أخشاب مصقولة، آيرس، جلد ناعم، ورد، عنبر، أو مسك مرتب. النعومة الذكية أقوى من الصراخ.",
    },
    {
      keys: ["رجالي", "للرجال", "للشباب"],
      async: true,
      reply: () =>
        productIntent(
          "أفضل العطور الرجالية",
          (p) => p.category === "him",
          'ما في عطور محمّلة لسا — جرّب <a href="products.html?category=him">قسم الرجال</a>.',
        ),
    },
    {
      keys: ["نسائي", "للنساء", "للبنات", "حريمي"],
      async: true,
      reply: () =>
        productIntent(
          "أفضل العطور النسائية",
          (p) => p.category === "her",
          'ما في عطور محمّلة لسا — جرّب <a href="products.html?category=her">قسم النساء</a>.',
        ),
    },
    {
      keys: ["نقاط", "ولاء", "مكافآت", "عضوية"],
      reply: () =>
        'في برنامج ولاء عندنا فيه مستويات (برونزي، فضي، ذهبي وأعلى). سجّل دخول وافتح <a href="loyalty.html">صفحة الولاء</a> لتشوف نقاطك ومكافآتك.',
    },
    {
      keys: ["تسجيل", "حساب", "دخول", "سجل"],
      reply: () =>
        '<a href="login.html">سجّل دخول</a> أو <a href="auth/register.php">أنشئ حساب</a> لتتبع طلباتك واكتساب نقاط الولاء.',
    },
    {
      keys: ["شكرا", "شكراً", "مشكور", "يعطيك العافية"],
      reply: () => "العفو! حابب أساعدك بأي شي تاني؟",
    },
    {
      keys: ["مع السلامة", "باي", "الى اللقاء", "إلى اللقاء"],
      reply: () => "يعطيك العافية — يومك معطّر! 🌸",
    },

    // ─── Arabic: more scenarios ──────────────────────────────────────────
    {
      keys: ["موعد", "رومانسي", "عشاء", "حبيبتي", "حبيبي"],
      reply: () =>
        "للموعد جرّب عطر دافئ وحلو — فانيلا، عنبر، ورد، أو عود ناعم. تركيز EDP بضل معك طول السهرة.",
    },
    {
      keys: ["عرس", "زفاف", "عريس", "عروس"],
      reply: () =>
        "للعرس اختر عطر راقي ومميز — ورد، عود، أزهار بيضا، أو خشبي–عنبري. رشّ خفيف حتى ما يطغى.",
    },
    {
      keys: ["شغل", "دوام", "مكتب", "اجتماع"],
      reply: () =>
        "للدوام اختر شي نظيف وهادي — أخشاب خفيفة، مسك ناعم، أو حمضي منعش. تجنّب العطور القوية بالأماكن المغلقة.",
    },
    {
      keys: ["نادي", "سهرة", "حفلة", "خروج بالليل"],
      reply: () =>
        "للسهرة جرّب شي قوي — حلو غورماند، عود كثيف، أو خشبي حار EDP. هون الانتشار القوي مطلوب.",
    },
    {
      keys: ["شتا", "شتاء", "برد", "موسم بارد"],
      reply: () =>
        "بالشتاء حلوة العطور الدافئة الثقيلة — عود، عنبر، فانيلا، جلد، تبغ. بتنتشر أحسن بالجو البارد.",
    },
    {
      keys: ["صيف", "حر", "بحر", "اجازة"],
      reply: () =>
        "بالصيف خفّف — عطور مائية وحمضية، نيرولي، برغموت، وملح بحر. خفيفة ومريحة.",
    },
    {
      keys: ["خريف", "ربيع"],
      reply: () =>
        "بالخريف جرّب الخشبي–الحار (قرفة، صندل، جلد). بالربيع الأزهار الناعمة والأخضر الطازج.",
    },
    {
      keys: ["كيف ارش", "كيف أرش", "وين ارش", "وين أرش", "طريقة الرش"],
      reply: () =>
        "ارشّ على نقاط النبض — الرسغ، الرقبة، خلف الأذن، داخل الكوع. خلّي البخاخ على بعد 15–20 سم. ما تفرك معاصمك، بتكسر النفحات الأولى.",
    },
    {
      keys: ["كم رشة", "عدد الرشات"],
      reply: () =>
        "2–4 رشات بالنهار، و4–6 بالليل أو لما تبغى انتشار أقوى. EDP يكفي منها أقل من EDT.",
    },
    {
      keys: ["تخزين", "وين بحط العطر", "كيف اخزن", "كيف أخزن", "شمس"],
      reply: () =>
        "احفظ العطر بعلبته الأصلية، بعيد عن الشمس والحرارة والرطوبة. درج بارد ومظلم مثالي. تجنّب الحمام — البخار بضرّه.",
    },
    {
      keys: ["انتهاء", "انتهت الصلاحية", "العمر الافتراضي", "خرب العطر"],
      reply: () =>
        "العطر المغلق بعمر 3–5 سنين. بعد ما تفتحه، 2–3 سنين عادة. علامات الفساد: لون أغمق، أو ريحة حامضة/معدنية.",
    },
    {
      keys: ["دمج", "خلط عطور", "لايرنغ", "طبقات"],
      reply: () =>
        "الدمج بطلع حلو لما واحد من العطرين بسيط (مسك، فانيلا، ورد) والتاني فيه شخصية. حطّ الأثقل أول وبعدين الأخف.",
    },
    {
      keys: ["حساسية", "حساس", "حامل", "حمل"],
      reply: () =>
        "للبشرة الحساسة جرّب الرش على الملابس بدل الجلد، أو نسخة زيتية خالية من الكحول. اختبر منطقة صغيرة أول.",
    },
    {
      keys: ["عينة", "تستر", "اجرب قبل", "أجرب قبل", "ديكانت"],
      reply: () =>
        "تفضّل على المحل واطلب من الفريق تجربة العطر على ورقة أو على بشرتك قبل ما تشتري.",
    },
    {
      keys: ["حجم", "مل", "30 مل", "50 مل", "100 مل", "زجاجة"],
      reply: () =>
        "أغلب العطور بتيجي 50 و100 مل، وبعضها 30 أو 200 مل. كل ما كبر الحجم، السعر للمل أرخص.",
    },
    {
      keys: ["إلغاء", "الغاء طلب", "إلغاء طلب", "ابطل طلبي"],
      reply: () =>
        'تقدر تلغي الطلب قبل ما يطلع للشحن. اتصل على <a href="tel:+970594369494">+970 59-4369494</a> أو راسلنا <a href="mailto:contact@abstore.com">contact@abstore.com</a> مع رقم طلبك.',
    },
    {
      keys: ["تعديل طلب", "تغيير عنوان", "غلط بالعنوان"],
      reply: () =>
        'لتغيير عنوان أو تفاصيل الطلب، اتصل بسرعة على <a href="tel:+970594369494">+970 59-4369494</a> قبل الشحن.',
    },
    {
      keys: ["تالف", "مكسور", "منتج خطأ", "منتج غلط", "ناقص", "مسرّب"],
      reply: () =>
        'آسفين على هالشي! خذ صورة وابعتها مع رقم الطلب على <a href="mailto:contact@abstore.com">contact@abstore.com</a> — بنعالج الحالات هاي بأولوية.',
    },
    {
      keys: ["شحن دولي", "خارج فلسطين", "للخارج"],
      reply: () =>
        'تركيزنا على فلسطين والمناطق القريبة. للطلبات الخارجية <a href="contact.html">تواصل معنا</a> ومنعطيك سعر شحن خاص.',
    },
    {
      keys: ["جملة", "كميات", "شركات", "حفلة كبيرة"],
      reply: () =>
        'في أسعار خاصة للجملة والشركات والمناسبات. ابعتلنا الكميات على <a href="mailto:contact@abstore.com">contact@abstore.com</a>.',
    },
    {
      keys: ["فاتورة", "وصل", "ضريبة"],
      reply: () =>
        'بكل طلب في وصل. لو بدك فاتورة ضريبية رسمية، خبّرنا وقت الطلب أو راسلنا <a href="mailto:contact@abstore.com">contact@abstore.com</a>.',
    },
    {
      keys: ["تغليف هدية", "تغليف", "علبة هدية"],
      reply: () =>
        "بنغلف الطلب كهدية مجاناً. اطلب هيك بالملاحظات أو بالمحل.",
    },
    {
      keys: ["كرت هدية", "بطاقة هدية", "قسيمة"],
      reply: () =>
        'بطاقات الهدايا بمبالغ مرنة متوفرة بالمحل. النسخة الأونلاين قريباً — <a href="contact.html">تواصل معنا</a> لترتيب وحدة الآن.',
    },
    {
      keys: ["عيد ميلاد", "هدية ميلاد"],
      reply: () =>
        "أعضاء برنامج الولاء بياخدوا مفاجأة صغيرة بعيد ميلادهم — تأكد إنّ تاريخ ميلادك مسجّل بحسابك.",
    },
    {
      keys: ["نشرة", "اشتراك بريد", "ايميل اخبار"],
      reply: () =>
        'سجّل بأسفل <a href="index.html">الصفحة الرئيسية</a> لتوصلك الجديدات والعروض الحصرية.',
    },
    {
      keys: ["انستغرام", "انستقرام", "فيسبوك", "تيك توك", "سوشيال"],
      reply: () =>
        'تابعنا على وسائل التواصل لتشوف الجديدات والعروض. الروابط في <a href="index.html">الفوتر</a> و<a href="contact.html">صفحة التواصل</a>.',
    },
    {
      keys: ["نفد", "خلص المخزون", "غير متوفر", "متى يرجع"],
      reply: () =>
        'لو العطر نافد، <a href="contact.html">تواصل معنا</a> ومنخبرك لما يرجع.',
    },
  ];

  const quickChips = [
    "Best perfumes for men",
    "Best perfumes for women",
    "Top rated picks",
    "On sale",
    "Fresh office perfume under 300",
    "Perfume for a date",
    "Gift perfume for my wife",
    "50 ml Dior under 500",
    "Strong winter oud",
    "Soft everyday perfume",
    "I need a signature scent",
    "How to apply perfume",
    "How to store perfume",
    "Cancel my order",
    "Gift wrap",
    "Delivery options",
    "Boutique hours",
  ];

  // Precompute normalized keys once
  let _intentsIndex = null;
  function intentsIndex() {
    if (_intentsIndex) return _intentsIndex;
    _intentsIndex = intents.map((intent) => ({
      intent,
      keys: intent.keys.map((k) => ({ raw: k, norm: normalize(k) })).filter((k) => k.norm),
    }));
    return _intentsIndex;
  }

  function matchIntent(text) {
    const n = paddedNormal(text);
    const idx = intentsIndex();

    // Priority intents win on any word-boundary match.
    for (const { intent, keys } of idx) {
      if (!intent.priority) continue;
      for (const { norm } of keys) {
        if (n.includes(" " + norm + " ")) return intent;
      }
    }

    let best = null;
    let bestScore = 0;
    for (const { intent, keys } of idx) {
      for (const { norm } of keys) {
        const padded = " " + norm + " ";
        const wordMatch = n.includes(padded);
        const isShort = norm.length <= 4 || !norm.includes(" ");
        // Short keys MUST hit a word boundary so "man" doesn't match "manage".
        // Multi-word longer keys can also match as a substring.
        const matched = isShort ? wordMatch : (wordMatch || n.includes(norm));
        if (!matched) continue;
        const score = norm.length + (wordMatch ? 3 : 0) + (norm.includes(" ") ? 2 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = intent;
        }
      }
    }
    return best;
  }

  // Soft suggestions for the fallback bubble: rank intents by token overlap.
  function suggestIntents(text, max) {
    const tokens = normalize(text)
      .split(" ")
      .filter((t) => t.length >= 3);
    if (!tokens.length) return [];
    const idx = intentsIndex();
    const scored = [];
    const seen = new Set();
    for (const { intent, keys } of idx) {
      if (seen.has(intent)) continue;
      let score = 0;
      let bestLabel = intent.keys[0];
      for (const { raw, norm } of keys) {
        for (const t of tokens) {
          if (norm.includes(t)) {
            score += t.length;
            if (norm.length < normalize(bestLabel).length || !bestLabel) bestLabel = raw;
          } else if (t.length >= 4 && norm.length >= 4 && norm.slice(0, 3) === t.slice(0, 3)) {
            score += 1;
          }
        }
      }
      if (score > 0) {
        seen.add(intent);
        scored.push({ intent, score, label: bestLabel });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max || 3);
  }

  function fallback(text) {
    const suggestions = suggestIntents(text, 3);
    if (!suggestions.length) {
      return 'I’m a small bot focused on AB Store — try asking about delivery, returns, payment, boutique hours, perfume picks, or how to choose a fragrance. <a href="contact.html">Contact us</a> for anything else.<br><br>أنا بوت صغير خاص بموقع AB Store — جرّب تسأل عن التوصيل، الإرجاع، الدفع، ساعات المحل، أو كيف تختار عطر.';
    }
    return `I’m not sure I got that — did you mean:${renderSuggestionButtons(suggestions.map((s) => s.label))}`;
  }

  const panel = document.createElement("div");
  panel.className = "float-chatbot";
  panel.setAttribute("aria-hidden", "true");
  panel.innerHTML = `
    <div class="float-chatbot-card">
      <div class="float-chatbot-header">
        <div class="float-chatbot-brand">
          <img src="images/logo.webp" alt="AB Store assistant" class="float-chatbot-brand-logo">
          <div>
            <p class="float-chatbot-kicker">AB Store Assistant</p>
            <h3>Ask me anything</h3>
          </div>
        </div>
        <div class="float-chatbot-header-actions">
          <button type="button" class="float-chatbot-icon-btn float-chatbot-clear" aria-label="Clear chat" title="Clear chat">
            <i class="bi bi-trash3"></i>
          </button>
          <button type="button" class="float-chatbot-icon-btn float-chatbot-close" aria-label="Close assistant" title="Close">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
      </div>
      <div class="float-chatbot-body">
        <div class="float-chatbot-history" id="floatChatbotHistory" role="log" aria-live="polite"></div>
        <div class="float-chatbot-faqs" id="floatChatbotChips"></div>
      </div>
      <form class="float-chatbot-input" autocomplete="off">
        <input
          type="text"
          name="message"
          class="float-chatbot-text"
          placeholder="Ask about a perfume, delivery, returns…"
          aria-label="Message AB Store assistant"
          maxlength="240">
        <button type="submit" class="float-chatbot-send" aria-label="Send message">
          <i class="bi bi-send-fill"></i>
        </button>
      </form>
    </div>
  `;

  const history = panel.querySelector("#floatChatbotHistory");
  const chips = panel.querySelector("#floatChatbotChips");
  const form = panel.querySelector(".float-chatbot-input");
  const input = panel.querySelector(".float-chatbot-text");
  const closeBtn = panel.querySelector(".float-chatbot-close");
  const clearBtn = panel.querySelector(".float-chatbot-clear");

  history.addEventListener("click", (event) => {
    const suggestion = event.target.closest(".float-chatbot-suggestion");
    if (suggestion) {
      event.preventDefault();
      send(suggestion.dataset.text || suggestion.textContent || "");
      return;
    }
    onProductCardClick(event);
  });

  function saveHistory() {
    try {
      const bubbles = Array.from(history.children)
        .filter((el) => !el.classList.contains("float-chatbot-typing"))
        .slice(-MAX_HISTORY)
        .map((el) => ({
          who: el.classList.contains("float-chatbot-bubble-user") ? "user" : "assistant",
          html: el.innerHTML,
        }));
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(bubbles));
    } catch (_) {}
  }

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const bubbles = JSON.parse(raw);
      if (!Array.isArray(bubbles) || !bubbles.length) return false;
      for (const b of bubbles) addBubble(b.html, b.who, { persist: false });
      return true;
    } catch (_) {
      return false;
    }
  }

  function addBubble(text, who, opts) {
    const bubble = document.createElement("div");
    bubble.className = "float-chatbot-bubble float-chatbot-bubble-" + who;
    bubble.innerHTML = text;
    history.appendChild(bubble);
    history.scrollTop = history.scrollHeight;
    if (!opts || opts.persist !== false) saveHistory();
    return bubble;
  }

  function addTyping() {
    const bubble = document.createElement("div");
    bubble.className =
      "float-chatbot-bubble float-chatbot-bubble-assistant float-chatbot-typing";
    bubble.innerHTML = "<span></span><span></span><span></span>";
    history.appendChild(bubble);
    history.scrollTop = history.scrollHeight;
    return bubble;
  }

  async function send(text) {
    const clean = text.trim();
    if (!clean) return;
    addBubble(escapeHtml(clean), "user");

    // Refinements on the last product list take priority over intent match.
    const refinement = await tryRefinement(clean);
    if (refinement) {
      setTimeout(() => addBubble(refinement, "assistant"), 180);
      return;
    }

    const advisorProfile = analyzeAdvisorRequest(clean);
    if (advisorProfile) {
      chatState.advisorProfile = cloneProfile(advisorProfile.profile);
      chatState.awaitingAdvisor = advisorProfile.kind === "clarify";
      if (advisorProfile.kind === "clarify") {
        setTimeout(() => addBubble(buildAdvisorClarifier(advisorProfile.profile), "assistant"), 180);
        return;
      }
      const typing = addTyping();
      try {
        const answer = await buildAdvisorReply(advisorProfile.profile);
        typing.classList.remove("float-chatbot-typing");
        typing.innerHTML = answer;
        chatState.awaitingAdvisor = false;
      } catch (_) {
        typing.classList.remove("float-chatbot-typing");
        typing.innerHTML = advisorProfile.arabic
          ? "صار خطأ بسيط وأنا بجهز الترشيحات. جرّب مرة ثانية بعد لحظة."
          : "I hit a small snag while building those picks. Please try again in a moment.";
      }
      history.scrollTop = history.scrollHeight;
      saveHistory();
      return;
    }

    const intent = matchIntent(clean);
    if (!intent) {
      setTimeout(() => addBubble(fallback(clean), "assistant"), 220);
      return;
    }
    chatState.awaitingAdvisor = false;
    if (intent.async) {
      const typing = addTyping();
      try {
        const answer = await intent.reply();
        typing.classList.remove("float-chatbot-typing");
        typing.innerHTML = answer;
      } catch (e) {
        typing.classList.remove("float-chatbot-typing");
        typing.innerHTML = "Sorry, I couldn’t load that right now.";
      }
      history.scrollTop = history.scrollHeight;
      saveHistory();
    } else {
      setTimeout(() => addBubble(intent.reply(), "assistant"), 220);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  quickChips.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "float-chatbot-faq";
    button.textContent = label;
    button.addEventListener("click", () => send(label));
    chips.appendChild(button);
  });

  const hadHistory = loadHistory();
  if (!hadHistory) {
    addBubble(
      "Welcome to AB Store. I can help with perfumes, delivery, returns and more — and if your perfume request is vague, I’ll ask a couple of quick follow-up questions like a tiny scent advisor. After a product list you can say <b>more</b>, <b>cheaper</b>, <b>pricier</b>, or <b>under 300</b> to refine.",
      "assistant",
    );
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value;
    input.value = "";
    send(value);
  });

  clearBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    lastProductCtx = null;
    resetChatState();
    history.innerHTML = "";
    try { sessionStorage.removeItem(STORAGE_KEY); } catch (_) {}
    addBubble(
      "Cleared. What would you like to know next?",
      "assistant",
    );
    input.focus();
  });

  document.body.appendChild(panel);

  function setOpen(open) {
    floatLogo.classList.toggle("float-open", open);
    panel.classList.toggle("is-open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    if (open) setTimeout(() => input.focus(), 200);
  }

  function syncVisibility() {
    floatLogo.classList.add("float-visible");
  }

  floatLogo.addEventListener("click", (event) => {
    event.preventDefault();
    setOpen(!panel.classList.contains("is-open"));
    syncVisibility();
  });

  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(false);
    syncVisibility();
  });

  document.addEventListener("click", (event) => {
    if (!panel.classList.contains("is-open")) return;
    if (panel.contains(event.target) || floatLogo.contains(event.target))
      return;
    setOpen(false);
    syncVisibility();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      syncVisibility();
    }
  });

  window.addEventListener("scroll", syncVisibility);
  syncVisibility();
})();
