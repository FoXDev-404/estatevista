export const cityCoordinates = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Goa: { lat: 15.2993, lng: 74.123 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Gurugram: { lat: 28.4595, lng: 77.0266 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kochi: { lat: 9.9312, lng: 76.2673 },
  Udaipur: { lat: 24.5854, lng: 73.7125 },
  Lonavala: { lat: 18.7509, lng: 73.4078 },
  Alibaug: { lat: 18.6414, lng: 72.8721 },
  Noida: { lat: 28.5355, lng: 77.391 },
  'New Delhi': { lat: 28.6139, lng: 77.209 },
  'Bandra West': { lat: 19.0588, lng: 72.8295 },
  'Koregaon Park': { lat: 18.5357, lng: 73.8988 },
  'Golf Course Road': { lat: 28.4305, lng: 77.0987 },
};

function createMapEmbedUrl(lat, lng, zoom = 13) {
  const delta = zoom >= 13 ? 0.035 : zoom >= 11 ? 0.12 : 0.2;
  const bbox = `${lng - delta},${lat - delta / 1.8},${lng + delta},${lat + delta / 1.8}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function getPropertyMapEmbedUrl(property) {
  if (!property) {
    return null;
  }

  if (property?.map?.embedUrl && /^https?:\/\//i.test(property.map.embedUrl)) {
    return property.map.embedUrl;
  }

  const lat = property?.map?.latitude ?? property?.location?.latitude;
  const lng = property?.map?.longitude ?? property?.location?.longitude;

  if (typeof lat === 'number' && typeof lng === 'number') {
    return createMapEmbedUrl(lat, lng, 13);
  }

  const city = property?.location?.city;
  const cityPoint = city ? cityCoordinates[city] : null;
  if (cityPoint) {
    return createMapEmbedUrl(cityPoint.lat, cityPoint.lng, 12);
  }

  const area = property?.location?.area;
  const areaPoint = area ? cityCoordinates[area] : null;
  if (areaPoint) {
    return createMapEmbedUrl(areaPoint.lat, areaPoint.lng, 12);
  }

  return null;
}
