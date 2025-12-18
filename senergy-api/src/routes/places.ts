import { Router, Request, Response } from 'express'
import { ratingService } from '@/services/rating.service'

const router = Router()

/**
 * GET /api/places/search
 * Search places by name and location
 */
router.get('/search', async (req: Request, res: Response) => {
  const requestStartTime = Date.now()
  try {
    const { query: searchQuery, location, category, radius } = req.query

    console.log(`[API] Places search request: query="${searchQuery}", location=${location}, radius=${radius}`)

    if (!searchQuery || typeof searchQuery !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required',
      })
    }

    // Use OpenStreetMap Nominatim API (free, no API key required)
    const params = new URLSearchParams({
      q: searchQuery,
      format: 'json',
      limit: '20',
      addressdetails: '1',
      extratags: '1',
      namedetails: '1',
    })

    // Add location bias if provided - prioritize very local results
    if (location) {
      const [lat, lng] = (location as string).split(',').map(Number)
      if (!isNaN(lat) && !isNaN(lng)) {
        // Use a much smaller radius for local results (5km instead of 10km)
        const searchRadius = parseFloat(radius as string) || 5000 // 5km default
        const radiusDeg = searchRadius / 111000 // Convert meters to degrees
        
        // Use viewbox to strongly bias search towards location
        params.append('viewbox', `${lng - radiusDeg},${lat + radiusDeg},${lng + radiusDeg},${lat - radiusDeg}`)
        params.append('bounded', '1') // Changed to 1 to prioritize within viewbox
        
        // Add location parameter for proximity sorting
        params.append('lat', lat.toString())
        params.append('lon', lng.toString())
      }
    }

    // Add user agent header (required by Nominatim)
    // Nominatim requires a valid User-Agent identifying your application
    // Use a more descriptive User-Agent to avoid being blocked
    const userAgent = process.env.NOMINATIM_USER_AGENT || 'SenergyApp/1.0 (https://senergy.app)'
    
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?${params.toString()}`
    console.log(`[API] Calling Nominatim API: ${nominatimUrl.substring(0, 100)}...`)
    
    const fetchStartTime = Date.now()
    const response = await fetch(
      nominatimUrl,
      {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en',
        },
      }
    )
    const fetchTime = Date.now() - fetchStartTime
    console.log(`[API] Nominatim API call took ${fetchTime}ms`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[API] ❌ Nominatim API error (${fetchTime}ms):`, response.status, response.statusText, errorText)
      
      // If forbidden, provide helpful error message
      if (response.status === 403 || response.status === 429) {
        throw new Error('Geocoding service temporarily unavailable. Please try again in a moment.')
      }
      
      throw new Error(`Geocoding service error: ${response.status} ${response.statusText}`)
    }

    const parseStartTime = Date.now()
    const data = await response.json()
    const parseTime = Date.now() - parseStartTime
    console.log(`[API] JSON parse took ${parseTime}ms`)

    // Ensure data is an array
    if (!Array.isArray(data)) {
      console.error('[API] ❌ Unexpected Nominatim response format:', data)
      return res.json({
        success: true,
        data: [],
        count: 0,
      })
    }

    console.log(`[API] Nominatim returned ${data.length} raw results`)

    // Sort by distance if location provided, then filter
    const sortStartTime = Date.now()
    let sortedData = data
    if (location) {
      const [lat, lng] = (location as string).split(',').map(Number)
      if (!isNaN(lat) && !isNaN(lng)) {
        sortedData = data.sort((a: any, b: any) => {
          const distA = Math.sqrt(
            Math.pow(parseFloat(a.lat) - lat, 2) + Math.pow(parseFloat(a.lon) - lng, 2)
          )
          const distB = Math.sqrt(
            Math.pow(parseFloat(b.lat) - lat, 2) + Math.pow(parseFloat(b.lon) - lng, 2)
          )
          return distA - distB
        })
      }
    }
    const sortTime = Date.now() - sortStartTime
    console.log(`[API] Sorting took ${sortTime}ms`)

    // Filter for places/establishments and format results
    const filterStartTime = Date.now()
    const places = sortedData
      .filter((item: any) => {
        // Filter for places, amenities, shops, etc.
        const itemClass = item.class || ''
        const itemType = item.type || ''
        const displayName = (item.display_name || '').toLowerCase()
        
        // Include restaurants, cafes, bars, pubs, shops, and other amenities
        const validClasses = ['amenity', 'shop', 'tourism', 'leisure', 'craft']
        const validTypes = [
          'restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'food_court',
          'shop', 'store', 'supermarket', 'mall',
          'cinema', 'theatre', 'museum', 'gallery',
          'park', 'gym', 'sports_centre', 'nightclub', 'club'
        ]
        
        return (
          validClasses.includes(itemClass) ||
          validTypes.includes(itemType) ||
          displayName.includes('restaurant') ||
          displayName.includes('cafe') ||
          displayName.includes('bar') ||
          displayName.includes('pub') ||
          displayName.includes('shop') ||
          displayName.includes('store') ||
          displayName.includes('mall') ||
          displayName.includes('cinema') ||
          displayName.includes('theater') ||
          displayName.includes('museum')
        )
      })
      .slice(0, 20)
    const filterTime = Date.now() - filterStartTime
    console.log(`[API] Filtering took ${filterTime}ms, found ${places.length} matching places`)

    // For each place, get stats from our database
    const statsStartTime = Date.now()
    console.log(`[API] Fetching stats for ${places.length} places...`)
    const placesWithStats = await Promise.all(
      places.map(async (place: any) => {
        // Create a unique ID from OSM data
        const placeId = place.osm_id ? `osm_${place.osm_type}_${place.osm_id}` : `nominatim_${place.place_id}`
        const stats = await ratingService.getPlaceStats(placeId)

        // Format address with better structure
        const addressParts = []
        if (place.address) {
          // Street address
          if (place.address.house_number && place.address.road) {
            addressParts.push(`${place.address.house_number} ${place.address.road}`)
          } else if (place.address.road) {
            addressParts.push(place.address.road)
          }
          
          // City/Town/Village
          const city = place.address.city || place.address.town || place.address.village || place.address.municipality
          if (city) addressParts.push(city)
          
          // State/Region
          if (place.address.state) addressParts.push(place.address.state)
          
          // Postal code
          if (place.address.postcode) addressParts.push(place.address.postcode)
          
          // Country
          if (place.address.country) addressParts.push(place.address.country)
        }
        
        // Fallback to display_name if no structured address
        const address = addressParts.length > 0 
          ? addressParts.join(', ') 
          : place.display_name.split(',').slice(0, 3).join(', ') // Take first 3 parts of display_name

        return {
          id: placeId,
          name: place.display_name.split(',')[0] || place.name || searchQuery,
          address: address || place.display_name,
          location: {
            lat: parseFloat(place.lat),
            lng: parseFloat(place.lon),
          },
          category: place.type || place.class || 'establishment',
          stats: stats || {
            totalRatings: 0,
            avgOverallScore: 0,
            byPersonality: {
              introvert: { avgScore: 0, count: 0 },
              ambivert: { avgScore: 0, count: 0 },
              extrovert: { avgScore: 0, count: 0 },
            },
            avgCategories: {
              crowdSize: 0,
              noiseLevel: 0,
              socialEnergy: 0,
              service: 0,
              cleanliness: 0,
              atmosphere: 0,
              accessibility: 0,
            },
            lastRatedAt: '',
          },
        }
      })
    )
    const statsTime = Date.now() - statsStartTime
    console.log(`[API] Stats fetching took ${statsTime}ms`)

    const totalTime = Date.now() - requestStartTime
    console.log(`[API] ✅ Search complete in ${totalTime}ms (fetch: ${fetchTime}ms, parse: ${parseTime}ms, sort: ${sortTime}ms, filter: ${filterTime}ms, stats: ${statsTime}ms) - returning ${placesWithStats.length} places`)

    res.json({
      success: true,
      data: placesWithStats,
      count: placesWithStats.length,
    })
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime
    console.error(`[API] ❌ Place search error after ${totalTime}ms:`, error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search places',
    })
  }
})

