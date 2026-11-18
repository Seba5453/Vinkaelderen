import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CellarPage from "../../src/features/cellar/CellarPage";
import { db } from "../../src/db/db";
import { addWine, adjustQuantity, getWineDetail } from "../../src/db/repo";
import { info } from "../factories";

beforeEach(async () => { await db.delete(); await db.open(); });
const renderPage = () => render(<MemoryRouter><CellarPage /></MemoryRouter>);
const rows = () => screen.getAllByRole("listitem");

async function seed() {
  await addWine(info({ name: "Ung Barolo", drinkFrom: 2090, drinkTo: 2099, type: "rod" }), { photo: null, bottles: 2, pricePerBottle: null });
  await addWine(info({ name: "Gammel Rioja", drinkFrom: 2000, drinkTo: 2001, type: "rod" }), { photo: null, bottles: 1, pricePerBottle: null });
  await addWine(info({ name: "Taylor's Port", producer: "Taylor's", vintage: null, drinkFrom: null, drinkTo: null, type: "hedvin" }), { photo: null, bottles: 3, pricePerBottle: null });
}

test("default sort is drink-first and shows status badges", async () => {
  await seed();
  renderPage();
  await screen.findByText(/Gammel Rioja/);
  expect(rows().map((r) => within(r).getByRole("link").textContent)).toEqual([
    expect.stringContaining("Gammel Rioja"), expect.stringContaining("Ung Barolo"), expect.stringContaining("Taylor's Port"),
  ]);
  expect(within(rows()[0]).getByText("Drik snart")).toBeInTheDocument();
  expect(within(rows()[1]).getByText("Gem")).toBeInTheDocument();
  expect(screen.getByText("6 flasker · 3 vine")).toBeInTheDocument();
});

test("search and type filter narrow the list", async () => {
  await seed();
  const u = userEvent.setup();
  renderPage();
  await screen.findByText(/Gammel Rioja/);
  await u.type(screen.getByLabelText("Søg i vinkælderen"), "barolo");
  await waitFor(() => expect(rows()).toHaveLength(1));
  await u.clear(screen.getByLabelText("Søg i vinkælderen"));
  await u.click(screen.getByRole("button", { name: "Hedvin (portvin m.m.)" }));
  await waitFor(() => expect(rows()).toHaveLength(1));
  expect(rows()[0]).toHaveTextContent("Taylor's Port");
});

test("NV wine displays NV", async () => {
  await seed();
  renderPage();
  const port = (await screen.findByText(/Taylor's Port/)).closest("li")!;
  expect(port).toHaveTextContent("NV");
});

test("empty wines hidden unless Vis tomme", async () => {
  const w = await addWine(info({ name: "Tom flaske" }), { photo: null, bottles: 1, pricePerBottle: null });
  await adjustQuantity(w.id, -1);
  const u = userEvent.setup();
  renderPage();
  expect(await screen.findByText("Din vinkælder er tom")).toBeInTheDocument();
  await u.click(await screen.findByLabelText("Vis tomme"));
  expect(await screen.findByText(/Tom flaske/)).toBeInTheDocument();
});

test("minus at 0 stays 0", async () => {
  const w = await addWine(info({ name: "Sidste flaske" }), { photo: null, bottles: 1, pricePerBottle: null });
  const u = userEvent.setup();
  renderPage();
  await u.click(await screen.findByLabelText("Vis tomme"));
  const row = (await screen.findByText(/Sidste flaske/)).closest("li")!;
  await u.click(within(row).getByRole("button", { name: "Én flaske mindre" }));
  await waitFor(async () => expect((await getWineDetail(w.id))!.wine.quantity).toBe(0));
  expect(within(row).getByRole("button", { name: "Én flaske mindre" })).toBeDisabled();
});

test("plus adds a bottle without a purchase", async () => {
  const w = await addWine(info({ name: "Plus" }), { photo: null, bottles: 1, pricePerBottle: null });
  const u = userEvent.setup();
  renderPage();
  const row = (await screen.findByText(/Plus/)).closest("li")!;
  await u.click(within(row).getByRole("button", { name: "Én flaske mere" }));
  await waitFor(async () => expect((await getWineDetail(w.id))!.wine.quantity).toBe(2));
  expect((await getWineDetail(w.id))!.purchases).toHaveLength(1);
});

const overview = () => screen.getByRole("group", { name: "Overblik" });

test("overview counts wines to drink soon and ready, and filters the list", async () => {
  await seed();
  await addWine(info({ name: "Klar Chianti", drinkFrom: 2020, drinkTo: 2090, type: "rod" }), { photo: null, bottles: 4, pricePerBottle: null });
  const u = userEvent.setup();
  renderPage();
  await screen.findByText(/Klar Chianti/);
  const soon = within(overview()).getByRole("button", { name: "Drik snart: 1" });
  expect(within(overview()).getByRole("button", { name: "Klar: 1" })).toBeInTheDocument();
  await u.click(soon);
  expect(soon).toHaveAttribute("aria-pressed", "true");
  expect(rows().map((r) => within(r).getByRole("link").textContent)).toEqual([expect.stringContaining("Gammel Rioja")]);
  await u.click(soon);
  expect(rows()).toHaveLength(4);
});

test("overview is hidden when nothing is ready or due", async () => {
  await addWine(info({ name: "Ung Barolo", drinkFrom: 2090, drinkTo: 2099 }), { photo: null, bottles: 2, pricePerBottle: null });
  renderPage();
  await screen.findByText(/Ung Barolo/);
  expect(screen.queryByRole("group", { name: "Overblik" })).not.toBeInTheDocument();
});

test("empty wines are not counted in the overview", async () => {
  const w = await addWine(info({ name: "Gammel Rioja", drinkFrom: 2000, drinkTo: 2001 }), { photo: null, bottles: 1, pricePerBottle: null });
  await addWine(info({ name: "Klar Chianti", drinkFrom: 2020, drinkTo: 2090 }), { photo: null, bottles: 1, pricePerBottle: null });
  await adjustQuantity(w.id, -1);
  renderPage();
  await screen.findByText(/Klar Chianti/);
  expect(within(overview()).queryByRole("button", { name: /Drik snart/ })).not.toBeInTheDocument();
  expect(within(overview()).getByRole("button", { name: "Klar: 1" })).toBeInTheDocument();
});

test("when the last due wine runs out, the filter lets go and the full list shows", async () => {
  await seed();
  const u = userEvent.setup();
  renderPage();
  await u.click(await screen.findByRole("button", { name: "Drik snart: 1" }));
  await u.click(within(rows()[0]).getByRole("button", { name: "Én flaske mindre" }));
  await waitFor(() => expect(rows()).toHaveLength(2));
  expect(screen.queryByRole("button", { name: /Drik snart/ })).not.toBeInTheDocument();
});
