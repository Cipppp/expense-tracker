import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rpFromRequest } from "@/lib/webauthn";

const Body = z.object({
  label: z.string().min(1).max(60),
  // Loose validation — the full RegistrationResponseJSON shape is complex;
  // simplewebauthn will validate the contents.
  response: z.any(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isAuthed) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const challenge = session.currentChallenge;
  if (!challenge) {
    return NextResponse.json(
      { error: "No registration in progress" },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { rpID, origin } = rpFromRequest(req);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: parsed.data.response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 400 },
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  const passkey = await db.passkey.create({
    data: {
      label: parsed.data.label,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []).join(","),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });

  // Clear the challenge.
  session.currentChallenge = undefined;
  await session.save();

  return NextResponse.json({
    ok: true,
    passkey: { id: passkey.id, label: passkey.label, deviceType: passkey.deviceType },
  });
}
