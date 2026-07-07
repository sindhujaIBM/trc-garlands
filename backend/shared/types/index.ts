/** Core domain types — mirrors DynamoDB schema (architecture-plan.md §3). */

export type OrderStatus =
  | 'INQUIRY'
  | 'QUOTED'
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_PAID'
  | 'FLOWER_SOURCING'
  | 'IN_PRODUCTION'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED';

export type OrderType = 'WEDDING' | 'POOJA' | 'TEMPLE' | 'GRADUATION' | 'GENERAL';

export type RiskTag =
  | 'HIGH_FLOWER_DEMAND'
  | 'PRICE_VOLATILITY_RISK'
  | 'IMPORT_FLOWER_RISK'
  | 'RUSH_ORDER'
  | 'LATE_RISK';

export interface GarlandItem {
  productId: string;
  length?: number; // feet
  flowerTypes: string[];
  colors: string[];
  qty: number;
  unitPrice: number;
  subtotal: number;
}

export interface PricingSnapshot {
  basePrice: number;
  seasonalSurcharge: number;
  rushSurcharge: number;
  total: number;
  currency: 'CAD';
}

export interface Order {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  orderType: OrderType;
  eventDate: string; // ISO date
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress?: string;
  garlandItems: GarlandItem[];
  pricingSnapshot: PricingSnapshot;
  riskTags: RiskTag[];
  depositAmount?: number;
  depositPaidAt?: string;
  depositPaymentId?: string;
  balanceAmount?: number;
  balancePaidAt?: string;
  balancePaymentId?: string;
  invoiceS3Key?: string;
  chatSessionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  customerId: string;
  cognitoSub?: string;
  name: string;
  email?: string;
  phone?: string; // E.164
  whatsappOptIn: boolean;
  smsOptIn: boolean;
  emailOptIn: boolean; // explicit opt-in only (PIPEDA)
  preferredLanguage: 'en' | 'pa' | 'hi' | 'ta';
  orderIds: string[];
  totalLifetimeValue: number;
  tags: string[];
}

export type ProductCategory = 'GARLAND' | 'VENI' | 'POOJA_SET' | 'DECORATION';

export interface Product {
  productId: string;
  name: string;
  slug: string;
  category: ProductCategory;
  occasion: string[];
  basePrice: number; // CAD
  pricingUnit: 'PER_FOOT' | 'PER_UNIT';
  primaryFlowers: string[];
  alternateFlowers: string[];
  leadTimeDays: number;
  isActive: boolean;
  isSeasonalOnly: boolean;
}

export interface SeasonalEvent {
  eventId: string;
  name: string; // e.g. "Diwali 2026"
  type: 'RELIGIOUS' | 'CULTURAL' | 'WESTERN' | 'CALGARY_LOCAL';
  startDate: string;
  endDate: string;
  peakDate: string;
  affectedFlowers: string[];
  expectedDemandMultiplier: number;
  surchargePercent: number; // 0-50
  surchargeActive: boolean;
  surchargeMessage?: string;
  leadTimeExtensionDays: number;
  flowerRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokensUsed?: number;
}

export interface ChatSession {
  sessionId: string;
  customerId?: string;
  channel: 'WEB' | 'WHATSAPP';
  status: 'ACTIVE' | 'ESCALATED' | 'COMPLETED';
  messages: ChatMessage[]; // last 20
  capturedLead?: {
    name?: string;
    email?: string;
    phone?: string;
    occasion?: string;
    eventDate?: string;
    notes?: string;
  };
  linkedOrderId?: string;
  ttl: number; // Unix epoch, 90-day auto-cleanup
}
