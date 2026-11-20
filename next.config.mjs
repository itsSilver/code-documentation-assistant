/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` only serves its own assets and hot reload to localhost by default. These let the
  // app be opened by loopback IP or from another device on the local network. Dev only.
  allowedDevOrigins: ["127.0.0.1", "[::1]", "0.0.0.0", "192.168.*.*", "10.*.*.*"],
  // The floating dev badge covers the file tree in screenshots and demos.
  devIndicators: false,
  // Native modules must not be bundled.
  serverExternalPackages: [
    "better-sqlite3",
    "sqlite-vec",
    "web-tree-sitter",
    "tree-sitter-wasms",
    "@huggingface/transformers",
    "onnxruntime-node",
  ],
};

export default nextConfig;
