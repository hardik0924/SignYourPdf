/*
  # Fix RLS policy for documents table

  1. Security Changes
    - Drop the existing incorrect INSERT policy on documents table
    - Create proper INSERT policy allowing authenticated users to create documents where uploader_id matches their user ID
    - Create proper SELECT policy allowing users to read their own documents
    - Create proper UPDATE policy allowing users to update their own documents
    - Create proper DELETE policy allowing users to delete their own documents

  2. Notes
    - The existing policy has incorrect logic and naming
    - New policies will use auth.uid() to match the current user's ID with uploader_id
    - This ensures users can only manage their own documents
*/

-- Drop the existing incorrect policy
DROP POLICY IF EXISTS "Enable read access for all users" ON documents;

-- Create proper RLS policies for the documents table
CREATE POLICY "Users can insert their own documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Users can read their own documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (uploader_id = auth.uid());

CREATE POLICY "Users can update their own documents"
  ON documents
  FOR UPDATE
  TO authenticated
  USING (uploader_id = auth.uid())
  WITH CHECK (uploader_id = auth.uid());

CREATE POLICY "Users can delete their own documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (uploader_id = auth.uid());