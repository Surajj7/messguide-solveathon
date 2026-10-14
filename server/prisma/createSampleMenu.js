import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";

const menuRows = [
  {
    Day: "Monday",
    Mess_Type: "VEG",
    Breakfast: "Masala Dosa, Sambar, Coconut Chutney, Filter Coffee",
    Lunch: "Paneer Butter Masala, Dal Tadka, Steamed Rice, Phulka, Curd",
    Snacks: "Samosa, Green Chutney, Masala Chai",
    Dinner: "Mixed Veg Kadai, Dal Fry, Jeera Rice, Chapati, Gulab Jamun",
  },
  {
    Day: "Tuesday",
    Mess_Type: "NON_VEG",
    Breakfast: "Boiled Eggs (2), Idli Sambar, Chutney, Tea",
    Lunch: "Chicken Curry, Dal Makhani, Steamed Rice, Roti, Green Salad",
    Snacks: "Chicken Roll / Veg Puff, Lemon Tea",
    Dinner: "Egg Curry, Dal Fry, Steamed Rice, Chapati, Fruit Custard",
  },
  {
    Day: "Wednesday",
    Mess_Type: "SPECIAL",
    Breakfast: "Poha, Boiled Sprout Salad, Bread Jam, Filter Coffee",
    Lunch: "Shahi Paneer, Dal Makhani, Veg Pulao, Butter Naan, Ice Cream",
    Snacks: "Pav Bhaji, Masala Tea",
    Dinner: "Kadhai Paneer, Yellow Dal, Steamed Rice, Tandoori Roti, Rasgulla",
  },
  {
    Day: "Thursday",
    Mess_Type: "FOODPARK",
    Breakfast: "Aloo Paratha, Curd, Pickle, Tea",
    Lunch: "Veg Manchurian, Fried Rice, Hakka Noodles, Crispy Corn",
    Snacks: "French Fries, Peri Peri Dip, Cold Coffee",
    Dinner: "Paneer Tikka Wrap, Garlic Naan, Dal Tadka, Jeera Rice, Brownie",
  },
  {
    Day: "Friday",
    Mess_Type: "VEG",
    Breakfast: "Idli Sambar, Medu Vada, Filter Coffee",
    Lunch: "Rajma Chawal, Boondi Raita, Roasted Papad, Phulka",
    Snacks: "Onion Pakoda, Masala Chai",
    Dinner: "Matar Paneer, Dal Tadka, Steamed Rice, Roti, Kheer",
  },
  {
    Day: "Saturday",
    Mess_Type: "NON_VEG",
    Breakfast: "Poori Bhaji, Tea",
    Lunch: "Butter Chicken, Dal Makhani, Biryani Rice, Butter Roti, Raita",
    Snacks: "Veg Cutlet, Tea",
    Dinner: "Chicken Kebab, Steamed Rice, Dal, Chapati, Ice Cream",
  },
  {
    Day: "Sunday",
    Mess_Type: "SPECIAL",
    Breakfast: "Chole Bhature, Sweet Lassi",
    Lunch: "Special Paneer Biryani, Mirchi Ka Salan, Raita, Gulab Jamun",
    Snacks: "Masala Sweet Corn, Cold Drink",
    Dinner: "Veg Kolhapuri, Dal Makhani, Steamed Rice, Paratha, Mango Kulfi",
  },
];

const wb = xlsx.utils.book_new();
const ws = xlsx.utils.json_to_sheet(menuRows);
xlsx.utils.book_append_sheet(wb, ws, "WeeklyMenu");

const docsDir = path.resolve("../docs");
const publicDir = path.resolve("../client/public");

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

xlsx.writeFile(wb, path.join(docsDir, "sample_4meals_matrix_menu.xlsx"));
xlsx.writeFile(wb, path.join(publicDir, "sample_4meals_matrix_menu.xlsx"));

const csvContent = xlsx.utils.sheet_to_csv(ws);
fs.writeFileSync(path.join(docsDir, "sample_4meals_matrix_menu.csv"), csvContent, "utf8");
fs.writeFileSync(path.join(publicDir, "sample_4meals_matrix_menu.csv"), csvContent, "utf8");

console.log("Created sample Excel (.xlsx) and CSV (.csv) files in docs/ and client/public/ successfully!");
