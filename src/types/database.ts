export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Role = "admin" | "rep"
export type DealStatus = "active" | "closed"
export type SheetStatus = "draft" | "sent" | "archived"
export type AllocationStatus = "pending" | "accepted" | "rejected" | "fulfilled"
export type RetailerStatus = "active" | "inactive"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: Role; full_name: string | null; created_at: string; updated_at: string }
        Insert: { id: string; role?: Role; full_name?: string | null }
        Update: { role?: Role; full_name?: string | null }
        Relationships: []
      }
      deals: {
        Row: { id: string; lp_name: string; product_name: string; sku: string; credit_description: string; qty_total: number; status: DealStatus; created_at: string; updated_at: string }
        Insert: { id?: string; lp_name: string; product_name: string; sku: string; credit_description: string; qty_total: number; status?: DealStatus }
        Update: { id?: string; lp_name?: string; product_name?: string; sku?: string; credit_description?: string; qty_total?: number; status?: DealStatus }
        Relationships: []
      }
      sheets: {
        Row: { id: string; name: string; created_by: string; status: SheetStatus; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; created_by: string; status?: SheetStatus }
        Update: { id?: string; name?: string; created_by?: string; status?: SheetStatus }
        Relationships: []
      }
      sheet_deals: {
        Row: { id: string; sheet_id: string; deal_id: string; visible_qty: number; created_at: string }
        Insert: { id?: string; sheet_id: string; deal_id: string; visible_qty: number }
        Update: { id?: string; sheet_id?: string; deal_id?: string; visible_qty?: number }
        Relationships: []
      }
      sheet_retailers: {
        Row: { id: string; sheet_id: string; deal_id: string; retailer_id: string | null; retailer_name: string; alloc_qty: number; status: AllocationStatus; ship_instructions: string | null; responded_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; sheet_id: string; deal_id: string; retailer_id?: string | null; retailer_name: string; alloc_qty: number; status?: AllocationStatus; ship_instructions?: string | null; responded_at?: string | null }
        Update: { id?: string; sheet_id?: string; deal_id?: string; retailer_id?: string | null; retailer_name?: string; alloc_qty?: number; status?: AllocationStatus; ship_instructions?: string | null; responded_at?: string | null }
        Relationships: []
      }
      retailers: {
        Row: { id: string; name: string; license_number: string | null; address: string | null; city: string | null; province: string | null; postal_code: string | null; contact_name: string | null; contact_email: string | null; contact_phone: string | null; account_rep_id: string | null; status: RetailerStatus; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; license_number?: string | null; address?: string | null; city?: string | null; province?: string | null; postal_code?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; account_rep_id?: string | null; status?: RetailerStatus; notes?: string | null }
        Update: { id?: string; name?: string; license_number?: string | null; address?: string | null; city?: string | null; province?: string | null; postal_code?: string | null; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; account_rep_id?: string | null; status?: RetailerStatus; notes?: string | null }
        Relationships: []
      }
      promotions: {
        Row: { id: string; partner_name: string; lp_name: string; mechanism_description: string; start_date: string; end_date: string | null; units_sold: number; notes: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; partner_name: string; lp_name: string; mechanism_description: string; start_date: string; end_date?: string | null; units_sold?: number; notes?: string | null }
        Update: { id?: string; partner_name?: string; lp_name?: string; mechanism_description?: string; start_date?: string; end_date?: string | null; units_sold?: number; notes?: string | null }
        Relationships: []
      }
    }
    Views: {
      deal_availability: {
        Row: { id: string; lp_name: string; product_name: string; sku: string; credit_description: string; status: DealStatus; qty_total: number; qty_reserved: number; qty_accepted: number; qty_fulfilled: number; qty_allocated: number; qty_available: number; created_at: string; updated_at: string }
        Relationships: []
      }
      rep_stats: {
        Row: { rep_id: string; full_name: string | null; sheets_total: number; sheets_sent: number; sheets_archived: number; allocations_total: number; allocations_pending: number; allocations_accepted: number; allocations_rejected: number; allocations_fulfilled: number; units_accepted: number; units_fulfilled: number; acceptance_rate_pct: number | null }
        Relationships: []
      }
      retailer_stats: {
        Row: { id: string; name: string; city: string | null; province: string | null; account_rep_id: string | null; account_rep_name: string | null; allocations_total: number; allocations_accepted: number; allocations_rejected: number; allocations_fulfilled: number; units_committed: number; units_fulfilled: number; acceptance_rate_pct: number | null; last_response_at: string | null }
        Relationships: []
      }
      retailer_purchase_history: {
        Row: { retailer_id: string; retailer_name: string; city: string | null; province: string | null; allocation_id: string; sheet_id: string; sheet_name: string; lp_name: string; product_name: string; sku: string; credit_description: string; alloc_qty: number; status: AllocationStatus; ship_instructions: string | null; responded_at: string | null; rep_name: string | null; created_at: string }
        Relationships: []
      }
      lp_deal_stats: {
        Row: { lp_name: string; deals_total: number; deals_active: number; units_total: number; units_reserved: number; units_accepted: number; units_fulfilled: number; units_rejected: number }
        Relationships: []
      }
    }
    Functions: {
      reserve_inventory: { Args: { p_sheet_id: string }; Returns: void }
      release_inventory: { Args: { p_sheet_retailer_id: string }; Returns: void }
      commit_inventory: { Args: { p_sheet_retailer_id: string; p_ship_instructions: string }; Returns: void }
      fulfill_inventory: { Args: { p_sheet_retailer_id: string }; Returns: void }
      get_my_role: { Args: Record<never, never>; Returns: string }
    }
    Enums: {}
    CompositeTypes: {}
  }
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"]
export type Deal = Database["public"]["Tables"]["deals"]["Row"]
export type Sheet = Database["public"]["Tables"]["sheets"]["Row"]
export type SheetDeal = Database["public"]["Tables"]["sheet_deals"]["Row"]
export type SheetRetailer = Database["public"]["Tables"]["sheet_retailers"]["Row"]
export type Retailer = Database["public"]["Tables"]["retailers"]["Row"]
export type Promotion = Database["public"]["Tables"]["promotions"]["Row"]
export type DealAvailability = Database["public"]["Views"]["deal_availability"]["Row"]
export type RepStats = Database["public"]["Views"]["rep_stats"]["Row"]
export type RetailerStats = Database["public"]["Views"]["retailer_stats"]["Row"]
export type LpDealStats = Database["public"]["Views"]["lp_deal_stats"]["Row"]
