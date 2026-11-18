import { fitWithin } from "../../src/ai/image";
test("landscape fits", () => expect(fitWithin(4032, 3024, 1568)).toEqual({ width: 1568, height: 1176 }));
test("portrait fits", () => expect(fitWithin(3024, 4032, 1568)).toEqual({ width: 1176, height: 1568 }));
test("small image unchanged", () => expect(fitWithin(800, 600, 1568)).toEqual({ width: 800, height: 600 }));
