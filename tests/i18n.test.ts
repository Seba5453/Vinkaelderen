import { da } from "../src/i18n/da";
test("FIX-M5 Danish singular/plural", () => {
  expect(da.cellar.totals(1, 1)).toBe("1 flaske · 1 vin");
  expect(da.cellar.totals(6, 3)).toBe("6 flasker · 3 vine");
  expect(da.add.duplicate(1)).toBe("Du har allerede denne vin (1 flaske). Tilføj som nyt køb?");
  expect(da.aiErrors["for-mange"]).toContain("har travlt");
});
