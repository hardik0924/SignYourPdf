import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { documentId, pageInfo } = await req.json()
    console.log('🔧 Processing document ID:', documentId)
    console.log('📏 Page info received:', pageInfo)

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      console.error('❌ No authenticated user found')
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }
    console.log('👤 User ID:', user.id)

    // Get document
    const { data: document, error: docError } = await supabaseClient
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('uploader_id', user.id)
      .single()

    if (docError || !document) {
      console.error('❌ Document fetch error:', docError)
      return new Response('Document not found', { status: 404, headers: corsHeaders })
    }
    console.log('📄 Document found:', document.file_name)

    // Get signatures with detailed logging
    console.log('🔍 Fetching signatures for document_id:', documentId, 'user_id:', user.id)
    const { data: signatures, error: sigError } = await supabaseClient
      .from('signatures')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', user.id)

    if (sigError) {
      console.error('❌ Signatures fetch error:', sigError)
      return new Response('Error fetching signatures', { status: 500, headers: corsHeaders })
    }

    console.log('📝 Raw signatures data:', JSON.stringify(signatures, null, 2))
    console.log('📊 Found signatures count:', signatures?.length || 0)

    if (!signatures || signatures.length === 0) {
      console.log('⚠️ No signatures found - returning original PDF')
      await supabaseClient
        .from('documents')
        .update({ status: 'signed' })
        .eq('id', documentId)

      return new Response(
        JSON.stringify({ success: true, message: 'No signatures to apply' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Download original PDF
    const filePath = document.file_url;
    console.log('⬇️ Downloading PDF from path:', filePath)

    const { data: pdfData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(filePath)

    if (downloadError || !pdfData) {
      console.error('❌ PDF download error:', downloadError)
      return new Response('Error downloading PDF', { status: 500, headers: corsHeaders })
    }

    // Load PDF
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    console.log('📖 PDF loaded successfully, pages:', pdfDoc.getPageCount())

    // Add signatures to PDF
    let signaturesProcessed = 0
    for (const signature of signatures) {
      try {
        console.log(`\n--- 🖊️ Processing signature ${signaturesProcessed + 1} ---`)
        console.log('📋 Signature data:', {
          id: signature.id,
          type: signature.type,
          page: signature.page,
          x: signature.x,
          y: signature.y,
          content: signature.content?.substring(0, 50) + '...',
          font: signature.font,
          status: signature.status
        })

        // Validate signature data
        if (!signature.content || signature.content.trim() === '') {
          console.log('⚠️ Skipping signature with empty content')
          continue
        }

        if (!signature.page || signature.page < 1 || signature.page > pdfDoc.getPageCount()) {
          console.log('❌ Invalid page number:', signature.page)
          continue
        }

        if (signature.x === null || signature.x === undefined || signature.y === null || signature.y === undefined) {
          console.log('❌ Invalid coordinates:', signature.x, signature.y)
          continue
        }

        const page = pdfDoc.getPage(signature.page - 1)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        console.log('📏 PDF page dimensions:', pageWidth, 'x', pageHeight)

        // CRITICAL FIX: Convert percentage coordinates to actual PDF coordinates
        // The coordinates are stored as percentages (0-100) of the page dimensions
        const xPercent = Number(signature.x)
        const yPercent = Number(signature.y)
        
        console.log('📊 Percentage coordinates from database:', xPercent, yPercent)

        // Convert percentages to actual PDF coordinates
        const actualX = (xPercent / 100) * pageWidth
        const actualY = (yPercent / 100) * pageHeight
        
        console.log('📍 Converted to actual coordinates:', actualX, actualY)

        // Determine font size based on signature type
        let fontSize = 14
        if (signature.type === 'signature') {
          fontSize = 22
        } else if (signature.type === 'initials') {
          fontSize = 20
        }
        console.log('📝 Font size:', fontSize)

        // CRITICAL FIX: Proper Y-axis conversion for PDF coordinate system
        // PDF coordinate system: (0,0) is bottom-left, Y increases upward
        // Our percentage system: (0,0) is top-left, Y increases downward
        // So we need to flip the Y coordinate
        const pdfX = Math.max(10, Math.min(actualX, pageWidth - 200))
        const pdfY = Math.max(fontSize + 10, pageHeight - actualY - fontSize)
        
        console.log('📍 Final PDF coordinates:', pdfX, pdfY)

        // Check if content is base64 image data (for signatures with styling)
        if (signature.content.startsWith('data:image/')) {
          console.log('🖼️ Processing image signature...')
          try {
            // Extract base64 data
            const base64Data = signature.content.split(',')[1]
            const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
            
            // Embed PNG image
            const image = await pdfDoc.embedPng(imageBytes)
            console.log('🖼️ Image embedded successfully')
            
            // Define signature dimensions based on type
            let signatureWidth = 150
            let signatureHeight = 60
            
            if (signature.type === 'initials') {
              signatureWidth = 80
              signatureHeight = 40
            } else if (signature.type === 'name' || signature.type === 'text' || signature.type === 'company') {
              signatureWidth = 120
              signatureHeight = 30
            }
            
            // Draw the signature image
            page.drawImage(image, {
              x: pdfX,
              y: pdfY,
              width: signatureWidth,
              height: signatureHeight,
            })
            
            console.log('✅ Image signature drawn successfully')
          } catch (imageError) {
            console.error('❌ Error processing signature image:', imageError)
            // Fallback to text
            const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
            page.drawText(signature.content.substring(0, 50), {
              x: pdfX,
              y: pdfY,
              size: fontSize,
              font: font,
              color: rgb(0, 0, 0),
            })
          }
        } else {
          // Handle text-based signatures
          console.log('📝 Processing text signature:', signature.content.substring(0, 50))
          
          // Use italic font for signatures to make them look more stylized
          const font = signature.type === 'signature' || signature.type === 'initials' 
            ? await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
            : await pdfDoc.embedFont(StandardFonts.Helvetica)
          
          console.log('🎨 Using font:', signature.type === 'signature' ? 'TimesRomanItalic' : 'Helvetica')

          // Draw text signature
          console.log('✏️ Drawing text on PDF...')
          page.drawText(signature.content.trim(), {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
          })
        }
        
        console.log('✅ Signature processed successfully')
        signaturesProcessed++
      } catch (error) {
        console.error('❌ Error adding signature:', error)
        console.error('📋 Error details:', error.message)
        // Continue with other signatures
      }
    }

    console.log(`\n📊 Total signatures processed: ${signaturesProcessed}/${signatures.length}`)

    // Save signed PDF
    console.log('💾 Saving signed PDF...')
    const signedPdfBytes = await pdfDoc.save()
    const signedFileName = `${user.id}/signed_${Date.now()}_${document.file_name}`

    console.log('⬆️ Uploading signed PDF to:', signedFileName)
    console.log('📦 Signed PDF size:', signedPdfBytes.length, 'bytes')

    // Upload signed PDF
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(signedFileName, signedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Upload error:', uploadError)
      return new Response('Error uploading signed PDF', { status: 500, headers: corsHeaders })
    }

    console.log('🔄 Updating document status...')
    // Update document status and file_url to point to signed version
    const { error: updateError } = await supabaseClient
      .from('documents')
      .update({ 
        status: 'signed',
        file_url: signedFileName
      })
      .eq('id', documentId)

    if (updateError) {
      console.error('❌ Error updating document:', updateError)
    }

    // Update signature status
    const { error: sigUpdateError } = await supabaseClient
      .from('signatures')
      .update({ status: 'applied' })
      .eq('document_id', documentId)
      .eq('user_id', user.id)

    if (sigUpdateError) {
      console.error('❌ Error updating signatures:', sigUpdateError)
    }

    console.log('🎉 Document signed successfully')
    return new Response(
      JSON.stringify({ 
        success: true, 
        signedFileUrl: signedFileName,
        signaturesProcessed: signaturesProcessed,
        totalSignatures: signatures.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Edge function error:', error)
    console.error('📋 Error stack:', error.stack)
    return new Response(
      JSON.stringify({ error: error.message, stack: error.stack }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})