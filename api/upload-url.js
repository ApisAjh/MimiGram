import crypto from 'crypto';
import { requireAuth } from '../lib/session.js';
import { getServiceClient } from '../lib/supabase.js';
import { json, error, handleOptions, parseBody, rateLimit } from '../lib/http.js';

const ALLOWED_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO = ['video/mp4', 'video/webm'];
const MAX_IMAGE = parseInt(process.env.MAX_IMAGE_SIZE || '10485760', 10);
const MAX_VIDEO = parseInt(process.env.MAX_VIDEO_SIZE || '52428800', 10);

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return handleOptions(req, res);
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed', null, req);

  try {
    const user = await requireAuth(req, res);
    if (!user) return;
    if (!rateLimit(`upload:${user.id}`, 15, 60000)) return error(res, 429, 'Too many upload requests', null, req);

    const body = await parseBody(req);
    const { filename, contentType, size } = body;
    if (!filename || !contentType) return error(res, 400, 'filename and contentType required', null, req);

    const isImage = ALLOWED_IMAGE.includes(contentType);
    const isVideo = ALLOWED_VIDEO.includes(contentType);
    if (!isImage && !isVideo) return error(res, 400, 'Unsupported type', null, req);
    if (isImage && size > MAX_IMAGE) return error(res, 400, 'Image too large', null, req);
    if (isVideo && size > MAX_VIDEO) return error(res, 400, 'Video too large', null, req);

    const ext = (filename.split('.').pop() || (isImage ? 'jpg' : 'mp4')).toLowerCase().replace(/[^a-z0-9]/g, '');
    const objectPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const supabase = getServiceClient();
    const { data, error: signErr } = await supabase.storage.from('media').createSignedUploadUrl(objectPath);
    if (signErr) {
      console.error(signErr);
      const msg = signErr.message || 'Failed to create upload URL';
      if (/bucket|not found/i.test(msg)) {
        return error(res, 500, 'Bucket "media" belum ada di Supabase Storage', null, req);
      }
      return error(res, 500, `Upload URL gagal: ${msg}`, null, req);
    }

    const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const publicUrl = base ? `${base}/storage/v1/object/public/media/${objectPath}` : null;
    return json(res, 200, {
      path: objectPath,
      signedUrl: data.signedUrl,
      token: data.token,
      publicUrl,
      media_type: isImage ? 'image' : 'video',
    }, req);
  } catch (err) {
    console.error('upload-url:', err);
    return error(res, 500, 'Internal server error', null, req);
  }
}
