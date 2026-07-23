import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { ALLOWED_TYPES, MAX_VIDEO_BYTES } from "@/lib/attachments";

// Udsteder et scoped, korttids client-token, så browseren kan uploade billeder/
// videoer DIREKTE til Vercel Blob (privat). Bytes rører aldrig serveren.
//
// Sikkerhed: middleware-matcheren ekskluderer /api, så denne route er IKKE
// beskyttet af middleware — den tjekker selv sessionen (requireSession), ellers
// kunne enhver på internettet få et upload-token. Token'et begrænser desuden
// content-type (billede/video) og størrelse server-side.
export async function POST(request: Request): Promise<Response> {
  if ((await requireSession()) == null) return unauthorized();

  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // clientPayload markerer kun konteksten (order/subscription/complete) til
        // pathname-navngivning på klienten; ingen tillid lægges i den her.
        const scope = typeof clientPayload === "string" && /^(order|subscription|complete)$/.test(clientPayload)
          ? clientPayload : "misc";
        return {
          allowedContentTypes: ALLOWED_TYPES,
          // Ét fælles loft (video-grænsen). Pr-type-loft (billeder 10 MB) håndhæves
          // på klienten før upload — content-type kendes ikke ved token-udstedelse.
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + 60 * 60 * 1000,
          tokenPayload: JSON.stringify({ scope }),
        };
      },
      onUploadCompleted: async () => {
        // Blob findes nu i storen. DB-rækken (Attachment) oprettes først når
        // formularen gemmes; blobs uden matchende række ryddes af en GC-sweep.
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
