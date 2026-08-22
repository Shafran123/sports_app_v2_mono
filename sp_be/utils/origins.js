// Origin allow-list for Socket.IO. FRONTEND_URL stays the player-facing base
// (PayHere return_url, QR/email links) — sockets admit every admin/user origin
// explicitly so the console can connect without hijacking FRONTEND_URL's
// meaning. Falls back to FRONTEND_URL when the allow-list is unset.
function getAllowedOrigins(env = process.env) {
  const list = (env.SOCKET_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : [env.FRONTEND_URL].filter(Boolean);
}

module.exports = { getAllowedOrigins };