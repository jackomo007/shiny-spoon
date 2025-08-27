import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    return NextResponse.json({ message: `Journal entry ${id}` });
}