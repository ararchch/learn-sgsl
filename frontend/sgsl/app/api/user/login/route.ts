import { NextResponse } from 'next/server';
import { createUser, getUser, touchLogin } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    const existing = await getUser(username);
    const profile = existing ? await touchLogin(username) : await createUser(username);

    return NextResponse.json(profile, { status: 200 });
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json(
      { error: 'Unable to login right now.' },
      { status: 500 },
    );
  }
}
