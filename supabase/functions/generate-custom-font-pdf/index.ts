import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from 'https://esm.sh/pdf-lib@1.17.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Map our font values to actual PDF-lib StandardFonts
const getFontMapping = (fontValue: string) => {
  switch (fontValue) {
    case 'times-roman-italic':
      return StandardFonts.TimesRomanItalic
    case 'helvetica-bold':
      return StandardFonts.HelveticaBold
    case 'helvetica-oblique':
      return StandardFonts.HelveticaOblique
    case 'times-roman-bold':
      return StandardFonts.TimesRomanBold
    case 'courier-bold':
      return StandardFonts.CourierBold
    case 'helvetica':
      return StandardFonts.Helvetica
    default:
      return StandardFonts.TimesRomanItalic // Default fallback
  }
}

// Get appropriate font size based on signature type
const getFontSize = (signatureType: string) => {
  switch (signatureType) {
    case 'signature':
      return 28
    case 'initials':
      return 22
    case 'name':
      return 18
    case 'company':
      return 16
    case 'text':
      return 14
    case 'date':
      return 14
    default:
      return 16
  }
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

    const { documentId, signatures } = await req.json()
    console.log('🔧 Processing document ID:', documentId)
    console.log('📝 Signatures to process:', signatures.length)

    // Get user
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      console.error('❌ No authenticated user found')
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

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

    // Download original PDF
    const { data: pdfData, error: downloadError } = await supabaseClient.storage
      .from('documents')
      .download(document.file_url)

    if (downloadError || !pdfData) {
      console.error('❌ PDF download error:', downloadError)
      return new Response('Error downloading PDF', { status: 500, headers: corsHeaders })
    }

    // Load PDF
    const pdfBytes = await pdfData.arrayBuffer()
    const pdfDoc = await PDFDocument.load(pdfBytes)
    console.log('📖 PDF loaded successfully, pages:', pdfDoc.getPageCount())

    // Process each signature with accurate positioning
    for (const signature of signatures) {
      try {
        console.log(`🖊️ Processing signature: "${signature.content}" with font: ${signature.font}`)
        console.log(`📍 Received coordinates: x=${signature.x}, y=${signature.y}, page=${signature.page}`)
        
        if (!signature.content || signature.page < 1 || signature.page > pdfDoc.getPageCount()) {
          console.log('⚠️ Skipping invalid signature')
          continue
        }

        const page = pdfDoc.getPage(signature.page - 1)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        console.log(`📏 PDF page dimensions: ${pageWidth} x ${pageHeight}`)

        // The coordinates are now already in PDF coordinate system from the frontend
        // Just ensure they're within bounds
        const finalX = Math.max(20, Math.min(signature.x, pageWidth - 200))
        const finalY = Math.max(20, Math.min(signature.y, pageHeight - 50))

        console.log(`📍 Final PDF coordinates: (${Math.round(finalX)}, ${Math.round(finalY)})`)

        // Get the correct PDF font
        const pdfFont = getFontMapping(signature.font || 'times-roman-italic')
        const fontSize = getFontSize(signature.type)
        
        console.log(`🎨 Using PDF font: ${signature.font} (${pdfFont}) with size: ${fontSize}`)

        // Embed the font
        const font = await pdfDoc.embedFont(pdfFont)

        // Calculate text width for better positioning
        const textWidth = font.widthOfTextAtSize(signature.content, fontSize)
        console.log(`📐 Text width: ${Math.round(textWidth)}px`)

        // Adjust X position if text would overflow
        const adjustedX = Math.min(finalX, pageWidth - textWidth - 20)

        // Draw the signature
        page.drawText(signature.content.trim(), {
          x: adjustedX,
          y: finalY,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
        })

        console.log(`✅ Signature "${signature.content}" placed at (${Math.round(adjustedX)}, ${Math.round(finalY)}) with ${signature.font} font`)
      } catch (error) {
        console.error('❌ Error processing signature:', error)
        
        // Fallback: add basic signature
        try {
          const page = pdfDoc.getPage(signature.page - 1)
          const { width: pageWidth, height: pageHeight } = page.getSize()
          const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
          
          page.drawText(signature.content, {
            x: Math.max(20, Math.min(signature.x, pageWidth - 200)),
            y: Math.max(24, Math.min(signature.y, pageHeight - 50)),
            size: 24,
            font,
            color: rgb(0, 0, 0),
          })
          
          console.log('✅ Fallback signature added')
        } catch (fallbackError) {
          console.error('❌ Fallback signature failed:', fallbackError)
        }
      }
    }

    // Save signed PDF
    console.log('💾 Saving PDF with accurate positioning...')
    const signedPdfBytes = await pdfDoc.save()
    const signedFileName = `${user.id}/signed_${Date.now()}_${document.file_name}`

    console.log(`📦 Signed PDF size: ${signedPdfBytes.length} bytes`)

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

    // Update document
    await supabaseClient
      .from('documents')
      .update({ 
        status: 'signed',
        file_url: signedFileName
      })
      .eq('id', documentId)

    console.log('🎉 PDF signed successfully with accurate positioning')
    return new Response(
      JSON.stringify({ 
        success: true, 
        signedFileUrl: signedFileName,
        message: 'PDF signed with accurate positioning'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Edge function error:', error)
    console.error('📋 Error stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to process PDF with accurate positioning'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})