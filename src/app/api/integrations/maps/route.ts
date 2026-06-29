import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentRestaurant } from '@/lib/auth'

// GET /api/integrations/maps - restoran manzilini Yandex/Google Maps formatida
// Body: ?address=... (yetkazib berish manzili uchun)
export async function GET(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const deliveryAddress = searchParams.get('address')

    // Restaurant address
    const restaurantAddress = restaurant.address || ''
    const restaurantName = encodeURIComponent(restaurant.name)
    const restaurantAddrEnc = encodeURIComponent(restaurantAddress)

    // Generate map URLs
    const yandexMapUrl = restaurantAddress
      ? `https://yandex.uz/maps/?text=${restaurantAddrEnc}&z=16`
      : `https://yandex.uz/maps/?text=${restaurantName}`

    const googleMapUrl = restaurantAddress
      ? `https://www.google.com/maps/search/?api=1&query=${restaurantAddrEnc}`
      : `https://www.google.com/maps/search/?api=1&query=${restaurantName}`

    // Yandex embed (for iframe)
    const yandexEmbed = restaurantAddress
      ? `https://yandex.uz/map-widget/v1/?text=${restaurantAddrEnc}&z=16`
      : `https://yandex.uz/map-widget/v1/?text=${restaurantName}&z=16`

    // Google embed
    const googleEmbed = restaurantAddress
      ? `https://maps.google.com/maps?q=${restaurantAddrEnc}&z=16&output=embed`
      : `https://maps.google.com/maps?q=${restaurantName}&z=16&output=embed`

    // If delivery address is provided, calculate route
    let route = null
    if (deliveryAddress) {
      const deliveryEnc = encodeURIComponent(deliveryAddress)
      route = {
        yandexRoute: `https://yandex.uz/maps/?rtext=${restaurantAddrEnc}~${deliveryEnc}&rtt=auto`,
        googleRoute: `https://www.google.com/maps/dir/?api=1&origin=${restaurantAddrEnc}&destination=${deliveryEnc}&travelmode=driving`,
        yandexRouteEmbed: `https://yandex.uz/map-widget/v1/?rtext=${restaurantAddrEnc}~${deliveryEnc}&rtt=auto`,
        googleRouteEmbed: `https://maps.google.com/maps?saddr=${restaurantAddrEnc}&daddr=${deliveryEnc}&output=embed`
      }
    }

    return NextResponse.json({
      restaurant: {
        name: restaurant.name,
        address: restaurantAddress,
        phone: restaurant.phone
      },
      maps: {
        yandex: yandexMapUrl,
        google: googleMapUrl,
        yandexEmbed,
        googleEmbed
      },
      route
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST - generate map for delivery order (customer address)
export async function POST(req: NextRequest) {
  try {
    const restaurant = await getCurrentRestaurant()
    if (!restaurant) return NextResponse.json({ error: 'Avtorizatsiya' }, { status: 401 })

    const body = await req.json()
    const { customerAddress, customerName, customerPhone } = body

    if (!customerAddress) {
      return NextResponse.json({ error: 'Mijoz manzili kerak' }, { status: 400 })
    }

    const restaurantAddrEnc = encodeURIComponent(restaurant.address || restaurant.name)
    const deliveryEnc = encodeURIComponent(customerAddress)

    return NextResponse.json({
      success: true,
      delivery: {
        customerName,
        customerPhone,
        customerAddress,
        restaurantAddress: restaurant.address
      },
      maps: {
        yandexRoute: `https://yandex.uz/maps/?rtext=${restaurantAddrEnc}~${deliveryEnc}&rtt=auto`,
        googleRoute: `https://www.google.com/maps/dir/?api=1&origin=${restaurantAddrEnc}&destination=${deliveryEnc}&travelmode=driving`,
        yandexEmbed: `https://yandex.uz/map-widget/v1/?rtext=${restaurantAddrEnc}~${deliveryEnc}&rtt=auto`,
        googleEmbed: `https://maps.google.com/maps?saddr=${restaurantAddrEnc}&daddr=${deliveryEnc}&output=embed`,
        // Static map (preview)
        yandexStatic: `https://static-maps.yandex.uz/1.x/?ll=${deliveryEnc}&z=14&l=map&pt=${deliveryEnc},pm2rdm`
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
