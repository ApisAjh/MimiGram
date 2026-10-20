/**
 * POST /api/posts/upload-url
 * Returns a signed upload URL for Supabase Storage after auth.
 * Body: { filename: string, contentType: string, postType?: string }
 */

import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';
import crypto from 'crypto';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10); // 10MB
const MAX_VIDEO_SIZE = parseInt(process.env.MAX_VIDEO_SIZE || '52428800', 10); // 50MB

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed');

  try {
    const user = await requireAuth(req, res);
    if (!user) return;

    if (!rateLimit(`upload:${user.id}`, 15, 60000)) {
      return error(res, 429, 'Too many upload requests');
    }

    const body = await parseBody(req);
    const { filename, contentType, size } = body;

    if (!filename || !contentType) {
      return error(res, 400, 'filename and contentType required');
    }

    const isImage = ALLOWED_IMAGE.includes(contentType);
    const isVideo = ALLOWED_VIDEO.includes(contentType);
    if (!isImage && !isVideo) {
      return error(res, 400, 'Unsupported media type');
    }

    if (size != null) {
      const max = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
      if (size > max) {
        return error(res, 400, `File too large. Max ${Math.round(max / 1024 / 1024)}MB`);
      }
    }

    const ext = filename.split('.').pop()?.toLowerCase() || (isImage ? 'jpg' : 'mp4');
    const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const supabase = getServiceClient();
    const { data, error: signErr } = await supabase.storage
      .from('media')
      .createSignedUploadUrl(objectPath);

    if (signErr) {
      console.error('Signed URL error:', signErr);
      return error(res, 500, 'Failed to create upload URL');
    }

    return json(res, 200, {
      path: objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
      media_type: isImage ? 'image' : 'video',
    });
  } catch (err) {
    console.error(err);
    return error(res, 500, 'Internal server error');
  }
}
