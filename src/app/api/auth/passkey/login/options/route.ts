import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { rpFromRequest } from "@/lib/webauthn";

export async function POST(req: Request) {
  const { rpID } = rpFromRequest(req);

  const passkeys = await db.passkey.findMany({
    select: { credentialId: true, transports: true },
  });

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: passkeys.map((p) => ({
      id: p.credentialId,
      transports: p.transports
        ? (p.transports.split(",") as AuthenticatorTransportFuture[])
        : undefined,
    })),
  });

  const session = await getSession();
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
