import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SettingsPage from "../../src/features/settings/SettingsPage";
import { db } from "../../src/db/db";
import { getSetting } from "../../src/db/repo";

beforeEach(async () => { await db.delete(); await db.open(); });
const renderPage = () => render(<MemoryRouter><SettingsPage /></MemoryRouter>);

test("saving API key stores it", async () => {
  renderPage();
  await userEvent.type(screen.getByLabelText("API-nøgle"), "sk-ant-test");
  await userEvent.click(screen.getByRole("button", { name: "Gem nøgle" }));
  expect(await screen.findByText("Nøglen er gemt")).toBeInTheDocument();
  expect(await getSetting("apiKey")).toBe("sk-ant-test");
});

test("shows Aldrig when no backup made", async () => {
  renderPage();
  expect(await screen.findByText(/Sidste sikkerhedskopi: Aldrig/)).toBeInTheDocument();
});

test("bad restore file shows Danish error", async () => {
  renderPage();
  await userEvent.upload(screen.getByLabelText("Gendan fra fil"), new File(["{bad"], "x.json", { type: "application/json" }));
  await userEvent.click(await screen.findByRole("button", { name: "Ja, gendan" }));
  expect(await screen.findByText(/Filen kunne ikke læses/)).toBeInTheDocument();
});
