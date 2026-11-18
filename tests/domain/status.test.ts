import { drinkStatus } from "../../src/domain/status";
test("before window is gem", () => expect(drinkStatus({ drinkFrom: 2028, drinkTo: 2035 }, 2026)).toBe("gem"));
test("inside window is klar", () => expect(drinkStatus({ drinkFrom: 2024, drinkTo: 2030 }, 2026)).toBe("klar"));
test("last year of window is drik-snart", () => expect(drinkStatus({ drinkFrom: 2020, drinkTo: 2026 }, 2026)).toBe("drik-snart"));
test("past window is drik-snart", () => expect(drinkStatus({ drinkFrom: 2015, drinkTo: 2022 }, 2026)).toBe("drik-snart"));
test("no window is ukendt", () => expect(drinkStatus({ drinkFrom: null, drinkTo: null }, 2026)).toBe("ukendt"));
test("only drinkTo known", () => expect(drinkStatus({ drinkFrom: null, drinkTo: 2030 }, 2026)).toBe("klar"));
test("only drinkFrom known, before it", () => expect(drinkStatus({ drinkFrom: 2030, drinkTo: null }, 2026)).toBe("gem"));
