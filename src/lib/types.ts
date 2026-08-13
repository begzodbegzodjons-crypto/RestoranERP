/**
 * Type definitions for waiter POS API responses.
 */

export interface User {
  id: string;
  name: string;
  phone: string;
  restaurantId: string;
  roleId?: string;
  roleName?: string;
  roleDisplayName?: string;
  permissions: string[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    restaurantId: string;
    roleId?: string;
    roleName?: string;
  };
}

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'cleaning';

export interface Table {
  id: string;
  restaurant_id: string;
  name: string;
  capacity: number;
  section: string | null;
  status: TableStatus;
  current_order_id: string | null;
  current_order_number: string | null;
  current_order_total: string | number | null;
  waiter_id: string | null;
  waiter_name: string | null;
  current_order_opened_at: string | null;
  current_order_items: number;
  sort_order: number;
  is_active: number | boolean;
}

export interface Category {
  id: string;
  name: string;
  station: 'kitchen' | 'kebab' | 'bar' | 'other';
  sort_order: number;
  is_active: number | boolean;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  type: 'kitchen' | 'kebab' | 'bar' | 'other';
  unit: string;
  cost_price: string | number;
  is_active: number | boolean;
  has_variants: number | boolean;
  sort_order: number;
  current_price: string | number | null;
  category_name?: string;
  category_station?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  unit_price: string | number;
  cost_price: string | number;
  quantity: string | number;
  line_total: string | number;
  notes: string | null;
  station: 'kitchen' | 'kebab' | 'bar' | 'other';
  status: 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled';
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  chef_id: string | null;
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: string;
  table_id: string | null;
  table_name?: string | null;
  waiter_id: string | null;
  waiter_name?: string | null;
  cashier_id: string | null;
  cashier_name?: string | null;
  order_type: 'dine_in' | 'takeaway' | 'delivery';
  status: 'open' | 'cooking' | 'ready' | 'paid' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  subtotal: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  tip_amount: string | number;
  total: string | number;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  version: number;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  items?: OrderItem[];
}

export interface StationQueueItem {
  order_item_id: string;
  order_id: string;
  restaurant_id: string;
  order_number: string;
  table_id: string | null;
  table_name: string | null;
  product_id: string;
  product_name: string;
  quantity: string | number;
  unit_price: string | number;
  line_total: string | number;
  notes: string | null;
  station: 'kitchen' | 'kebab' | 'bar';
  status: 'pending' | 'cooking' | 'ready' | 'served' | 'cancelled';
  chef_id: string | null;
  chef_name: string | null;
  started_at: string | null;
  ready_at: string | null;
  served_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  opened_at: string;
  waiter_id: string | null;
  waiter_name: string | null;
  age_seconds: number;
  urgency: 'ok' | 'warning' | 'overdue';
}

/** Client-side cart item (not yet persisted to backend) */
export interface CartItem {
  productId: string;
  name: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  notes?: string;
  station: 'kitchen' | 'kebab' | 'bar' | 'other';
  variantId?: string | null;
}
