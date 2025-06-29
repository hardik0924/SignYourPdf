import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string
          file_name: string
          file_url: string
          uploader_id: string
          status: 'pending' | 'signed'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          file_name: string
          file_url: string
          uploader_id: string
          status?: 'pending' | 'signed'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          file_name?: string
          file_url?: string
          uploader_id?: string
          status?: 'pending' | 'signed'
          created_at?: string
          updated_at?: string
        }
      }
      signatures: {
        Row: {
          id: string
          user_id: string
          document_id: string
          page: number
          x: number
          y: number
          type: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'company'
          content: string
          font: string | null
          status: 'pending' | 'applied'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          document_id: string
          page: number
          x: number
          y: number
          type: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'company'
          content: string
          font?: string | null
          status?: 'pending' | 'applied'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          document_id?: string
          page?: number
          x?: number
          y?: number
          type?: 'signature' | 'initials' | 'name' | 'date' | 'text' | 'company'
          content?: string
          font?: string | null
          status?: 'pending' | 'applied'
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}