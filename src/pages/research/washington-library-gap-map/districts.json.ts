/** /research/washington-library-gap-map/districts.json: simplified district shapes for the map. */
import { mapShapes } from '../../../lib/gapmap';

export function GET() {
  return new Response(JSON.stringify(mapShapes()), { headers: { 'Content-Type': 'application/json' } });
}
