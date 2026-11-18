import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { APIConnectionError } from "@anthropic-ai/sdk";
import AskPage from "../../src/features/ask/AskPage";
import { db } from "../../src/db/db";
import { addWine, getWineDetail } from "../../src/db/repo";
import { fakeClient, okResponse } from "../ai/fakeClient";
import { info } from "../factories";

beforeEach(async () => { await db.delete(); await db.open(); });

async function seed() {
  const red = await addWine(info({ name: "Château Musar" }), { photo: null, bottles: 2, pricePerBottle: 300 });
  const port = await addWine(info({ name: "Taylor's 2000", producer: "Taylor's", type: "hedvin" }), { photo: null, bottles: 1, pricePerBottle: 600 });
  return { red, port };
}
const reply = (ids: string[], intro = "Sådan gør I") =>
  okResponse({ intro, recommendations: ids.map((wineId, i) => ({ wineId, reason: `Grund ${i + 1}` })) });
const renderPage = (client: ReturnType<typeof fakeClient>) => render(<MemoryRouter><AskPage client={client} /></MemoryRouter>);

async function ask(u: ReturnType<typeof userEvent.setup>, text: string) {
  await u.type(screen.getByLabelText("Dit spørgsmål"), text);
  await u.click(screen.getByRole("button", { name: "Spørg" }));
}

test("asks and renders ordered bottle cards", async () => {
  const { red, port } = await seed();
  const u = userEvent.setup();
  renderPage(fakeClient(reply([red.id, port.id])));
  await ask(u, "Forældre til middag, rødvin først og portvin senere?");
  expect(await screen.findByText("Sådan gør I")).toBeInTheDocument();
  const cards = screen.getAllByRole("article");
  expect(cards[0]).toHaveTextContent("Château Musar");
  expect(cards[0]).toHaveTextContent("Grund 1");
  expect(cards[1]).toHaveTextContent("Taylor's 2000");
});

test("sends only in-stock cellar with prices", async () => {
  const { red } = await seed();
  await db.wines.update(red.id, { quantity: 0 });
  const client = fakeClient(reply([]));
  const u = userEvent.setup();
  renderPage(client);
  await ask(u, "Hvad har vi?");
  await screen.findByText("Sådan gør I");
  expect(client.calls[0].system).not.toContain("Château Musar");
  expect(client.calls[0].system).toContain("600");
});

test("follow-up sends previous turns", async () => {
  const { red, port } = await seed();
  const client = fakeClient(reply([red.id]), reply([port.id], "Billigere bud"));
  const u = userEvent.setup();
  renderPage(client);
  await ask(u, "Første");
  await screen.findByText("Sådan gør I");
  await ask(u, "Noget billigere?");
  await screen.findByText("Billigere bud");
  const msgs = client.calls[1].messages;
  expect(msgs.map((m: any) => m.role)).toEqual(["user", "assistant", "user"]);
  expect(msgs[0].content).toBe("Første");
  expect(msgs[2].content).toBe("Noget billigere?");
});

test("Ny samtale clears history", async () => {
  const { red } = await seed();
  const client = fakeClient(reply([red.id]));
  const u = userEvent.setup();
  renderPage(client);
  await ask(u, "Første");
  await screen.findByText("Sådan gør I");
  await u.click(screen.getByRole("button", { name: "Ny samtale" }));
  expect(screen.queryByText("Sådan gør I")).toBeNull();
  await ask(u, "Ny");
  await waitFor(() => expect(client.calls).toHaveLength(2));
  expect(client.calls[1].messages).toHaveLength(1);
});

test("Åbn denne logs a drink", async () => {
  const { red } = await seed();
  const u = userEvent.setup();
  renderPage(fakeClient(reply([red.id])));
  await ask(u, "Hvad nu?");
  const card = (await screen.findAllByRole("article"))[0];
  await u.click(within(card).getByRole("button", { name: "Åbn denne" }));
  await u.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Gem" }));
  await waitFor(async () => expect((await getWineDetail(red.id))!.wine.quantity).toBe(1));
});

test("leaving and returning starts empty (not persisted)", async () => {
  const { red } = await seed();
  const u = userEvent.setup();
  const view = renderPage(fakeClient(reply([red.id])));
  await ask(u, "Hvad nu?");
  await screen.findByText("Sådan gør I");
  view.unmount();
  renderPage(fakeClient(reply([red.id])));
  expect(screen.queryByText("Sådan gør I")).toBeNull();
  expect(screen.queryByText("Hvad nu?")).toBeNull();
});

test("AI error keeps the typed question", async () => {
  await seed();
  const u = userEvent.setup();
  renderPage(fakeClient(new APIConnectionError({ message: "x" })));
  await ask(u, "Hvad skal vi drikke?");
  expect(await screen.findByText(/Ingen forbindelse/)).toBeInTheDocument();
  expect(screen.getByLabelText("Dit spørgsmål")).toHaveValue("Hvad skal vi drikke?");
});
