import { CardTemplate } from '@cardwar/shared';

/** map การ์ด → ชื่อไอคอนจาก packages/icons (ใช้ทั้งอาร์ตกลางการ์ดและตรามุมบนซ้าย) */
export function artIconName(t: CardTemplate): string | null {
  if (t.group === 'skill' && t.skill) {
    const map: Record<string, string> = {
      physical: 'sword', magic: 'magic', heal: 'heal', shield: 'shield',
      buff_atk: 'buffAtk', buff_matk: 'sparkles', poison: 'poison',
    };
    return map[t.skill.kind] ?? null;
  }
  if (t.group === 'pet') return 'pet';
  if (t.weaponKind) {
    const map: Record<string, string> = { sword: 'sword', katara: 'katana', bow: 'bow' };
    return map[t.weaponKind] ?? null;
  }
  const byCategory: Record<string, string> = {
    hat: 'hat', top: 'top', pants: 'pants', shoes: 'shoes', gloves: 'gloves',
    ring: 'ringIcon', bracelet: 'bracelet', earring: 'earring',
    food: 'food', potion: 'potion', ingredient: 'ingredient',
    ore: 'ore', gem: 'gem', herb: 'herb', wood: 'wood', monster_part: 'claw',
    pickaxe: 'pickaxe', axe: 'axe', sickle: 'herb',
  };
  return byCategory[t.category] ?? null;
}
