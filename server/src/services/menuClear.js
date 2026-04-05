import { prisma } from "../lib/prisma.js";

/**
 * Removes scheduled menu data. If deleteMenuItems is true, also deletes the dish
 * catalog (MenuItem), which cascades to reviews and complaints for those items.
 */
export async function clearMenuData({ deleteMenuItems }) {
  await prisma.$transaction(async (tx) => {
    await tx.menuTemplateEntry.deleteMany();
    await tx.menuDateEntry.deleteMany();
    await tx.nightMessItem.deleteMany();
    if (deleteMenuItems) {
      await tx.menuItem.deleteMany();
    }
  });
}
