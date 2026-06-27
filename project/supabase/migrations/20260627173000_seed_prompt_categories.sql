-- Seed all categories required by the SkillBridge master prompt.
-- This migration is idempotent and safe to rerun.

INSERT INTO public.categories (name, slug, ecosystem, description, sort_order)
VALUES
  ('Graphics Design', 'graphics-design', 'hire', 'Premium brand identity, logos, flyers, social media assets, and creative design services.', 1),
  ('Web Design', 'web-design', 'hire', 'Modern websites, landing pages, ecommerce stores, and business web experiences.', 2),
  ('Tailoring', 'tailoring', 'hire', 'Custom clothing, alterations, ceremonial outfits, and fashion production.', 3),
  ('Shoe Construction', 'shoe-construction', 'hire', 'Handmade shoes, repairs, custom footwear, and leather finishing.', 4),
  ('Bag Construction', 'bag-construction', 'hire', 'Custom bags, leather goods, repairs, and small-batch production.', 5),
  ('Plumbing', 'plumbing', 'hire', 'Residential and commercial plumbing installation, repair, and maintenance.', 6),
  ('Furniture Construction', 'furniture-construction', 'hire', 'Custom furniture, carpentry, repairs, and interior woodwork.', 7),
  ('Event Planning', 'event-planning', 'hire', 'Event coordination, vendor planning, decoration, and logistics.', 8),
  ('Interior Decoration', 'interior-decoration', 'hire', 'Home, office, and retail interior styling and decoration.', 9),
  ('Painting', 'painting', 'hire', 'Residential, commercial, decorative, and renovation painting services.', 10),
  ('Catering', 'catering', 'hire', 'Food service, event catering, meal preparation, and hospitality support.', 11),
  ('Clothes', 'clothes', 'shop', 'Clothing, fashion pieces, native wear, casual wear, and ready-made apparel.', 12),
  ('Shoes', 'shoes', 'shop', 'Footwear for men, women, and children from verified sellers.', 13),
  ('Bags', 'bags', 'shop', 'Handbags, backpacks, travel bags, leather bags, and accessories.', 14),
  ('Caps', 'caps', 'shop', 'Caps, hats, headwear, and custom branded pieces.', 15),
  ('Underwear', 'underwear', 'shop', 'Underwear and essential clothing items from trusted sellers.', 16),
  ('Kitchen Items', 'kitchen-items', 'shop', 'Cookware, utensils, appliances, and kitchen essentials.', 17),
  ('Foodstuffs', 'foodstuffs', 'shop', 'Groceries, staple foods, spices, grains, and fresh food items.', 18),
  ('Gadgets', 'gadgets', 'shop', 'Phones, accessories, electronics, and useful technology products.', 19),
  ('Furniture', 'furniture', 'shop', 'Home, office, and outdoor furniture from verified sellers.', 20),
  ('Cars', 'cars', 'shop', 'Cars and vehicle listings with seller contact and escrow workflow placeholders.', 21),
  ('Bikes', 'bikes', 'shop', 'Motorcycles, bicycles, spare parts, and mobility products.', 22),
  ('Land', 'land', 'shop', 'Land and property opportunity listings with verification-first marketplace handling.', 23),
  ('Thrift Items', 'thrift-items', 'shop', 'Quality thrift, pre-owned, vintage, and budget-friendly items.', 24),
  ('Remote Jobs', 'remote-jobs', 'jobs', 'Remote opportunities across Africa and global markets.', 25),
  ('Office Jobs', 'office-jobs', 'jobs', 'On-site office roles and local employment opportunities.', 26),
  ('Contract Jobs', 'contract-jobs', 'jobs', 'Short-term, project-based, and contract work opportunities.', 27),
  ('Hybrid Jobs', 'hybrid-jobs', 'jobs', 'Flexible jobs combining remote and office work.', 28),
  ('Internship', 'internship', 'jobs', 'Internship, graduate trainee, and early-career opportunities.', 29)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  ecosystem = EXCLUDED.ecosystem,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
