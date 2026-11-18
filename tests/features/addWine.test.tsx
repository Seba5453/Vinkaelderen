import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { APIConnectionError } from "@anthropic-ai/sdk";
import AddWinePage from "../../src/features/add/AddWinePage";
import { db } from "../../src/db/db";
import { addWine, listWines, listPurchases } from "../../src/db/repo";
import { fakeClient, okResponse } from "../ai/fakeClient";
import { info } from "../factories";

vi.mock("../../src/ai/image", () => ({
  downscaleImage: async (f: Blob) => ({ blob: f, base64: "AAA", mediaType: "image/jpeg" }),
}));

beforeEach(async () => { await db.delete(); await db.open(); });

const photo = () => new File(["img"], "label.jpg", { type: "image/jpeg" });
const renderPage = (client: ReturnType<typeof fakeClient>) =>
  render(<MemoryRouter><AddWinePage client={client} /></MemoryRouter>);
const user = () => userEvent.setup();

async function scan(u: ReturnType<typeof userEvent.setup>) {
  await u.upload(screen.getByLabelText("Tag billede"), photo());
  await screen.findByText("Er det den rigtige vin?");
}

test("scan fills form; nothing saved until Gem pressed", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await scan(u);
  expect(screen.getByLabelText("Navn")).toHaveValue("Château Musar");
  expect(screen.getByLabelText("Årgang (tom = NV)")).toHaveValue("2016");
  expect(screen.getByText(/AI-vurdering/)).toHaveTextContent("4,2");
  expect(await listWines()).toHaveLength(0);
  await u.click(screen.getByRole("button", { name: "Én flaske mere" }));
  await u.type(screen.getByLabelText("Pris pr. flaske (kr.)"), "250");
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  expect(await screen.findByText("Gemt!")).toBeInTheDocument();
  const [w] = await listWines();
  expect(w).toMatchObject({ name: "Château Musar", quantity: 2 });
  expect(w.photoId).not.toBeNull();
  expect((await listPurchases())[0].pricePerBottle).toBe(250);
});

test("changing vintage then Gem triggers lookup, shows updated form, second Gem saves", async () => {
  const u = user();
  const client = fakeClient(okResponse(info()), okResponse(info({ vintage: 2019, drinkFrom: 2027, drinkTo: 2045, aiScore: 4.4, grapes: ["Cinsault"] })));
  renderPage(client);
  await scan(u);
  await u.clear(screen.getByLabelText("Druer (adskil med komma)"));
  await u.type(screen.getByLabelText("Druer (adskil med komma)"), "Syrah");
  await u.clear(screen.getByLabelText("Årgang (tom = NV)"));
  await u.type(screen.getByLabelText("Årgang (tom = NV)"), "2019");
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  expect(await screen.findByText("Oplysningerne er opdateret – tjek dem igen")).toBeInTheDocument();
  expect(client.calls).toHaveLength(2);
  expect(JSON.stringify(client.calls[1].messages)).toContain("2019");
  expect(screen.getByLabelText("Drikkes til (år)")).toHaveValue("2045");
  expect(screen.getByLabelText("Druer (adskil med komma)")).toHaveValue("Syrah");
  expect(await listWines()).toHaveLength(0);
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  await screen.findByText("Gemt!");
  expect((await listWines())[0]).toMatchObject({ vintage: 2019, drinkTo: 2045, grapes: ["Syrah"] });
  expect(client.calls).toHaveLength(2);
});

test("AI error shows Danish message and empty editable form; manual save works", async () => {
  const u = user();
  renderPage(fakeClient(new APIConnectionError({ message: "down" })));
  await u.upload(screen.getByLabelText("Tag billede"), photo());
  expect(await screen.findByText(/Ingen forbindelse/)).toBeInTheDocument();
  await u.type(screen.getByLabelText("Navn"), "Husets rødvin");
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  await screen.findByText("Gemt!");
  expect((await listWines())[0]).toMatchObject({ name: "Husets rødvin", vintage: null });
});

test("saving without a name shows an error", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await u.click(screen.getByRole("button", { name: "Indtast manuelt" }));
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  expect(await screen.findByText("Vinen skal have et navn")).toBeInTheDocument();
  expect(await listWines()).toHaveLength(0);
});

test("low confidence shows unsure hint", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info({ aiConfidence: "lav" }))));
  await scan(u);
  expect(screen.getByText("AI'en er usikker – tjek oplysningerne")).toBeInTheDocument();
});

test("duplicate prompts and adds purchase to existing wine", async () => {
  const existing = await addWine(info(), { photo: null, bottles: 3, pricePerBottle: 200 });
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await scan(u);
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  expect(await screen.findByText("Du har allerede denne vin (3 flasker). Tilføj som nyt køb?")).toBeInTheDocument();
  await u.click(screen.getByRole("button", { name: "Tilføj til eksisterende" }));
  await screen.findByText("Gemt!");
  const wines = await listWines();
  expect(wines).toHaveLength(1);
  expect(wines[0]).toMatchObject({ id: existing.id, quantity: 4 });
  expect(await listPurchases()).toHaveLength(2);
});

test("NV entry saves with vintage null", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info({ name: "Vintage Port", vintage: null, type: "hedvin" }))));
  await scan(u);
  expect(screen.getByLabelText("Årgang (tom = NV)")).toHaveValue("");
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  await screen.findByText("Gemt!");
  expect((await listWines())[0].vintage).toBeNull();
});

test("Scan næste flaske resets the page", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await scan(u);
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  await u.click(await screen.findByRole("button", { name: "Scan næste flaske" }));
  await waitFor(() => expect(screen.getByLabelText("Tag billede")).toBeInTheDocument());
  expect(screen.queryByText("Er det den rigtige vin?")).toBeNull();
});

test("FIX-I4 double tap on Gem creates one wine", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await scan(u);
  const btn = screen.getByRole("button", { name: "Gem i Min Vinkælder" });
  await Promise.all([u.click(btn), u.click(btn)]);
  await screen.findByText("Gemt!");
  expect(await listWines()).toHaveLength(1);
});

test("FIX-I4 storage failure shows a Danish error instead of failing silently", async () => {
  const u = user();
  renderPage(fakeClient(okResponse(info())));
  await scan(u);
  db.close({ disableAutoOpen: true });
  await u.click(screen.getByRole("button", { name: "Gem i Min Vinkælder" }));
  expect(await screen.findByText(/Kunne ikke gemme/)).toBeInTheDocument();
  await db.open();
});
