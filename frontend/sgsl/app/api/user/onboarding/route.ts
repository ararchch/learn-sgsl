import { NextResponse } from 'next/server';
import { createUser, getUser, updateUser } from '@/lib/db';
import { ONBOARDING_VERSION } from '@/lib/onboarding';

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? '').trim();
    const action = String(body?.action ?? '').trim();

    if (!username) {
      return NextResponse.json(
        { error: 'Username is required.' },
        { status: 400 },
      );
    }

    const existing = (await getUser(username)) ?? (await createUser(username));

    if (action === 'complete') {
      const profile = await updateUser(username, {
        onboardingVersionCompleted: Math.max(
          existing.onboardingVersionCompleted,
          ONBOARDING_VERSION,
        ),
      });

      return NextResponse.json(profile, { status: 200 });
    }

    if (action === 'reset') {
      const profile = await updateUser(username, {
        onboardingVersionCompleted: 0,
      });

      return NextResponse.json(profile, { status: 200 });
    }

    return NextResponse.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Onboarding update error', error);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'production'
            ? 'Unable to update onboarding.'
            : `Unable to update onboarding. ${toErrorMessage(error)}`,
      },
      { status: 500 },
    );
  }
}
