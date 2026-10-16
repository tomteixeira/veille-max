
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "bookings": {
                  Row: {
                    "booked_at": string,"destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"train_number": string,"travel_date": string,"trip_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "booked_at"?: string,"destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"train_number": string,"travel_date": string,"trip_key": string,"user_id"?: string
                  }
                  Update: {
                    "booked_at"?: string,"destination_code"?: string,"leg_kind"?: Database["public"]['Enums']["leg_kind"],"origin_code"?: string,"train_number"?: string,"travel_date"?: string,"trip_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bookings_travel_date_train_number_origin_code_destination__fkey"
      columns: ["travel_date","train_number","origin_code","destination_code"]
isOneToOne: false
      referencedRelation: "train_observations"
      referencedColumns: ["travel_date","train_number","origin_code","destination_code"]
    }
                  ]
                },"customised_trip_legs": {
                  Row: {
                    "anchor": Database["public"]['Enums']["time_anchor"],"ideal_time": string,"kind": Database["public"]['Enums']["leg_kind"],"travel_date": string,"trip_key": string,"user_id": string,"window_end": string | null,"window_start": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor": Database["public"]['Enums']["time_anchor"],"ideal_time": string,"kind": Database["public"]['Enums']["leg_kind"],"travel_date": string,"trip_key": string,"user_id"?: string,"window_end"?: string | null,"window_start"?: string | null
                  }
                  Update: {
                    "anchor"?: Database["public"]['Enums']["time_anchor"],"ideal_time"?: string,"kind"?: Database["public"]['Enums']["leg_kind"],"travel_date"?: string,"trip_key"?: string,"user_id"?: string,"window_end"?: string | null,"window_start"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"customised_trip_routes": {
                  Row: {
                    "destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"rank": number,"trip_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"rank": number,"trip_key": string,"user_id"?: string
                  }
                  Update: {
                    "destination_code"?: string,"leg_kind"?: Database["public"]['Enums']["leg_kind"],"origin_code"?: string,"rank"?: number,"trip_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "customised_trip_routes_destination_code_fkey"
      columns: ["destination_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "customised_trip_routes_origin_code_fkey"
      columns: ["origin_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "customised_trip_routes_user_id_trip_key_leg_kind_fkey"
      columns: ["user_id","trip_key","leg_kind"]
isOneToOne: false
      referencedRelation: "customised_trip_legs"
      referencedColumns: ["user_id","trip_key","kind"]
    }
                  ]
                },"mutes": {
                  Row: {
                    "leg_kind": Database["public"]['Enums']["leg_kind"] | null,"trip_key": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "leg_kind"?: Database["public"]['Enums']["leg_kind"] | null,"trip_key": string,"user_id"?: string
                  }
                  Update: {
                    "leg_kind"?: Database["public"]['Enums']["leg_kind"] | null,"trip_key"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"openings": {
                  Row: {
                    "first_snapshot_id": number,"id": number,"is_open": boolean,"last_snapshot_id": number,"observation_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "first_snapshot_id": number,"id"?: never,"is_open"?: boolean,"last_snapshot_id": number,"observation_id": number
                  }
                  Update: {
                    "first_snapshot_id"?: number,"id"?: never,"is_open"?: boolean,"last_snapshot_id"?: number,"observation_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "openings_first_snapshot_id_fkey"
      columns: ["first_snapshot_id"]
isOneToOne: false
      referencedRelation: "snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "openings_last_snapshot_id_fkey"
      columns: ["last_snapshot_id"]
isOneToOne: false
      referencedRelation: "snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "openings_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "train_observations"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"device_label": string,"endpoint": string,"id": string,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"device_label": string,"endpoint": string,"id"?: string,"p256dh": string,"user_id"?: string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"device_label"?: string,"endpoint"?: string,"id"?: string,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"snapshots": {
                  Row: {
                    "id": number,"ingested_at": string,"open_count": number,"processed_at": string,"row_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: never,"ingested_at": string,"open_count": number,"processed_at": string,"row_count": number
                  }
                  Update: {
                    "id"?: never,"ingested_at"?: string,"open_count"?: number,"processed_at"?: string,"row_count"?: number
                  }
                  Relationships: [
                    
                  ]
                },"stations": {
                  Row: {
                    "code": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"name": string
                  }
                  Update: {
                    "code"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"template_legs": {
                  Row: {
                    "anchor": Database["public"]['Enums']["time_anchor"],"ideal_time": string,"kind": Database["public"]['Enums']["leg_kind"],"user_id": string,"weekday": number,"window_end": string | null,"window_start": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor": Database["public"]['Enums']["time_anchor"],"ideal_time": string,"kind": Database["public"]['Enums']["leg_kind"],"user_id"?: string,"weekday": number,"window_end"?: string | null,"window_start"?: string | null
                  }
                  Update: {
                    "anchor"?: Database["public"]['Enums']["time_anchor"],"ideal_time"?: string,"kind"?: Database["public"]['Enums']["leg_kind"],"user_id"?: string,"weekday"?: number,"window_end"?: string | null,"window_start"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"template_routes": {
                  Row: {
                    "destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"rank": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "destination_code": string,"leg_kind": Database["public"]['Enums']["leg_kind"],"origin_code": string,"rank": number,"user_id"?: string
                  }
                  Update: {
                    "destination_code"?: string,"leg_kind"?: Database["public"]['Enums']["leg_kind"],"origin_code"?: string,"rank"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_routes_destination_code_fkey"
      columns: ["destination_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "template_routes_origin_code_fkey"
      columns: ["origin_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "template_routes_user_id_leg_kind_fkey"
      columns: ["user_id","leg_kind"]
isOneToOne: false
      referencedRelation: "template_legs"
      referencedColumns: ["user_id","kind"]
    }
                  ]
                },"train_observations": {
                  Row: {
                    "arrival_time": string,"departure_time": string,"destination_code": string,"first_snapshot_id": number,"id": number,"last_snapshot_id": number,"origin_code": string,"train_number": string,"travel_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "arrival_time": string,"departure_time": string,"destination_code": string,"first_snapshot_id": number,"id"?: never,"last_snapshot_id": number,"origin_code": string,"train_number": string,"travel_date": string
                  }
                  Update: {
                    "arrival_time"?: string,"departure_time"?: string,"destination_code"?: string,"first_snapshot_id"?: number,"id"?: never,"last_snapshot_id"?: number,"origin_code"?: string,"train_number"?: string,"travel_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "train_observations_destination_code_fkey"
      columns: ["destination_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "train_observations_first_snapshot_id_fkey"
      columns: ["first_snapshot_id"]
isOneToOne: false
      referencedRelation: "snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "train_observations_last_snapshot_id_fkey"
      columns: ["last_snapshot_id"]
isOneToOne: false
      referencedRelation: "snapshots"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "train_observations_origin_code_fkey"
      columns: ["origin_code"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["code"]
    }
                  ]
                },"traveller_settings": {
                  Row: {
                    "installed_at": string | null,"onboarding_step": string,"route_weight": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "installed_at"?: string | null,"onboarding_step"?: string,"route_weight"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "installed_at"?: string | null,"onboarding_step"?: string,"route_weight"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "health":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"record_snapshot":
{ Args: { "ingested_at": string,"processed_at": string,"trains": Json }; Returns: Json
                           },
"register_push_device":
{ Args: { "auth": string,"device_label": string,"endpoint": string,"p256dh": string }; Returns: undefined
                           },
"save_customised_trip":
{ Args: { "legs": Json,"trip_key": string }; Returns: undefined
                           },
"save_template_leg":
{ Args: { "anchor": Database["public"]['Enums']["time_anchor"],"ideal_time": string,"kind": Database["public"]['Enums']["leg_kind"],"routes": Json,"weekday": number,"window_end"?: string,"window_start"?: string }; Returns: undefined
                           },
"tracked_routes":
{ Args: { "from_date": string,"to_date": string }; Returns: {
              "destination_code": string,"origin_code": string
            }[]
                           }
          }
          Enums: {
            "leg_kind": "outbound"|"return","time_anchor": "departure"|"arrival"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "leg_kind": ["outbound", "return"],"time_anchor": ["departure", "arrival"]
          }
        }
} as const
