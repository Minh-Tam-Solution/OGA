import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(
        { error: 'not_implemented', target: 'sprint-3', message: 'Video generation is planned for Sprint 3 (Wan2GP integration).' },
        { status: 501 }
    );
}

export async function POST() {
    return NextResponse.json(
        { error: 'not_implemented', target: 'sprint-3', message: 'Video generation is planned for Sprint 3 (Wan2GP integration).' },
        { status: 501 }
    );
}
