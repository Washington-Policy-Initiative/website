/** /research/washington-library-gap-map/data.json: built once at build time from the CSVs. */
import { clientData } from '../../../lib/gapmap';

export function GET() {
  return new Response(JSON.stringify(clientData()), { headers: { 'Content-Type': 'application/json' } });
}
