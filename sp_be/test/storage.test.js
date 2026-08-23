const storage = require('../utils/storage');

describe('storage utils (Supabase Storage)', () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(status, body) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body)
    };
  }

  it('creates the bucket when it is missing (404 → POST public)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, { message: 'Bucket not found' }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'venue_images' }));

    await storage.ensureBucket();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [getCall, createCall] = fetchMock.mock.calls;
    expect(getCall[0]).toContain('/storage/v1/bucket/venue_images');
    expect(createCall[1].method).toBe('POST');
    expect(JSON.parse(createCall[1].body)).toEqual(
      expect.objectContaining({ id: 'venue_images', name: 'venue_images', public: true })
    );
  });

  it('does nothing when the bucket exists and is public', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: 'venue_images', public: true }));

    await storage.ensureBucket();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].method).toBeUndefined();
  });

  it('makes an existing private bucket public', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: 'venue_images', public: false }))
      .mockResolvedValueOnce(jsonResponse(200, { id: 'venue_images', public: true }));

    await storage.ensureBucket();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const update = fetchMock.mock.calls[1];
    expect(update[1].method).toBe('PUT');
    expect(JSON.parse(update[1].body)).toEqual({ public: true });
  });

  it('throws when bucket provisioning fails (fail closed)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(404, {}))
      .mockResolvedValueOnce(jsonResponse(403, { message: 'Forbidden' }));

    await expect(storage.ensureBucket()).rejects.toThrow(/Forbidden/);
  });

  it('uploads an object and returns the absolute public URL', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { Key: 'venue_images/abc.png' }));

    const url = await storage.uploadObject('abc.png', Buffer.from('bytes'), 'image/png');

    expect(url).toBe(
      'https://project.supabase.co/storage/v1/object/public/venue_images/abc.png'
    );
    const [callPath, callOpts] = fetchMock.mock.calls[0];
    expect(callPath).toContain('/storage/v1/object/venue_images/abc.png');
    expect(callOpts.method).toBe('POST');
    expect(callOpts.headers['Content-Type']).toBe('image/png');
    expect(callOpts.headers.apikey).toBeTruthy();
    expect(callOpts.headers.Authorization).toBe('Bearer test-service-role-key');
    expect(Buffer.isBuffer(callOpts.body)).toBe(true);
  });

  it('sends the service-role key as both apikey and Bearer (new sb_* key format)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { Key: 'x.png' }));

    await storage.uploadObject('x.png', Buffer.from('b'), 'image/png');

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers).toEqual(
      expect.objectContaining({
        apikey: 'test-service-role-key',
        Authorization: 'Bearer test-service-role-key'
      })
    );
  });

  it('treats a 404 delete as success', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { message: 'Object not found' }));
    await expect(storage.deleteObject('gone.png')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('treats a 400-with-statusCode-404 delete as success (real Supabase shape)', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { statusCode: '404', error: 'not_found', message: 'Object not found', code: 'NoSuchKey' })
    );
    await expect(storage.deleteObject('gone.png')).resolves.toBeUndefined();
  });

  it('rejects a failed delete', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { message: 'boom' }));
    await expect(storage.deleteObject('x.png')).rejects.toThrow(/boom/);
  });

  it('extracts object names only from bucket URLs', () => {
    expect(
      storage.extractObjectName(
        'https://project.supabase.co/storage/v1/object/public/venue_images/abc.png'
      )
    ).toBe('abc.png');
    expect(storage.extractObjectName('/uploads/legacy.jpg')).toBeNull();
    expect(storage.extractObjectName('https://evil.example.com/x.png')).toBeNull();
    expect(storage.extractObjectName(undefined)).toBeNull();
  });
});