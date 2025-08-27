import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'Open Interest API endpoint' });
}