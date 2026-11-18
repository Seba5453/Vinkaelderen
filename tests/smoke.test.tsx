import { render, screen } from "@testing-library/react";
import App from "../src/App";
test("shows Min Vinkælder", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Min Vinkælder" })).toBeInTheDocument();
});
