export type DiscountType = 'percentage' | 'fixed';

export function isValidMarkup(markupPercent: number): boolean {
  return Number.isFinite(markupPercent) && markupPercent > 0 && markupPercent < 100;
}

/** Gross-margin sale price: cost / (1 - markup/100). Returns 0 if markup is invalid. */
export function priceFromMarkup(cost: number, markupPercent: number): number {
  if (!Number.isFinite(cost) || cost <= 0 || !isValidMarkup(markupPercent)) {
    return 0;
  }
  return cost / (1 - markupPercent / 100);
}

export function applyDiscount(
  price: number,
  discountType?: DiscountType,
  discountValue?: number
): number {
  if (!discountType || !discountValue) {
    return Math.max(0, price);
  }
  if (discountType === 'percentage') {
    return Math.max(0, price * (1 - discountValue / 100));
  }
  return Math.max(0, price - discountValue);
}

export function comboPriceFromCost(
  cost: number,
  markupPercent: number,
  discountType?: DiscountType,
  discountValue?: number
): number {
  return applyDiscount(
    priceFromMarkup(cost, markupPercent),
    discountType,
    discountValue
  );
}

export interface ComboPricingInput {
  price_type: 'fixed' | 'markup' | 'calculated';
  fixed_price?: number;
  markup_percent?: number;
  discount_type?: DiscountType;
  discount_value?: number;
}

export interface ProductPriceParts {
  price: number;
  production_cost: number;
  quantity: number;
}

export function resolveComboPrice(
  combo: ComboPricingInput,
  selections: ProductPriceParts[]
): number {
  if (combo.price_type === 'fixed') {
    return combo.fixed_price || 0;
  }

  if (combo.price_type === 'markup') {
    const cost = selections.reduce(
      (sum, s) => sum + (s.production_cost || 0) * s.quantity,
      0
    );
    return Math.round(
      comboPriceFromCost(
        cost,
        combo.markup_percent || 0,
        combo.discount_type,
        combo.discount_value
      )
    );
  }

  const totalPrice = selections.reduce((sum, s) => sum + s.price * s.quantity, 0);
  return Math.round(
    applyDiscount(totalPrice, combo.discount_type, combo.discount_value)
  );
}

export function defaultComboSelectionsFromSlots(
  slots: Array<{ default_product_id: string; quantity: number }>,
  products: Array<{ id: string; price: number; production_cost: number }>
): ProductPriceParts[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const selections: ProductPriceParts[] = [];
  for (const slot of slots) {
    const product = byId.get(slot.default_product_id);
    if (product) {
      selections.push({
        price: product.price,
        production_cost: product.production_cost,
        quantity: slot.quantity,
      });
    }
  }
  return selections;
}

export interface DraftMateriaPrimaItem {
  materia_prima_id: string;
  quantity: string;
  is_variable: boolean;
  default_quantity: string;
  linked_to: string;
  linked_multiplier: string;
}

export function estimateDraftProductCost(
  usesMateriaPrima: boolean,
  productionCost: string,
  items: DraftMateriaPrimaItem[],
  materiaPrima: Array<{ id: string; cost_per_unit: number }>
): number {
  if (!usesMateriaPrima) {
    return parseFloat(productionCost) || 0;
  }

  const mpById = new Map(materiaPrima.map((m) => [m.id, m]));
  let total = 0;
  const variableDefaultQuantities = new Map<string, number>();

  for (const item of items) {
    if (item.linked_to) continue;
    const mp = mpById.get(item.materia_prima_id);
    if (!mp) continue;
    const qty = item.is_variable
      ? parseFloat(item.default_quantity) || 1
      : parseFloat(item.quantity) || 0;
    total += mp.cost_per_unit * qty;
    if (item.is_variable) {
      variableDefaultQuantities.set(
        item.materia_prima_id,
        parseFloat(item.default_quantity) || 1
      );
    }
  }

  for (const item of items) {
    if (!item.linked_to || !item.linked_multiplier) continue;
    const parentQty = variableDefaultQuantities.get(item.linked_to);
    if (parentQty === undefined) continue;
    const mp = mpById.get(item.materia_prima_id);
    if (!mp) continue;
    const linkedQty =
      parentQty * (parseFloat(item.linked_multiplier) || 0) +
      (parseFloat(item.quantity) || 0);
    total += mp.cost_per_unit * linkedQty;
  }

  return total;
}
