import { ImageResponse } from "next/og";
import { DEFAULT_BRAND_NAME } from "@myslot/utils";

export const alt = `${DEFAULT_BRAND_NAME} — Your venue's own booking website`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#16a34a",
          color: "#fff"
        }}
      >
        <div style={{ fontSize: 44, fontWeight: 800, opacity: 0.9 }}>{DEFAULT_BRAND_NAME}</div>
        <div style={{ fontSize: 76, fontWeight: 800, marginTop: 24, lineHeight: 1.1 }}>
          Your venue&apos;s own booking website
        </div>
        <div style={{ fontSize: 34, marginTop: 28, opacity: 0.9 }}>
          Real-time slot booking · QR check-ins · Free for 3 months
        </div>
      </div>
    ),
    size
  );
}
