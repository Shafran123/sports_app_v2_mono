// Local Supabase Storage stand-in: answers the bucket existence/creation
// calls the backend makes at boot (sp_be/utils/storage.js ensureBucket) so
// the harness never touches the real project. Uploads/downloads 404.
import http from "node:http";

const PORT = Number(process.env.PORT || 2499);

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(body === undefined ? "" : JSON.stringify(body));
  };

  if (req.method === "GET" && url.pathname === "/storage/v1/bucket/venue_images") {
    return send(404, { statusCode: "404", error: "Bucket not found" });
  }
  if (req.method === "POST" && url.pathname === "/storage/v1/bucket") {
    return send(201, { id: "venue_images", name: "venue_images", public: true });
  }
  if (req.method === "PUT" && url.pathname.startsWith("/storage/v1/bucket/")) {
    return send(200, { id: "venue_images", name: "venue_images", public: true });
  }
  if (url.pathname.startsWith("/storage/v1/object/")) {
    return send(404, { statusCode: "404", error: "Object not found" });
  }
  return send(404, { statusCode: "404", error: "Not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`storage stub listening on ${PORT}`);
});