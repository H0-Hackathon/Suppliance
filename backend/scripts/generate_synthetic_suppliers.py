"""
CoastGuard — Generate 15,000 additional synthetic suppliers and seed to Aurora.
Total target: 25,000 (existing 10,000 + this 15,000).

Run from backend/ directory:
    .venv\Scripts\python.exe scripts/generate_synthetic_suppliers.py
"""

import sys, pathlib, random, logging, math
from datetime import datetime, timedelta

BACKEND_DIR = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import SessionLocal, engine
from models import Base, GlobalSupplier

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 500
START_ID   = 10001   # SUP010001 → SUP025000

# ── Reference data ─────────────────────────────────────────────────────────────

COUNTRIES_WEIGHTED = [
    # (country, weight, [cities])
    ("China", 18, ["Shanghai", "Guangzhou", "Shenzhen", "Beijing", "Chengdu", "Hangzhou", "Nanjing", "Wuhan"]),
    ("India", 14, ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad", "Surat", "Ahmedabad"]),
    ("Germany", 5, ["Hamburg", "Berlin", "Munich", "Frankfurt", "Düsseldorf", "Cologne", "Stuttgart"]),
    ("Turkey", 5, ["Istanbul", "Ankara", "Izmir", "Bursa", "Gaziantep"]),
    ("Vietnam", 5, ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Can Tho"]),
    ("Bangladesh", 4, ["Dhaka", "Chittagong", "Rajshahi", "Comilla"]),
    ("Pakistan", 4, ["Karachi", "Lahore", "Faisalabad", "Sialkot", "Peshawar"]),
    ("Indonesia", 4, ["Jakarta", "Surabaya", "Bandung", "Medan", "Semarang"]),
    ("Italy", 3, ["Milan", "Rome", "Florence", "Bologna", "Naples", "Turin"]),
    ("South Korea", 3, ["Seoul", "Busan", "Incheon", "Daegu", "Gwangju"]),
    ("Taiwan", 3, ["Taipei", "Kaohsiung", "Taichung", "Tainan"]),
    ("Malaysia", 3, ["Kuala Lumpur", "Penang", "Johor Bahru", "Petaling Jaya"]),
    ("Thailand", 3, ["Bangkok", "Chiang Mai", "Pattaya", "Rayong"]),
    ("Brazil", 3, ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Porto Alegre"]),
    ("Mexico", 3, ["Mexico City", "Monterrey", "Guadalajara", "Tijuana", "Puebla"]),
    ("Poland", 2, ["Warsaw", "Kraków", "Gdańsk", "Poznań", "Wrocław"]),
    ("Romania", 2, ["Bucharest", "Cluj-Napoca", "Timișoara", "Iași"]),
    ("Egypt", 2, ["Cairo", "Alexandria", "Giza", "Port Said"]),
    ("Morocco", 2, ["Casablanca", "Rabat", "Marrakech", "Tangier", "Fez"]),
    ("South Africa", 2, ["Johannesburg", "Cape Town", "Durban", "Pretoria"]),
    ("Nigeria", 2, ["Lagos", "Abuja", "Kano", "Port Harcourt"]),
    ("Kenya", 2, ["Nairobi", "Mombasa", "Kisumu", "Nakuru"]),
    ("Ethiopia", 2, ["Addis Ababa", "Dire Dawa", "Gondar"]),
    ("Philippines", 2, ["Manila", "Cebu", "Davao", "Quezon City"]),
    ("Cambodia", 2, ["Phnom Penh", "Siem Reap", "Battambang"]),
    ("Sri Lanka", 2, ["Colombo", "Kandy", "Galle", "Jaffna"]),
    ("Portugal", 1, ["Lisbon", "Porto", "Braga", "Coimbra"]),
    ("Spain", 1, ["Barcelona", "Madrid", "Valencia", "Seville"]),
    ("Netherlands", 1, ["Amsterdam", "Rotterdam", "The Hague", "Eindhoven"]),
    ("France", 1, ["Paris", "Lyon", "Marseille", "Toulouse", "Bordeaux"]),
    ("United Kingdom", 1, ["London", "Birmingham", "Manchester", "Leeds"]),
    ("Czech Republic", 1, ["Prague", "Brno", "Ostrava"]),
    ("Hungary", 1, ["Budapest", "Debrecen", "Pécs"]),
    ("Argentina", 1, ["Buenos Aires", "Córdoba", "Rosario", "Mendoza"]),
    ("Colombia", 1, ["Bogotá", "Medellín", "Cali", "Barranquilla"]),
    ("Peru", 1, ["Lima", "Arequipa", "Trujillo"]),
    ("Japan", 1, ["Tokyo", "Osaka", "Nagoya", "Fukuoka"]),
    ("Australia", 1, ["Sydney", "Melbourne", "Brisbane", "Perth"]),
    ("United States", 1, ["New York", "Los Angeles", "Chicago", "Houston", "Miami"]),
    ("Canada", 1, ["Toronto", "Vancouver", "Montreal", "Calgary"]),
    ("Saudi Arabia", 1, ["Riyadh", "Jeddah", "Dammam", "Mecca"]),
    ("UAE", 1, ["Dubai", "Abu Dhabi", "Sharjah", "Ajman"]),
    ("Russia", 1, ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg"]),
    ("Kazakhstan", 1, ["Almaty", "Nur-Sultan", "Shymkent"]),
    ("Ghana", 1, ["Accra", "Kumasi", "Tamale"]),
    ("Tanzania", 1, ["Dar es Salaam", "Arusha", "Mwanza"]),
    ("Myanmar", 1, ["Yangon", "Mandalay", "Naypyidaw"]),
    ("Nepal", 1, ["Kathmandu", "Pokhara", "Lalitpur"]),
    ("Chile", 1, ["Santiago", "Valparaíso", "Concepción"]),
    ("Ecuador", 1, ["Quito", "Guayaquil", "Cuenca"]),
]

CATEGORIES_WEIGHTED = [
    ("Textiles & Apparel", 14),
    ("Agriculture & Food Products", 12),
    ("Metals & Minerals", 10),
    ("Machinery & Industrial Equipment", 9),
    ("Electronics & Electrical", 8),
    ("Chemicals & Petrochemicals", 7),
    ("Leather Goods", 6),
    ("Construction Materials", 6),
    ("Automotive Parts", 5),
    ("Handicrafts & Home Decor", 4),
    ("Seafood & Marine Products", 4),
    ("Furniture & Wood Products", 4),
    ("Cosmetics & Personal Care", 3),
    ("Medical & Healthcare", 3),
    ("Jewellery & Accessories", 3),
    ("Paper & Packaging", 3),
    ("Sports & Outdoor", 2),
    ("Beverages", 2),
    ("Toys & Games", 2),
    ("Jewelry & Gemstones", 2),
]

BUSINESS_TYPES = [
    "Manufacturer", "Manufacturer & Exporter", "Trading Company",
    "Wholesaler", "Distributor", "Factory",
    "Manufacturer & Distributor", "Exporter",
]

EXPORT_MARKETS_POOL = [
    "Middle East", "South Asia", "Western Europe", "Eastern Europe",
    "Southeast Asia", "North America", "South America",
    "Sub-Saharan Africa", "North Africa", "East Asia", "Oceania", "CIS Countries",
]

CERTIFICATIONS_POOL = [
    "ISO 9001", "ISO 14001", "ISO 22000", "CE Certified", "WRAP Certified",
    "BSCI Certified", "SEDEX", "Fair Trade Certified", "Organic Certified",
    "Halal Certified", "Kosher Certified", "SA8000", "OEKO-TEX",
    "GMP Certified", "FDA Approved", "FSSAI", "RoHS Compliant",
]

PAYMENT_TERMS = [
    "Letter of Credit (L/C)", "Telegraphic Transfer (T/T)", "Net 30 Days",
    "Net 60 Days", "Net 90 Days", "Cash in Advance", "D/P at Sight",
    "Open Account", "Documentary Collection",
]

PRODUCTS_BY_CAT = {
    "Textiles & Apparel": ["Cotton Fabric", "Polyester Fabric", "Denim", "Knitwear", "Garments", "Sportswear", "Uniforms", "T-Shirts", "Woven Fabric", "Yarn"],
    "Agriculture & Food Products": ["Rice", "Wheat", "Spices", "Pulses", "Sugar", "Tea", "Coffee", "Dried Fruits", "Grains", "Nuts", "Honey", "Flour", "Palm Oil"],
    "Metals & Minerals": ["Steel", "Aluminum", "Copper", "Iron Ore", "Stainless Steel", "Zinc", "Lead", "Chrome", "Brass", "Titanium"],
    "Machinery & Industrial Equipment": ["CNC Machines", "Hydraulic Pumps", "Conveyor Belts", "Industrial Motors", "Compressors", "Packaging Machines", "Printing Machines", "Welding Equipment"],
    "Electronics & Electrical": ["PCB Boards", "LED Lights", "Solar Panels", "Transformers", "Cables", "Semiconductors", "Switches", "Capacitors", "Power Supplies"],
    "Chemicals & Petrochemicals": ["Industrial Chemicals", "Fertilizers", "Paints", "Lubricants", "Adhesives", "Plastic Pellets", "Solvents", "Resins"],
    "Leather Goods": ["Leather Bags", "Belts", "Wallets", "Shoes", "Leather Jackets", "Gloves", "Leather Upholstery"],
    "Construction Materials": ["Cement", "Steel Rods", "Tiles", "Marble", "Granite", "Bricks", "Roofing Sheets", "PVC Pipes", "Plywood"],
    "Automotive Parts": ["Engine Parts", "Brake Pads", "Filters", "Radiators", "Bearings", "Gears", "Pistons", "Shock Absorbers"],
    "Handicrafts & Home Decor": ["Wooden Crafts", "Ceramic Pots", "Textiles Art", "Metal Decor", "Candles", "Baskets", "Rugs", "Tapestries"],
    "Seafood & Marine Products": ["Shrimp", "Fish Fillets", "Crab Meat", "Lobster", "Dried Fish", "Fish Meal", "Squid", "Tuna"],
    "Furniture & Wood Products": ["Wooden Chairs", "Tables", "Sofas", "Cabinets", "Doors", "Flooring", "Plywood", "MDF Boards"],
    "Cosmetics & Personal Care": ["Skincare Products", "Hair Care", "Essential Oils", "Soap", "Perfumes", "Makeup"],
    "Medical & Healthcare": ["Medical Devices", "PPE", "Surgical Instruments", "Pharmaceuticals", "Hospital Equipment", "Gloves"],
    "Jewellery & Accessories": ["Gold Jewellery", "Silver Jewellery", "Gemstones", "Fashion Jewellery", "Watches", "Accessories"],
    "Paper & Packaging": ["Cartons", "Wrapping Paper", "Paper Bags", "Corrugated Boxes", "Labels", "Tissue Paper"],
    "Sports & Outdoor": ["Footballs", "Cricket Gear", "Camping Equipment", "Sports Apparel", "Bicycles", "Yoga Mats"],
    "Beverages": ["Fruit Juices", "Energy Drinks", "Mineral Water", "Tea Extracts", "Coffee", "Wine", "Soft Drinks"],
    "Toys & Games": ["Plastic Toys", "Wooden Toys", "Board Games", "Stuffed Animals", "Educational Toys"],
    "Jewelry & Gemstones": ["Diamond Rings", "Gold Jewelry", "Precious Stones", "Costume Jewelry", "Silver Jewelry"],
}

COMPANY_SUFFIXES = [
    "Co.", "Ltd.", "Inc.", "Corp.", "GmbH", "S.A.", "Trading Co.", "Industries",
    "Exports", "International", "Group", "Holdings", "Manufacturing", "Enterprises",
    "Solutions", "Global", "Worldwide", "Brothers", "Associates", "Partners",
    "Resources", "Commodities", "Supply Chain", "Logistics", "Ventures",
]

FIRST_WORDS = [
    "Alpha", "Beta", "Delta", "Gamma", "Prime", "Apex", "Eagle", "Summit",
    "Global", "Pacific", "Atlantic", "Royal", "Imperial", "Grand", "Standard",
    "Pioneer", "Precision", "Premier", "Superior", "Elite", "Sterling",
    "United", "Alliance", "Metro", "National", "Central", "Eastern", "Western",
    "Northern", "Southern", "Star", "Crown", "Golden", "Silver", "Diamond",
    "Crystal", "Bright", "Swift", "Rapid", "Dynamic", "Strategic", "Advanced",
    "Eco", "Green", "Smart", "Tech", "Pro", "Max", "Ultra", "Mega", "Agro",
    "Marine", "Forest", "Sky", "Rock", "Iron", "Steel", "Copper", "Silk",
    "Lotus", "Phoenix", "Dragon", "Tiger", "Lion", "Falcon", "Hawk", "Raven",
    "Continental", "Transatlantic", "Intercontinental", "Meridian", "Zenith",
]

SECOND_WORDS = [
    "Trade", "Export", "Import", "Supply", "Source", "Link", "Bridge", "Gate",
    "Port", "Cargo", "Freight", "Commerce", "Market", "Exchange", "Connect",
    "Textile", "Metal", "Agri", "Chemical", "Industrial", "Pharma", "Food",
    "Tech", "Build", "Craft", "Make", "Forge", "Mill", "Farm", "Mine",
    "Sea", "Land", "Air", "Rail", "Road", "Silk", "Spice", "Grain",
    "Fiber", "Steel", "Alloy", "Mineral", "Stone", "Wood", "Leather",
]


def weighted_choice(choices):
    """Pick from [(item, weight)] list."""
    items = [c[0] for c in choices]
    weights = [c[1] for c in choices]
    return random.choices(items, weights=weights, k=1)[0]


def random_company_name():
    style = random.randint(0, 3)
    if style == 0:
        return f"{random.choice(FIRST_WORDS)} {random.choice(SECOND_WORDS)} {random.choice(COMPANY_SUFFIXES)}"
    elif style == 1:
        return f"{random.choice(FIRST_WORDS)} {random.choice(FIRST_WORDS)} {random.choice(COMPANY_SUFFIXES)}"
    elif style == 2:
        return f"{random.choice(SECOND_WORDS)}Corp {random.choice(COMPANY_SUFFIXES)}"
    else:
        return f"{random.choice(FIRST_WORDS)} {random.choice(COMPANY_SUFFIXES)}"


def random_email(company_name: str) -> str:
    prefix = random.choice(["info", "export", "sales", "contact", "trade", "enquiry"])
    domain_base = company_name.lower().replace(" ", "").replace(".", "")[:16]
    tld = random.choice(["com", "net", "org", "co", "biz"])
    return f"{prefix}@{domain_base}.{tld}"


def random_website(company_name: str) -> str:
    domain = company_name.lower().replace(" ", "").replace(".", "")[:20]
    tld = random.choice(["com", "net", "co", "org"])
    return f"www.{domain}.{tld}"


def random_phone(country: str) -> str:
    codes = {
        "China": "+86", "India": "+91", "Germany": "+49", "Turkey": "+90",
        "Vietnam": "+84", "Bangladesh": "+880", "Pakistan": "+92",
        "Indonesia": "+62", "Italy": "+39", "South Korea": "+82",
        "Malaysia": "+60", "Thailand": "+66", "Brazil": "+55",
        "Mexico": "+52", "Poland": "+48", "Romania": "+40",
        "Egypt": "+20", "Morocco": "+212", "South Africa": "+27",
        "Nigeria": "+234", "Kenya": "+254", "Philippines": "+63",
        "United States": "+1", "Canada": "+1", "Saudi Arabia": "+966",
        "UAE": "+971", "Russia": "+7", "Japan": "+81",
        "Australia": "+61", "United Kingdom": "+44", "France": "+33",
        "Spain": "+34", "Netherlands": "+31", "Taiwan": "+886",
    }
    code = codes.get(country, "+1")
    number = "-".join([
        str(random.randint(1000, 9999)),
        str(random.randint(10000, 99999)),
    ])
    return f"{code}-{number}"


def random_markets(n=None) -> str:
    n = n or random.randint(2, 5)
    return ", ".join(random.sample(EXPORT_MARKETS_POOL, min(n, len(EXPORT_MARKETS_POOL))))


def random_certifications() -> str:
    n = random.randint(1, 4)
    return ", ".join(random.sample(CERTIFICATIONS_POOL, n))


def random_products(category: str) -> str:
    pool = PRODUCTS_BY_CAT.get(category, ["Product A", "Product B"])
    n = random.randint(2, 5)
    return ", ".join(random.sample(pool, min(n, len(pool))))


def generate_supplier(idx: int) -> GlobalSupplier:
    # Pick country
    country_data = weighted_choice([(c, w, cities) for c, w, cities in COUNTRIES_WEIGHTED] if False else
                                   [(row[:2]) for row in COUNTRIES_WEIGHTED])
    # Redo properly
    all_countries = [(c[0], c[1], c[2]) for c in COUNTRIES_WEIGHTED]
    weights = [c[1] for c in all_countries]
    chosen = random.choices(all_countries, weights=weights, k=1)[0]
    country, _, cities = chosen

    city = random.choice(cities)
    category = weighted_choice(CATEGORIES_WEIGHTED)
    company_name = random_company_name()

    year_est = random.randint(1985, 2023)
    employees = int(random.lognormvariate(5, 1.5))
    employees = max(5, min(employees, 50000))
    volume = round(random.lognormvariate(12, 2) * 1000, 2)
    volume = max(5000, min(volume, 500_000_000))
    rating = round(random.uniform(2.8, 5.0), 1)
    lead_time = random.randint(7, 90)
    moq_units = random.choice(["units", "pieces", "sets", "tons", "boxes", "kg", "pairs", "meters"])
    moq_qty = random.randint(10, 5000)

    return GlobalSupplier(
        supplier_id=f"SUP{idx:06d}",
        business_name=company_name,
        country=country,
        city=city,
        address=f"{random.randint(1, 999)} {random.choice(['Trade Zone', 'Industrial Park', 'Business Hub', 'Export District', 'Commercial Street', 'Business Park'])}, {city}, {country}",
        phone=random_phone(country),
        email=random_email(company_name),
        website=random_website(company_name),
        product_category=category,
        product_list=random_products(category),
        business_type=random.choice(BUSINESS_TYPES),
        year_established=year_est,
        employee_count=employees,
        annual_export_volume_usd=round(volume, 2),
        min_order_quantity=f"{moq_qty} {moq_units}",
        export_markets=random_markets(),
        certifications=random_certifications(),
        supplier_rating=rating,
        payment_terms=random.choice(PAYMENT_TERMS),
        lead_time_days=lead_time,
    )


def run():
    logger.info("Creating tables if missing…")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Find current max numeric ID
        existing = set(row[0] for row in db.query(GlobalSupplier.supplier_id).all())
        logger.info("Existing rows: %d", len(existing))

        target_new = 15_000
        inserted = 0
        skipped = 0
        batch = []
        idx = START_ID

        while inserted + len(batch) < target_new:
            sid = f"SUP{idx:06d}"
            idx += 1
            if sid in existing:
                skipped += 1
                continue

            batch.append(generate_supplier(int(sid[3:])))
            existing.add(sid)

            if len(batch) >= BATCH_SIZE:
                db.bulk_save_objects(batch)
                db.commit()
                inserted += len(batch)
                logger.info("Inserted %d so far (idx=%s)", inserted, sid)
                batch = []

        if batch:
            db.bulk_save_objects(batch)
            db.commit()
            inserted += len(batch)

        logger.info("=" * 60)
        logger.info("Done. Newly inserted: %d  |  Skipped dups: %d", inserted, skipped)
        total = db.query(GlobalSupplier).count()
        logger.info("Total rows in global_suppliers: %d", total)
        logger.info("=" * 60)

    except Exception:
        db.rollback()
        logger.exception("Failed — rolled back.")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    run()
