import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getUserHandle, rpFromRequest, RP_NAME } from "@/lib/webauthn";

/**
 * Step 1 of passkey registration. Returns options the browser feeds to
 * navigator.credentials.create(). The user must already be signed in
 * (with a password) to register a new passkey.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isAuthed) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { rpID } = rpFromRequest(req);

  const existing = await db.passkey.findMany({
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userID: getUserHandle(),
    userName: "owner@project-cip.srl",
    userDisplayName: "Project CIP SRL owner",
    attestationType: "none",
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      // Allow both platform (Face ID / Touch ID) and cross-platform
      // (security keys) authenticators.
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (c.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
  });

  session.currentChallenge = options.challenge;
  await session.save();

  return NextResponse.json(options);
}

type AuthenticatorTransportFuture =
  | "ble"
  | "hybrid"
  | "internal"
  | "nfc"
  | "usb"
  | "cable"
  | "smart-card";
