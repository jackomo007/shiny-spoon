import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'Global Snapshot API endpoint' });
}