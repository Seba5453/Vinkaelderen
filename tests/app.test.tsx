import { render, screen } from "@testing-library/react";
import App from "../src/App";
import { db } from "../src/db/db";
import { addWine, setSetting } from "../src/db/repo";
import { info } from "./factories";

beforeEach(async () => { await db.delete(); await db.open(); window.location.hash = ""; });

test("nav shows four Danish tabs", () => {
  render(<App />);
  const nav = screen.getByRole("navigation");
  for (const label of ["Min Vinkælder", "Tilføj vin", "Spørg", "Indstillinger"]) {
    expect(nav).toHaveTextContent(label);
  }
});

test("backup reminder banner when lastBackupAt older than 30 days and cellar not empty", async () => {
  await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  await setSetting("lastBackupAt", new Date(Date.now() - 40 * 864e5).toISOString());
  render(<App />);
  expect(await screen.findByRole("status")).toHaveTextContent(/sikkerhedskopi/i);
});

test("no reminder for empty cellar", async () => {
  render(<App />);
  await screen.findByRole("heading", { name: "Min Vinkælder" });
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole("status")).toBeNull();
});

test("no reminder after a recent backup", async () => {
  await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  await setSetting("lastBackupAt", new Date().toISOString());
  render(<App />);
  await new Promise((r) => setTimeout(r, 50));
  expect(screen.queryByRole("status")).toBeNull();
});
