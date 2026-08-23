const logger = require('./logger');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'venue_images';

const BASE_URL = `${SUPABASE_URL}/storage/v1`;

async function storageFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      ...(options.headers || {})
    }
  });
  return res;
}

async function ensureBucket() {
  const id = encodeURIComponent(SUPABASE_STORAGE_BUCKET);
  const res = await storageFetch(`/bucket/${id}`);
  if (res.status === 404) {
    const create = await storageFetch('/bucket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: SUPABASE_STORAGE_BUCKET, name: SUPABASE_STORAGE_BUCKET, public: true })
    });
    if (!create.ok) {
      throw new Error(`Failed to create storage bucket: ${create.status} ${await create.text()}`);
    }
    logger.info(`Storage bucket "${SUPABASE_STORAGE_BUCKET}" created (public)`);
    return;
  }
  if (!res.ok) {
    throw new Error(`Failed to fetch storage bucket: ${res.status} ${await res.text()}`);
  }
  const bucket = await res.json();
  if (!bucket.public) {
    const update = await storageFetch(`/bucket/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public: true })
    });
    if (!update.ok) {
      throw new Error(`Failed to make storage bucket public: ${update.status} ${await update.text()}`);
    }
    logger.info(`Storage bucket "${SUPABASE_STORAGE_BUCKET}" set public`);
  }
}

function publicUrl(objectName) {
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${objectName}`;
}

async function uploadObject(objectName, buffer, contentType) {
  const res = await storageFetch(`/object/${SUPABASE_STORAGE_BUCKET}/${objectName}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: buffer
  });
  if (!res.ok) {
    throw new Error(`Failed to upload to storage: ${res.status} ${await res.text()}`);
  }
  return publicUrl(objectName);
}

function extractObjectName(url) {
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
  if (typeof url === 'string' && url.startsWith(prefix)) {
    return url.slice(prefix.length);
  }
  return null;
}

async function deleteObject(objectName) {
  const res = await storageFetch(`/object/${SUPABASE_STORAGE_BUCKET}/${objectName}`, { method: 'DELETE' });
  if (res.status === 404) return;
  if (!res.ok) {
    const body = await res.text();
    try {
      if (Number(JSON.parse(body).statusCode) === 404) return;
    } catch {
      // not JSON — fall through to the error
    }
    throw new Error(`Failed to delete from storage: ${res.status} ${body}`);
  }
}

module.exports = { ensureBucket, uploadObject, deleteObject, extractObjectName, publicUrl };