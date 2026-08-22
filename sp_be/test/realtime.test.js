const { Realtime } = require('../realtime');

describe('realtime', () => {
  it('is a no-op when no server is attached', () => {
    const r = new Realtime();
    expect(r.emitToOwner('owner-1', 'booking.created', { id: 'b1' })).toBe(false);
  });

  it('emits to the owner room', () => {
    const r = new Realtime();
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    r.io = { to };
    const booking = { id: 'b1', status: 'confirmed' };

    r.emitToOwner('owner-1', 'booking.created', booking);

    expect(to).toHaveBeenCalledWith('owner:owner-1');
    expect(emit).toHaveBeenCalledWith('booking.created', booking);
  });
});