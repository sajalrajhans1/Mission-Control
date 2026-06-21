export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          name: string;
          color: string | null;
          archived: boolean;
          description: string;
          created_at: string;
          updated_at: string;
          project_type: "normal" | "client";
          is_private: boolean;
          created_by: string | null;
          client_briefing: string;
          client_deadline: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string | null;
          archived?: boolean;
          description?: string;
          created_at?: string;
          updated_at?: string;
          project_type?: "normal" | "client";
          is_private?: boolean;
          created_by?: string | null;
          client_briefing?: string;
          client_deadline?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
      };
      project_milestones: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          due_date: string | null;
          completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          due_date?: string | null;
          completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_milestones"]["Insert"]>;
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          assigned_to: string;
          project_id: string | null;
          priority: "Low" | "Medium" | "High";
          due_date: string | null;
          completed: boolean;
          completed_user1: boolean;
          completed_user2: boolean;
          created_by: string;
          note: string;
          approved: boolean;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          assigned_to?: string;
          project_id?: string | null;
          priority?: "Low" | "Medium" | "High";
          due_date?: string | null;
          completed?: boolean;
          completed_user1?: boolean;
          completed_user2?: boolean;
          created_by?: string;
          note?: string;
          approved?: boolean;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
      };
      prompts: {
        Row: { id: string; title: string; category: string; content: string; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; category?: string; content?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["prompts"]["Insert"]>;
      };
      ideas: {
        Row: { id: string; title: string; description: string; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; description?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["ideas"]["Insert"]>;
      };
      resources: {
        Row: { id: string; title: string; url: string; category: string; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; url: string; category?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["resources"]["Insert"]>;
      };
      sticky_notes: {
        Row: {
          id: string;
          title: string;
          body: string;
          color: "Yellow" | "Blue" | "Green" | "Pink";
          author: string;
          pinned: boolean;
          read: boolean;
          is_private: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string;
          color?: "Yellow" | "Blue" | "Green" | "Pink";
          author?: string;
          pinned?: boolean;
          read?: boolean;
          is_private?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sticky_notes"]["Insert"]>;
      };
      money_entries: {
        Row: {
          id: string;
          description: string;
          amount: number;
          type: "Income" | "Expense";
          added_by: string;
          category: string;
          is_request: boolean;
          request_to: string | null;
          request_status: "pending" | "approved" | "confirming" | "settled";
          paid_amount: number;
          paid_by: string | null;
          payment_confirmed: boolean;
          savings_goal_id: string | null;
          entry_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          description: string;
          amount: number;
          type: "Income" | "Expense";
          added_by?: string;
          category?: string;
          is_request?: boolean;
          request_to?: string | null;
          request_status?: "pending" | "approved" | "confirming" | "settled";
          paid_amount?: number;
          paid_by?: string | null;
          payment_confirmed?: boolean;
          savings_goal_id?: string | null;
          entry_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["money_entries"]["Insert"]>;
      };
      savings_goals: {
        Row: {
          id: string;
          title: string;
          target_amount: number;
          current_amount: number;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          target_amount: number;
          current_amount?: number;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["savings_goals"]["Insert"]>;
      };
      daily_logs: {
        Row: { id: string; log_date: string; phoenix: string; friend: string; created_at: string; updated_at: string };
        Insert: { id?: string; log_date: string; phoenix?: string; friend?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["daily_logs"]["Insert"]>;
      };
      wins: {
        Row: { id: string; title: string; created_at: string; updated_at: string };
        Insert: { id?: string; title: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["wins"]["Insert"]>;
      };
      settings: {
        Row: { id: string; key: string; value: Json; created_at: string; updated_at: string };
        Insert: { id?: string; key: string; value?: Json; created_at?: string; updated_at?: string };
        Update: { id?: string; key?: string; value?: Json; created_at?: string; updated_at?: string };
      };
      vaults: {
        Row: {
          id: string;
          name: string;
          icon: string | null;
          order_index: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          icon?: string | null;
          order_index?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["vaults"]["Insert"]>;
      };
      vault_items: {
        Row: {
          id: string;
          vault_id: string;
          title: string;
          body: string;
          meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vault_id: string;
          title: string;
          body?: string;
          meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vault_items"]["Insert"]>;
      };
      project_files: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          file_data: string | null;
          url: string | null;
          uploaded_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          file_data?: string | null;
          url?: string | null;
          uploaded_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["project_files"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          for_user: string;
          title: string;
          body: string;
          read: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          for_user: string;
          title: string;
          body?: string;
          read?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
      timetable_blocks: {
        Row: {
          id: string;
          user_key: string;
          title: string;
          block_date: string;
          start_time: string;
          end_time: string;
          task_id: string | null;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_key: string;
          title: string;
          block_date: string;
          start_time: string;
          end_time: string;
          task_id?: string | null;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["timetable_blocks"]["Insert"]>;
      };
      work_deliverables: {
        Row: {
          id: string;
          user_key: string;
          title: string;
          description: string;
          delivery_date: string;
          client_name: string;
          amount: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_key: string;
          title: string;
          description?: string;
          delivery_date: string;
          client_name?: string;
          amount?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["work_deliverables"]["Insert"]>;
      };
      task_card_positions: {
        Row: {
          id: string;
          card_id: string;
          x: number;
          y: number;
          is_private: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          x?: number;
          y?: number;
          is_private?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_card_positions"]["Insert"]>;
      };
      task_card_connections: {
        Row: {
          id: string;
          source_id: string;
          target_id: string;
          is_private: boolean;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          target_id: string;
          is_private?: boolean;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["task_card_connections"]["Insert"]>;
      };
    };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type Insert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type Update<T extends TableName> = Database["public"]["Tables"][T]["Update"];
