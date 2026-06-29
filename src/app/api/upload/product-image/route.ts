import { NextRequest, NextResponse } from 'next/server'
import { getCurrentRestaurant } from '@/lib/auth'
import sharp from 'sharp'

// POST /api/upload/product-image - taom rasmini yuklash
// Accepts: multipart/form-data with 'file' field
// Returns: { success: true, imageUrl: 'data:image/jpeg;base64,...' }
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya talab qilinadi' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Fayl topilmadi' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Faqat rasm fayli yuklash mumkin (JPG, PNG, WebP)' }, { status: 400 })
    }

    // Validate size (max 10MB before processing)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Maksimal fayl hajmi 10MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Resize and compress with sharp:
    // - Max 800x800 (square crop for uniform card display)
    // - JPEG format for smaller size
    // - Quality 85 for good balance
    const processed = await sharp(buffer)
      .resize(800, 800, { fit: 'cover', position: 'center', withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()

    // Convert to base64 data URL (works everywhere: local + Vercel)
    const dataUrl = `data:image/jpeg;base64,${processed.toString('base64')}`

    return NextResponse.json({
      success: true,
      imageUrl: dataUrl,
      size: processed.length
    })
  } catch (e: any) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: 'Rasm yuklash xatosi: ' + e.message }, { status: 500 })
  }
}
