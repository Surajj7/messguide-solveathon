-- Example SQL (adjust UUIDs after running seed or create items yourself)
-- Run with: psql %DATABASE_URL% -f docs/sample_menu_inserts.sql

-- INSERT INTO "MenuItem" ("id","name","calories","proteinG","carbsG","fatsG","tags","isVeg")
-- VALUES (gen_random_uuid(), 'Demo Dish', 200, 10, 25, 6, '[]', true);

-- Then link to a template (Sunday=0, VEG, LUNCH):
-- INSERT INTO "MenuTemplateEntry" ("id","dayOfWeek","messType","mealSlot","menuItemId","sortOrder")
-- VALUES (gen_random_uuid(), 0, 'VEG', 'LUNCH', '<menu-item-uuid>', 0);
