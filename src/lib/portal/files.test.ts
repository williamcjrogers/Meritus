import { describe, expect, it } from "vitest";
import { contentDisposition, formatBytes } from "./files";

describe("contentDisposition", () => {
  it("quotes an ASCII name and adds the UTF-8 form", () => {
    expect(contentDisposition("Letter of claim.pdf")).toBe(
      `attachment; filename="Letter of claim.pdf"; filename*=UTF-8''Letter%20of%20claim.pdf`
    );
  });
  it("replaces quotes and non-ASCII in the plain name but keeps them in the encoded one", () => {
    expect(contentDisposition('Café "final".pdf')).toBe(
      `attachment; filename="Caf_ _final_.pdf"; filename*=UTF-8''Caf%C3%A9%20%22final%22.pdf`
    );
  });
});

describe("formatBytes", () => {
  it("scales to GB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 ** 2)).toBe("3.0 MB");
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.50 GB");
  });
});