/**
 * GET /api/places/reverse
 * Reverse geocode coordinates to get address
 */
router.get('/reverse', async (req: Request, res: Response) => {
  const requestStartTime = Date.now()
  try {
    const { lat, lng } = req.query

    console.log(`[API] Reverse geocode request: lat=${lat}, lng=${lng}`)

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      })
    }

    const latNum = parseFloat(lat as string)
    const lngNum = parseFloat(lng as string)

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid coordinates',
      })
    }

    // Use OpenStreetMap Nominatim reverse geocoding API
    const params = new URLSearchParams({
      lat: latNum.toString(),
      lon: lngNum.toString(),
      format: 'json',
      addressdetails: '1',
      zoom: '18', // High detail level
    })

    const userAgent = process.env.NOMINATIM_USER_AGENT || 'SenergyApp/1.0 (https://senergy.app)'
    
    const fetchStartTime = Date.now()
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en',
        },
      }
    )
    const fetchTime = Date.now() - fetchStartTime
    console.log(`[API] Reverse geocode API call took ${fetchTime}ms`)

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`)
    }

    const parseStartTime = Date.now()
    const data = await response.json() as any
    const parseTime = Date.now() - parseStartTime
    console.log(`[API] Reverse geocode JSON parse took ${parseTime}ms`)

    // Format address
    const addressParts: string[] = []
    if (data.address) {
      // Street address
      if (data.address.house_number && data.address.road) {
        addressParts.push(`${data.address.house_number} ${data.address.road}`)
      } else if (data.address.road) {
        addressParts.push(data.address.road)
      }
      
      // City/Town/Village
      const city = data.address.city || data.address.town || data.address.village || data.address.municipality
      if (city) addressParts.push(city)
      
      // State/Region
      if (data.address.state) addressParts.push(data.address.state)
      
      // Postal code
      if (data.address.postcode) addressParts.push(data.address.postcode)
      
      // Country
      if (data.address.country) addressParts.push(data.address.country)
    }
    
    const address = addressParts.length > 0 
      ? addressParts.join(', ') 
      : (data.display_name || 'Current Location')

    const placeName = data.address?.name || 
                     data.address?.road || 
                     (data.address?.house_number ? 
                     `${data.address.house_number} ${data.address.road || ''}`.trim() :
                     'Current Location')

    const totalTime = Date.now() - requestStartTime
    console.log(`[API] ✅ Reverse geocode complete in ${totalTime}ms (fetch: ${fetchTime}ms, parse: ${parseTime}ms) - address: ${address}`)

    res.json({
      success: true,
      data: {
        id: `location_${latNum}_${lngNum}`,
        name: placeName,
        address: address,
        location: {
          lat: latNum,
          lng: lngNum,
        },
      },
    })
  } catch (error: any) {
    const totalTime = Date.now() - requestStartTime
    console.error(`[API] ❌ Reverse geocoding error after ${totalTime}ms:`, error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reverse geocode',
    })
  }
})

/**
 * GET /api/places/:placeId
 * Get full place details including all metadata
 */
router.get('/:placeId', async (req: Request, res: Response) => {
  try {
    const { placeId } = req.params

    // Get place from our database
    const stats = await ratingService.getPlaceStats(placeId)
    const ratings = await ratingService.getPlaceRatings(placeId)

    if (ratings.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Place not found',
      })
    }

    const firstRating = ratings[0]
    const place = {
      id: placeId,
      name: firstRating.placeName,
      address: firstRating.placeAddress,
      location: firstRating.location,
      stats: stats || {
        totalRatings: ratings.length,
        avgOverallScore: 0,
        byPersonality: {
          introvert: { avgScore: 0, count: 0 },
          ambivert: { avgScore: 0, count: 0 },
          extrovert: { avgScore: 0, count: 0 },
        },
        avgCategories: {
          crowdSize: 0,
          noiseLevel: 0,
          socialEnergy: 0,
          service: 0,
          cleanliness: 0,
          atmosphere: 0,
          accessibility: 0,
        },
        lastRatedAt: '',
      },
    }

    res.json({
      success: true,
      data: place,
    })
  } catch (error: any) {
    console.error('Get place error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch place',
    })
  }
})

export default router

