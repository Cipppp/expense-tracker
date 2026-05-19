import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  getSession,
  getSessionRemember,
} from "@/lib/session";
import { rpFromRequest } from "@/lib/webauthn";

const Body = z.object({
  response: z.any(),
  remember: z.boolean().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  const challenge = session.currentChallenge;
  if (!challenge) {
    return NextResponse.json(
      { error: "No login in progress" },
      { status: 400 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const credentialId = (parsed.data.response as AuthenticationResponseJSON).id;
  const passkey = await db.passkey.findUnique({ where: { credentialId } });
  if (!passkey) {
    return NextResponse.json({ error: "Unknown passkey" }, { status: 404 });
  }

  const { rpID, origin } = rpFromRequest(req);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: parsed.data.response as AuthenticationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credentialId,
        publicKey: Uint8Array.from(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports
          ? (passkey.transports.split(",") as AuthenticatorTransportFuture[])
          : undefined,
      },
      requireUserVerification: false,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 400 },
    );
  }

  if (!verification.verified) {
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  // Update counter + lastUsed.
  await db.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  // Authenticate using the appropriate session TTL.
  const authSession = parsed.data.remember
    ? await getSessionRemember()
    : await getSession();
  authSession.isAuthed = true;
  authSession.loginAt = Date.now();
  authSession.currentChallenge = undefined;
  await authSession.save();

  return NextResponse.json({ ok: true });
}

type AuthenticatorTransportFuture =
  | "ble"
  | "hybrid"
  | "internal"
  | "nfc"
  | "usb"
  | "cable"
  | "smart-card";
