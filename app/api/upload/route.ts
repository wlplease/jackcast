import { NextResponse } from "next/server";
import { handleUpload, handleUploadPresigned, type HandleUploadBody } from "@vercel/blob/client";
import { issueSignedToken } from "@vercel/blob";
import { getViewer } from "@/lib/viewer";

// Lets the browser upload photos straight to Vercel Blob, so big files never pass through a function.
// Supports both kinds of Blob store Vercel creates:
//   - newer stores: BLOB_STORE_ID + BLOB_WEBHOOK_PUBLIC_KEY, authenticated with the project's Vercel OIDC token
//   - older stores: BLOB_READ_WRITE_TOKEN
// The password gate in middleware covers this route; we also require a connected signer.

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;
const ONE_YEAR = 60 * 60 * 24 * 365;

type Mode = "presigned" | "token" | null;

function mode(): Mode {
  if (process.env.BLOB_STORE_ID && process.env.BLOB_WEBHOOK_PUBLIC_KEY) return "presigned";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "token";
  return null;
}

async function authorize(pathname: string) {
  const v = await getViewer();
  if (!v?.canWrite) throw new Error("Connect your account at /setup first.");
  if (!/^(casts|pfp)\/[\w.-]+$/.test(pathname)) throw new Error("Unexpected upload path.");
}

/** Tells the browser which upload flow this deployment supports. */
export async function GET() {
  return NextResponse.json({ mode: mode() });
}

export async function POST(request: Request) {
  const m = mode();
  if (!m) {
    return NextResponse.json(
      { error: "Photo uploads need Vercel Blob. In Vercel: Storage, Create, Blob, then connect it to this project and redeploy." },
      { status: 501 }
    );
  }
  const body = await request.json();
  try {
    if (m === "presigned") {
      const json = await handleUploadPresigned({
        body,
        request,
        getSignedToken: async (pathname) => {
          await authorize(pathname);
          const token = await issueSignedToken({
            pathname,
            operations: ["put"],
            allowedContentTypes: ALLOWED,
            maximumSizeInBytes: MAX_BYTES,
            validUntil: Date.now() + 10 * 60 * 1000,
          });
          return {
            token,
            urlOptions: {
              allowedContentTypes: ALLOWED,
              maximumSizeInBytes: MAX_BYTES,
              addRandomSuffix: true,
              cacheControlMaxAge: ONE_YEAR,
            },
          };
        },
      });
      return NextResponse.json(json);
    }

    const json = await handleUpload({
      body: body as HandleUploadBody,
      request,
      onBeforeGenerateToken: async (pathname) => {
        await authorize(pathname);
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: ONE_YEAR,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
