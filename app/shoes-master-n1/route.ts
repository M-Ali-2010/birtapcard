import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/r/go/17dd4885-174d-4e1c-b0fb-e7aa51d6ea65', request.url))
}
