export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attachment: {
        Row: {
          content_type: string
          file_name: string
          file_size: number
          id: number
          object_id: string
          object_type: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          content_type: string
          file_name: string
          file_size: number
          id?: number
          object_id: string
          object_type: string
          storage_path: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          content_type?: string
          file_name?: string
          file_size?: number
          id?: number
          object_id?: string
          object_type?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachment_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          after_json: Json | null
          before_json: Json | null
          id: number
          ip_address: unknown
          object_id: string
          object_type: string
          occurred_at: string
          operator_id: string | null
        }
        Insert: {
          action: string
          after_json?: Json | null
          before_json?: Json | null
          id?: number
          ip_address?: unknown
          object_id: string
          object_type: string
          occurred_at?: string
          operator_id?: string | null
        }
        Update: {
          action?: string
          after_json?: Json | null
          before_json?: Json | null
          id?: number
          ip_address?: unknown
          object_id?: string
          object_type?: string
          occurred_at?: string
          operator_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      environment_record: {
        Row: {
          collected_at: string
          id: number
          laboratory_id: number
          metric: string
          recorded_by: string | null
          source_type: string
          status: string
          threshold_max: number | null
          threshold_min: number | null
          unit: string
          value: number
        }
        Insert: {
          collected_at: string
          id?: number
          laboratory_id: number
          metric: string
          recorded_by?: string | null
          source_type: string
          status?: string
          threshold_max?: number | null
          threshold_min?: number | null
          unit: string
          value: number
        }
        Update: {
          collected_at?: string
          id?: number
          laboratory_id?: number
          metric?: string
          recorded_by?: string | null
          source_type?: string
          status?: string
          threshold_max?: number | null
          threshold_min?: number | null
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "environment_record_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "lab_laboratory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environment_record_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_data: {
        Row: {
          collected_at: string
          created_at: string
          data_type: string
          id: number
          instrument_id: number | null
          metric_name: string
          processed_value: number | null
          raw_value: number | null
          recorded_by: string
          remark: string | null
          sample_id: number
          source_type: string
          task_id: number
          unit: string | null
        }
        Insert: {
          collected_at: string
          created_at?: string
          data_type: string
          id?: number
          instrument_id?: number | null
          metric_name: string
          processed_value?: number | null
          raw_value?: number | null
          recorded_by: string
          remark?: string | null
          sample_id: number
          source_type: string
          task_id: number
          unit?: string | null
        }
        Update: {
          collected_at?: string
          created_at?: string
          data_type?: string
          id?: number
          instrument_id?: number | null
          metric_name?: string
          processed_value?: number | null
          raw_value?: number | null
          recorded_by?: string
          remark?: string | null
          sample_id?: number
          source_type?: string
          task_id?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experiment_data_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instrument"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_data_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_data_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "sample"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_data_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_processing_rule: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: number
          name: string
          rule_code: string
          rule_type: string
          status: string
          version: string
        }
        Insert: {
          config: Json
          created_at?: string
          created_by?: string | null
          id?: number
          name: string
          rule_code: string
          rule_type: string
          status?: string
          version: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: number
          name?: string
          rule_code?: string
          rule_type?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_processing_rule_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_processing_run: {
        Row: {
          decision: string | null
          error_code: string | null
          error_message: string | null
          executed_at: string
          executed_by: string
          execution_mode: string
          explanation: string | null
          id: number
          output_data_id: number | null
          rule_id: number
          status: string
          task_id: number
        }
        Insert: {
          decision?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string
          executed_by: string
          execution_mode: string
          explanation?: string | null
          id?: number
          output_data_id?: number | null
          rule_id: number
          status?: string
          task_id: number
        }
        Update: {
          decision?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string
          executed_by?: string
          execution_mode?: string
          explanation?: string | null
          id?: number
          output_data_id?: number | null
          rule_id?: number
          status?: string
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "experiment_processing_run_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_processing_run_output_data_id_fkey"
            columns: ["output_data_id"]
            isOneToOne: false
            referencedRelation: "experiment_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_processing_run_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "experiment_processing_rule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_processing_run_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_data_lineage: {
        Row: {
          created_at: string
          id: number
          output_data_id: number
          relation_type: string
          run_id: number
          source_data_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          output_data_id: number
          relation_type?: string
          run_id: number
          source_data_id: number
        }
        Update: {
          created_at?: string
          id?: number
          output_data_id?: number
          relation_type?: string
          run_id?: number
          source_data_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "experiment_data_lineage_output_data_id_fkey"
            columns: ["output_data_id"]
            isOneToOne: false
            referencedRelation: "experiment_data"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_data_lineage_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "experiment_processing_run"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_data_lineage_source_data_id_fkey"
            columns: ["source_data_id"]
            isOneToOne: false
            referencedRelation: "experiment_data"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_method: {
        Row: {
          created_at: string
          detection_limit: number | null
          document_id: number | null
          effective_at: string | null
          expired_at: string | null
          id: number
          method_code: string
          name: string
          scope: string | null
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          detection_limit?: number | null
          document_id?: number | null
          effective_at?: string | null
          expired_at?: string | null
          id?: number
          method_code: string
          name: string
          scope?: string | null
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          created_at?: string
          detection_limit?: number | null
          document_id?: number | null
          effective_at?: string | null
          expired_at?: string | null
          id?: number
          method_code?: string
          name?: string
          scope?: string | null
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      experiment_method_history: {
        Row: {
          change_type: string
          from_status: string | null
          from_version: string | null
          id: number
          method_code: string
          method_id: number
          occurred_at: string
          operator_id: string
          remark: string | null
          to_status: string
          to_version: string
        }
        Insert: {
          change_type: string
          from_status?: string | null
          from_version?: string | null
          id?: number
          method_code: string
          method_id: number
          occurred_at?: string
          operator_id: string
          remark?: string | null
          to_status: string
          to_version: string
        }
        Update: {
          change_type?: string
          from_status?: string | null
          from_version?: string | null
          id?: number
          method_code?: string
          method_id?: number
          occurred_at?: string
          operator_id?: string
          remark?: string | null
          to_status?: string
          to_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_method_history_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "experiment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_method_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_report: {
        Row: {
          archived_at: string | null
          generated_at: string
          generated_by: string
          id: number
          published_at: string | null
          report_payload: Json
          report_code: string
          status: string
          storage_path: string | null
          task_id: number
          version_no: number
        }
        Insert: {
          archived_at?: string | null
          generated_at?: string
          generated_by: string
          id?: number
          published_at?: string | null
          report_payload?: Json
          report_code: string
          status?: string
          storage_path?: string | null
          task_id: number
          version_no: number
        }
        Update: {
          archived_at?: string | null
          generated_at?: string
          generated_by?: string
          id?: number
          published_at?: string | null
          report_payload?: Json
          report_code?: string
          status?: string
          storage_path?: string | null
          task_id?: number
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "experiment_report_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_report_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_report_history: {
        Row: {
          from_status: string | null
          id: number
          occurred_at: string
          operator_id: string
          report_id: number
          remark: string | null
          to_status: string
        }
        Insert: {
          from_status?: string | null
          id?: number
          occurred_at?: string
          operator_id: string
          report_id: number
          remark?: string | null
          to_status: string
        }
        Update: {
          from_status?: string | null
          id?: number
          occurred_at?: string
          operator_id?: string
          report_id?: number
          remark?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_report_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_report_history_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "experiment_report"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_task: {
        Row: {
          created_at: string
          id: number
          method_id: number
          name: string
          planned_end: string | null
          planned_start: string | null
          priority: string
          project_id: number
          remark: string | null
          status: string
          task_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          method_id: number
          name: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          project_id: number
          remark?: string | null
          status?: string
          task_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          method_id?: number
          name?: string
          planned_end?: string | null
          planned_start?: string | null
          priority?: string
          project_id?: number
          remark?: string | null
          status?: string
          task_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_task_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "experiment_method"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_task_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_project"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument: {
        Row: {
          commissioned_at: string | null
          created_at: string
          id: number
          instrument_code: string
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          next_calibration_at: string | null
          owner_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          commissioned_at?: string | null
          created_at?: string
          id?: number
          instrument_code: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          next_calibration_at?: string | null
          owner_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          commissioned_at?: string | null
          created_at?: string
          id?: number
          instrument_code?: string
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          next_calibration_at?: string | null
          owner_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_maintenance: {
        Row: {
          attachment_id: number | null
          cycle_days: number | null
          id: number
          instrument_id: number
          maintenance_type: string
          next_due_on: string | null
          occurred_on: string
          operator_id: string
          remark: string | null
          result: string | null
        }
        Insert: {
          attachment_id?: number | null
          cycle_days?: number | null
          id?: number
          instrument_id: number
          maintenance_type: string
          next_due_on?: string | null
          occurred_on: string
          operator_id: string
          remark?: string | null
          result?: string | null
        }
        Update: {
          attachment_id?: number | null
          cycle_days?: number | null
          id?: number
          instrument_id?: number
          maintenance_type?: string
          next_due_on?: string | null
          occurred_on?: string
          operator_id?: string
          remark?: string | null
          result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instrument_maintenance_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instrument"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_maintenance_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_item: {
        Row: {
          batch_no: string | null
          created_at: string
          expiry_date: string | null
          id: number
          item_code: string
          location: string | null
          low_stock_threshold: number
          manufacturer: string | null
          name: string
          quantity: number
          status: string
          storage_condition: string | null
          type: string
          unit: string
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: number
          item_code: string
          location?: string | null
          low_stock_threshold?: number
          manufacturer?: string | null
          name: string
          quantity?: number
          status?: string
          storage_condition?: string | null
          type: string
          unit: string
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: number
          item_code?: string
          location?: string | null
          low_stock_threshold?: number
          manufacturer?: string | null
          name?: string
          quantity?: number
          status?: string
          storage_condition?: string | null
          type?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transaction: {
        Row: {
          id: number
          item_id: number
          occurred_at: string
          operator_id: string
          quantity: number
          remark: string | null
          task_id: number | null
          transaction_type: string
        }
        Insert: {
          id?: number
          item_id: number
          occurred_at?: string
          operator_id: string
          quantity: number
          remark?: string | null
          task_id?: number | null
          transaction_type: string
        }
        Update: {
          id?: number
          item_id?: number
          occurred_at?: string
          operator_id?: string
          quantity?: number
          remark?: string | null
          task_id?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transaction_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_department: {
        Row: {
          code: string
          created_at: string
          id: number
          laboratory_id: number
          name: string
          parent_id: number | null
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          laboratory_id: number
          name: string
          parent_id?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          laboratory_id?: number
          name?: string
          parent_id?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_department_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "lab_laboratory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_department_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "lab_department"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_group: {
        Row: {
          code: string
          created_at: string
          id: number
          laboratory_id: number
          leader_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          laboratory_id: number
          leader_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          laboratory_id?: number
          leader_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_group_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "lab_laboratory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_group_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_laboratory: {
        Row: {
          code: string
          created_at: string
          id: number
          location: string | null
          manager_id: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          location?: string | null
          manager_id?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          location?: string | null
          manager_id?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_laboratory_manager_fk"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      research_project: {
        Row: {
          created_at: string
          description: string | null
          end_date: string | null
          id: number
          name: string
          owner_id: string
          project_code: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: number
          name: string
          owner_id: string
          project_code: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: number
          name?: string
          owner_id?: string
          project_code?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_project_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      result_review: {
        Row: {
          comment: string | null
          created_at: string
          id: number
          result: string
          reviewed_at: string
          reviewer_id: string
          task_id: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: number
          result: string
          reviewed_at?: string
          reviewer_id: string
          task_id: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: number
          result?: string
          reviewed_at?: string
          reviewer_id?: string
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "result_review_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_review_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      sample: {
        Row: {
          batch_no: string | null
          created_at: string
          id: number
          name: string
          project_id: number
          quantity: number
          registered_at: string
          sample_code: string
          source: string | null
          specification: string | null
          status: string
          storage_condition: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          id?: number
          name: string
          project_id: number
          quantity: number
          registered_at?: string
          sample_code: string
          source?: string | null
          specification?: string | null
          status?: string
          storage_condition?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          id?: number
          name?: string
          project_id?: number
          quantity?: number
          registered_at?: string
          sample_code?: string
          source?: string | null
          specification?: string | null
          status?: string
          storage_condition?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "research_project"
            referencedColumns: ["id"]
          },
        ]
      }
      sample_flow: {
        Row: {
          from_status: string | null
          handover_to: string | null
          id: number
          location: string | null
          node: string
          occurred_at: string
          operator_id: string
          remark: string | null
          sample_id: number
          to_status: string
        }
        Insert: {
          from_status?: string | null
          handover_to?: string | null
          id?: number
          location?: string | null
          node: string
          occurred_at?: string
          operator_id: string
          remark?: string | null
          sample_id: number
          to_status: string
        }
        Update: {
          from_status?: string | null
          handover_to?: string | null
          id?: number
          location?: string | null
          node?: string
          occurred_at?: string
          operator_id?: string
          remark?: string | null
          sample_id?: number
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sample_flow_handover_to_fkey"
            columns: ["handover_to"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_flow_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sample_flow_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "sample"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_category: {
        Row: {
          category_type: string
          code: string
          created_at: string
          description: string | null
          id: number
          name: string
          parent_id: number | null
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category_type: string
          code: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          parent_id?: number | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          parent_id?: number | null
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "sys_category"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_parameter: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          name: string
          status: string
          updated_at: string
          value_json: Json
          value_type: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          status?: string
          updated_at?: string
          value_json: Json
          value_type: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          status?: string
          updated_at?: string
          value_json?: Json
          value_type?: string
        }
        Relationships: []
      }
      sys_permission: {
        Row: {
          action: string
          code: string
          id: number
          name: string
          resource: string
        }
        Insert: {
          action: string
          code: string
          id?: number
          name: string
          resource: string
        }
        Update: {
          action?: string
          code?: string
          id?: number
          name?: string
          resource?: string
        }
        Relationships: []
      }
      sys_position: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_role: {
        Row: {
          code: string
          created_at: string
          id: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      sys_role_permission: {
        Row: {
          permission_id: number
          role_id: number
        }
        Insert: {
          permission_id: number
          role_id: number
        }
        Update: {
          permission_id?: number
          role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sys_role_permission_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "sys_permission"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_role_permission_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "sys_role"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_unit: {
        Row: {
          code: string
          created_at: string
          dimension: string | null
          id: number
          name: string
          sort_order: number
          status: string
          symbol: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          dimension?: string | null
          id?: number
          name: string
          sort_order?: number
          status?: string
          symbol?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          dimension?: string | null
          id?: number
          name?: string
          sort_order?: number
          status?: string
          symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sys_user: {
        Row: {
          availability_note: string | null
          availability_status: string
          availability_until: string | null
          created_at: string
          department_id: number | null
          email: string | null
          id: string
          last_login_at: string | null
          position_id: number | null
          real_name: string
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          availability_note?: string | null
          availability_status?: string
          availability_until?: string | null
          created_at?: string
          department_id?: number | null
          email?: string | null
          id: string
          last_login_at?: string | null
          position_id?: number | null
          real_name: string
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          availability_note?: string | null
          availability_status?: string
          availability_until?: string | null
          created_at?: string
          department_id?: number | null
          email?: string | null
          id?: string
          last_login_at?: string | null
          position_id?: number | null
          real_name?: string
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_department_fk"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "lab_department"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_user_position_fk"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "sys_position"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_user_qualification: {
        Row: {
          certificate_no: string | null
          created_at: string
          expires_at: string | null
          id: number
          issued_at: string | null
          notes: string | null
          qualification_name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certificate_no?: string | null
          created_at?: string
          expires_at?: string | null
          id?: number
          issued_at?: string | null
          notes?: string | null
          qualification_name: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certificate_no?: string | null
          created_at?: string
          expires_at?: string | null
          id?: number
          issued_at?: string | null
          notes?: string | null
          qualification_name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_qualification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_user_role: {
        Row: {
          role_id: number
          user_id: string
        }
        Insert: {
          role_id: number
          user_id: string
        }
        Update: {
          role_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_role_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "sys_role"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sys_user_role_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_user_skill: {
        Row: {
          created_at: string
          expires_at: string | null
          id: number
          level: string | null
          notes: string | null
          skill_name: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: number
          level?: string | null
          notes?: string | null
          skill_name: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: number
          level?: string | null
          notes?: string | null
          skill_name?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_skill_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      sys_user_training: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: number
          notes: string | null
          provider: string | null
          result: string | null
          training_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: number
          notes?: string | null
          provider?: string | null
          result?: string | null
          training_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: number
          notes?: string | null
          provider?: string | null
          result?: string | null
          training_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sys_user_training_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignee: {
        Row: {
          assigned_at: string
          assigned_by: string
          id: number
          task_id: number
          unassigned_at: string | null
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          id?: number
          task_id: number
          unassigned_at?: string | null
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          id?: number
          task_id?: number
          unassigned_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignee_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignee_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignee_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
        ]
      }
      task_group_assignee: {
        Row: {
          assigned_at: string
          assigned_by: string
          group_id: number
          id: number
          task_id: number
          unassigned_at: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          group_id: number
          id?: number
          task_id: number
          unassigned_at?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          group_id?: number
          id?: number
          task_id?: number
          unassigned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_group_assignee_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_group_assignee_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "lab_group"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_group_assignee_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      task_resource: {
        Row: {
          id: number
          quantity: number | null
          resource_id: number
          resource_type: string
          task_id: number
          unit: string | null
        }
        Insert: {
          id?: number
          quantity?: number | null
          resource_id: number
          resource_type: string
          task_id: number
          unit?: string | null
        }
        Update: {
          id?: number
          quantity?: number | null
          resource_id?: number
          resource_type?: string
          task_id?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_resource_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sample: {
        Row: {
          sample_id: number
          task_id: number
        }
        Insert: {
          sample_id: number
          task_id: number
        }
        Update: {
          sample_id?: number
          task_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_sample_sample_id_fkey"
            columns: ["sample_id"]
            isOneToOne: false
            referencedRelation: "sample"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_sample_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_history: {
        Row: {
          from_status: string | null
          id: number
          occurred_at: string
          operator_id: string
          remark: string | null
          task_id: number
          to_status: string
        }
        Insert: {
          from_status?: string | null
          id?: number
          occurred_at?: string
          operator_id: string
          remark?: string | null
          task_id: number
          to_status: string
        }
        Update: {
          from_status?: string | null
          id?: number
          occurred_at?: string
          operator_id?: string
          remark?: string | null
          task_id?: number
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "sys_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "experiment_task"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_permission: { Args: { _permission_code: string }; Returns: boolean }
      has_role: { Args: { _role_code: string }; Returns: boolean }
      transition_sample_flow: {
        Args: {
          _handover_to?: string
          _location?: string
          _node: string
          _remark?: string
          _sample_id: number
        }
        Returns: Json
      }
      replace_task_assignments: {
        Args: {
          _group_ids?: number[]
          _task_id: number
          _user_ids?: string[]
        }
        Returns: Json
      }
      transition_task: {
        Args: {
          _remark?: string
          _task_id: number
          _to_status: string
        }
        Returns: Json
      }
      record_audit_event: {
        Args: {
          _action: string
          _after_json?: Json
          _before_json?: Json
          _object_id: string
          _object_type: string
          _required_permission: string
        }
        Returns: undefined
      }
      validate_processing_inputs: {
        Args: {
          _rule_id: number
          _source_data_ids: number[]
          _task_id: number
        }
        Returns: Database["public"]["Tables"]["experiment_processing_rule"]["Row"]
      }
      execute_experiment_processing: {
        Args: {
          _decision?: string | null
          _execution_mode: string
          _explanation?: string
          _output_type: string
          _processed_value: number
          _rule_id: number
          _source_data_ids: number[]
          _status: string
          _task_id: number
        }
        Returns: Json
      }
      record_experiment_processing_failure: {
        Args: {
          _error_code: string
          _error_message: string
          _execution_mode: string
          _rule_id: number
          _source_data_ids: number[]
          _task_id: number
        }
        Returns: Json
      }
      review_task_result: {
        Args: {
          _comment?: string | null
          _result: string
          _task_id: number
        }
        Returns: Json
      }
      generate_report: {
        Args: { _task_id: number }
        Returns: Json
      }
      submit_report_for_review: {
        Args: { _remark?: string | null; _report_id: number }
        Returns: Json
      }
      publish_report: {
        Args: { _remark?: string | null; _report_id: number }
        Returns: Json
      }
      archive_report: {
        Args: { _remark?: string | null; _report_id: number }
        Returns: Json
      }
      create_instrument: {
        Args: { _payload: Json }
        Returns: Json
      }
      update_instrument: {
        Args: { _instrument_id: number; _payload: Json }
        Returns: Json
      }
      record_instrument_maintenance: {
        Args: { _instrument_id: number; _payload: Json }
        Returns: Json
      }
      create_inventory_item: {
        Args: { _payload: Json }
        Returns: Json
      }
      update_inventory_item: {
        Args: { _item_id: number; _payload: Json }
        Returns: Json
      }
      record_inventory_transaction: {
        Args: { _item_id: number; _payload: Json }
        Returns: Json
      }
      get_inventory_alerts: {
        Args: { _days?: number }
        Returns: Json
      }
      set_role_permissions: {
        Args: { _permission_codes: string[]; _role_id: number }
        Returns: undefined
      }
      set_user_roles: {
        Args: { _role_codes: string[]; _target_user_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
