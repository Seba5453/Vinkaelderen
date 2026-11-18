import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WineDetailPage from "../../src/features/cellar/WineDetailPage";
import { db } from "../../src/db/db";
import { addWine, getWineDetail } from "../../src/db/repo";
import { info } from "../factories";

beforeEach(async () => { await db.delete(); await db.open(); });
const renderAt = (id: string) => render(
  <MemoryRouter initialEntries={[`/vin/${id}`]}><Routes><Route path="/vin/:id" element={<WineDetailPage />} /></Routes></MemoryRouter>,
);

test("shows details, AI score, window and purchases", async () => {
  const w = await addWine(info(), { photo: null, bottles: 3, pricePerBottle: 200, date: "2026-03-01" });
  renderAt(w.id);
  expect(await screen.findByRole("heading", { name: /Château Musar/ })).toBeInTheDocument();
  expect(screen.getByText(/AI-vurdering/).closest("div")).toHaveTextContent("4,2 / 5");
  expect(screen.getByText("Drikkes 2024–2038")).toBeInTheDocument();
  expect(screen.getByText(/3 × 200 kr\./)).toBeInTheDocument();
});

test("Drak en flaske with rating 4 decrements and appears under Drukket", async () => {
  const w = await addWine(info(), { photo: null, bottles: 2, pricePerBottle: null });
  const u = userEvent.setup();
  renderAt(w.id);
  await u.click(await screen.findByRole("button", { name: "Drak en flaske" }));
  const dialog = screen.getByRole("dialog");
  await u.click(screen.getByRole("button", { name: "4" }));
  await u.type(screen.getByLabelText("Note"), "Fantastisk til lam");
  await u.click(screen.getByRole("button", { name: "Gem" }));
  await waitFor(() => expect(dialog).not.toBeInTheDocument());
  expect(await screen.findByText(/Fantastisk til lam/)).toBeInTheDocument();
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(1);
  expect(d.drinks[0].ownRating).toBe(4);
  expect(screen.getByText(/Din vurdering/).closest("div")).toHaveTextContent("4 / 5");
});

test("Drak en flaske disabled at 0", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  await db.wines.update(w.id, { quantity: 0 });
  renderAt(w.id);
  expect(await screen.findByRole("button", { name: "Drak en flaske" })).toBeDisabled();
});

test("Køb flere adds a purchase row with price", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: 200 });
  const u = userEvent.setup();
  renderAt(w.id);
  await u.click(await screen.findByRole("button", { name: "Køb flere" }));
  await u.clear(screen.getByLabelText("Antal flasker"));
  await u.type(screen.getByLabelText("Antal flasker"), "2");
  await u.type(screen.getByLabelText("Pris pr. flaske"), "250");
  await u.click(screen.getByRole("button", { name: "Tilføj køb" }));
  expect(await screen.findByText(/2 × 250 kr\./)).toBeInTheDocument();
  const d = (await getWineDetail(w.id))!;
  expect(d.wine.quantity).toBe(3);
  expect(d.purchases).toHaveLength(2);
});

test("NV wine shows NV in heading", async () => {
  const w = await addWine(info({ name: "Vintage Port", vintage: null }), { photo: null, bottles: 1, pricePerBottle: null });
  renderAt(w.id);
  expect(await screen.findByRole("heading", { name: /Vintage Port NV/ })).toBeInTheDocument();
});

test("unknown id shows not found", async () => {
  renderAt("nope");
  expect(await screen.findByText("Vinen findes ikke")).toBeInTheDocument();
});

test("Ret oplysninger saves edited notes without AI", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  const u = userEvent.setup();
  renderAt(w.id);
  await u.click(await screen.findByRole("button", { name: "Ret oplysninger" }));
  await u.clear(screen.getByLabelText("Smagsnoter"));
  await u.type(screen.getByLabelText("Smagsnoter"), "Ny note");
  await u.click(screen.getByRole("button", { name: "Gem" }));
  await waitFor(async () => expect((await getWineDetail(w.id))!.wine.notes).toBe("Ny note"));
});

test("FIX-I4 drink save failure shows a Danish error", async () => {
  const w = await addWine(info(), { photo: null, bottles: 2, pricePerBottle: null });
  const u = userEvent.setup();
  renderAt(w.id);
  await u.click(await screen.findByRole("button", { name: "Drak en flaske" }));
  db.close({ disableAutoOpen: true });
  await u.click(screen.getByRole("button", { name: "Gem" }));
  expect(await screen.findByText(/Kunne ikke gemme/)).toBeInTheDocument();
  await db.open();
});

test("FIX-M3 edit form refuses an empty name", async () => {
  const w = await addWine(info(), { photo: null, bottles: 1, pricePerBottle: null });
  const u = userEvent.setup();
  renderAt(w.id);
  await u.click(await screen.findByRole("button", { name: "Ret oplysninger" }));
  await u.clear(screen.getByLabelText("Navn"));
  await u.click(screen.getByRole("button", { name: "Gem" }));
  expect(await screen.findByText("Vinen skal have et navn")).toBeInTheDocument();
  expect((await getWineDetail(w.id))!.wine.name).toBe("Château Musar");
});
