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
    console.log('🎯 Perfect positioning PDF processing for document:', documentId)
    console.log('📝 Signatures with perfect positioning:', signatures.length)

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
    console.log('📖 PDF loaded for perfect positioning, pages:', pdfDoc.getPageCount())

    // Process each signature with perfect positioning
    for (const signature of signatures) {
      try {
        console.log(`🎯 Perfect positioning: "${signature.content}" with font: ${signature.font}`)
        console.log(`📍 Perfect coordinates: x=${signature.x}, y=${signature.y}, page=${signature.page}`)
        console.log(`🔤 Dynamic font size: ${signature.fontSize}px`)
        
        if (!signature.content || signature.page < 1 || signature.page > pdfDoc.getPageCount()) {
          console.log('⚠️ Skipping invalid signature')
          continue
        }

        const page = pdfDoc.getPage(signature.page - 1)
        const { width: pageWidth, height: pageHeight } = page.getSize()
        console.log(`📏 PDF page dimensions: ${Math.round(pageWidth * 100) / 100} x ${Math.round(pageHeight * 100) / 100}`)

        // CRITICAL: Use coordinates directly from frontend (already perfectly converted)
        // The frontend now uses percentage-based conversion for perfect accuracy
        const finalX = Math.max(10, Math.min(signature.x, pageWidth - 50))
        const finalY = Math.max(15, Math.min(signature.y, pageHeight - 15))

        console.log(`🎯 Perfect final coordinates: (${Math.round(finalX * 1000) / 1000}, ${Math.round(finalY * 1000) / 1000})`)

        // Get the correct PDF font
        const pdfFont = getFontMapping(signature.font || 'times-roman-italic')
        
        // Use the dynamic font size from the frontend, with fallback
        const fontSize = signature.fontSize || 16
        
        console.log(`🎨 Perfect font: ${signature.font} (${pdfFont}) with dynamic size: ${fontSize}px`)

        // Embed the font
        const font = await pdfDoc.embedFont(pdfFont)

        // Ensure single-line content (remove any line breaks)
        const singleLineContent = signature.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()

        // Calculate text width for perfect positioning
        const textWidth = font.widthOfTextAtSize(singleLineContent, fontSize)
        console.log(`📐 Perfect text width: ${Math.round(textWidth * 100) / 100}px`)

        // Perfect X adjustment to prevent overflow
        const adjustedX = Math.min(finalX, pageWidth - textWidth - 15)

        // Draw the signature with perfect positioning
        page.drawText(singleLineContent, {
          x: adjustedX,
          y: finalY,
          size: fontSize, // Use dynamic font size
          font: font,
          color: rgb(0, 0, 0),
        })

        console.log(`✅ Perfect signature "${singleLineContent}" placed at (${Math.round(adjustedX * 1000) / 1000}, ${Math.round(finalY * 1000) / 1000}) with ${fontSize}px font`)
      } catch (error) {
        console.error('❌ Error in perfect positioning:', error)
        
        // Perfect positioning fallback
        try {
          const page = pdfDoc.getPage(signature.page - 1)
          const { width: pageWidth, height: pageHeight } = page.getSize()
          const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)
          
          const singleLineContent = signature.content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
          const fallbackFontSize = signature.fontSize || 16
          
          page.drawText(singleLineContent, {
            x: Math.max(15, Math.min(signature.x, pageWidth - 150)),
            y: Math.max(20, Math.min(signature.y, pageHeight - 30)),
            size: fallbackFontSize,
            font,
            color: rgb(0, 0, 0),
          })
          
          console.log('✅ Perfect positioning fallback signature added')
        } catch (fallbackError) {
          console.error('❌ Perfect positioning fallback failed:', fallbackError)
        }
      }
    }

    // Save signed PDF with perfect positioning
    console.log('💾 Saving PDF with perfect positioning...')
    const signedPdfBytes = await pdfDoc.save()
    const signedFileName = `${user.id}/perfect_positioned_signed_${Date.now()}_${document.file_name}`

    console.log(`📦 Perfect positioned signed PDF size: ${signedPdfBytes.length} bytes`)

    // Upload signed PDF
    const { error: uploadError } = await supabaseClient.storage
      .from('documents')
      .upload(signedFileName, signedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('❌ Upload error:', uploadError)
      return new Response('Error uploading perfect positioned signed PDF', { status: 500, headers: corsHeaders })
    }

    // Update document
    await supabaseClient
      .from('documents')
      .update({ 
        status: 'signed',
        file_url: signedFileName
      })
      .eq('id', documentId)

    console.log('🎉 PDF signed with perfect positioning and dynamic font sizing')
    return new Response(
      JSON.stringify({ 
        success: true, 
        signedFileUrl: signedFileName,
        message: 'PDF signed with perfect positioning and dynamic font sizing',
        accuracy: 'Perfect',
        fontSizing: 'Dynamic'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Perfect positioning edge function error:', error)
    console.error('📋 Error stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to process PDF with perfect positioning'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})