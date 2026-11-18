import { decodeImage } from "../../src/ai/image";

afterEach(() => { vi.unstubAllGlobals(); });

test("FIX-I2 retries createImageBitmap without options when the option is unsupported", async () => {
  const calls: unknown[][] = [];
  vi.stubGlobal("createImageBitmap", async (...args: unknown[]) => {
    calls.push(args);
    if (args.length > 1) throw new TypeError("imageOrientation not supported");
    return { width: 10, height: 20, close() {} };
  });
  const img = await decodeImage(new Blob(["x"], { type: "image/jpeg" }));
  expect(img.width).toBe(10);
  expect(calls).toHaveLength(2);
});

test("FIX-I2 falls back to <img> decode when createImageBitmap is missing", async () => {
  vi.stubGlobal("createImageBitmap", undefined);
  const proto = HTMLImageElement.prototype as any;
  const orig = proto.decode;
  proto.decode = async function () { Object.defineProperty(this, "naturalWidth", { value: 30 }); Object.defineProperty(this, "naturalHeight", { value: 40 }); };
  try {
    const img = await decodeImage(new Blob(["x"], { type: "image/jpeg" }));
    expect([img.width, img.height]).toEqual([30, 40]);
  } finally { proto.decode = orig; }
});
