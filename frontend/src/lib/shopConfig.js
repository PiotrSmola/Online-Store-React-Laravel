// Must match config/shop.php on the backend until the cart quote supplies delivery options.
export const DELIVERY_METHODS = [
  { value: 'courier', label: 'Kurier', price: 15.99 },
  { value: 'pickup_point', label: 'Paczkomat', price: 12.99 },
  { value: 'store_pickup', label: 'Odbiór w sklepie', price: 0 },
];

export const PAYMENT_METHODS = [
  { value: 'card', label: 'Płatność kartą' },
  { value: 'transfer', label: 'Przelew bankowy' },
  { value: 'cash', label: 'Płatność w sklepie' },
];

const ORDER_STATUSES = {
  pending: 'Oczekuje na realizację',
  processing: 'W realizacji',
  shipped: 'Wysłane',
  delivered: 'Dostarczone',
  cancelled: 'Anulowane',
};

function labelOf(methods, value) {
  return methods.find((method) => method.value === value)?.label ?? value ?? '';
}

export function deliveryLabel(value) {
  return labelOf(DELIVERY_METHODS, value);
}

export function paymentLabel(value) {
  return labelOf(PAYMENT_METHODS, value);
}

export function orderStatusLabel(status) {
  return ORDER_STATUSES[status] ?? status ?? '';
}
