// Supabase client - rasm yuklash uchun (Supabase Storage)
// Production'da Supabase Storage ishlatiladi
// Local dev'da (env yo'q bo'lsa) base64 fallback ishlaydi

import { createClient, SupabaseClient } from '@supabase/supabase-js'

let supabaseClient: SupabaseClient | null = null

/**
 * Supabase client - faqat environment variable'lar bo'lganda yaratiladi
 */
export function getSupabase(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return null // Local dev mode - base64 fallback
  }

  supabaseClient = createClient(url, key, {
    auth: { persistSession: false }
  })

  return supabaseClient
}

/**
 * Supabase Storage ishlatiladimi?
 */
export function isSupabaseStorageEnabled(): boolean {
  return getSupabase() !== null
}

/**
 * Rasmni Supabase Storage'ga yuklash
 * @param buffer - rasm buffer (sharp tomonidan resize qilingan)
 * @param fileName - fayl nomi (masalan: product-<id>.jpg)
 * @returns public URL yoki null (agar Supabase yo'q bo'lsa)
 */
export async function uploadToSupabaseStorage(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg'
): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null

  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'product-images'

  try {
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType,
        upsert: true // overwrite if exists
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      return null
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName)

    return urlData.publicUrl
  } catch (e) {
    console.error('Supabase storage error:', e)
    return null
  }
}

/**
 * Supabase Storage'dan rasmni o'chirish
 */
export async function deleteFromSupabaseStorage(fileName: string): Promise<boolean> {
  const supabase = getSupabase()
  if (!supabase) return false

  const bucketName = process.env.SUPABASE_BUCKET_NAME || 'product-images'

  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName])

    return !error
  } catch (e) {
    console.error('Supabase storage delete error:', e)
    return false
  }
}
