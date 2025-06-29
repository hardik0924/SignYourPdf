/*
  # Create signatures table

  1. New Tables
    - `signatures`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `document_id` (uuid, foreign key to documents)
      - `page` (integer)
      - `x` (numeric)
      - `y` (numeric)
      - `type` (enum: signature, initials, name, date, text, company)
      - `content` (text)
      - `font` (text, nullable)
      - `status` (enum: pending, applied)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `signatures` table
    - Add policy for users to manage their own signatures
*/

CREATE TABLE IF NOT EXISTS signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  page integer NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  type text CHECK (type IN ('signature', 'initials', 'name', 'date', 'text', 'company')) NOT NULL,
  content text NOT NULL,
  font text,
  status text CHECK (status IN ('pending', 'applied')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own signatures"
  ON signatures
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_signatures_updated_at
  BEFORE UPDATE ON signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();