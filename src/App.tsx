import { HashRouter, NavLink, Route, Routes } from "react-router-dom";
import { da } from "./i18n/da";
import CellarPage from "./features/cellar/CellarPage";
import WineDetailPage from "./features/cellar/WineDetailPage";
import AddWinePage from "./features/add/AddWinePage";
import AskPage from "./features/ask/AskPage";
import SettingsPage from "./features/settings/SettingsPage";

export default function App() {
  return (
    <HashRouter>
      <main className="content">
        <Routes>
          <Route path="/" element={<CellarPage />} />
          <Route path="/vin/:id" element={<WineDetailPage />} />
          <Route path="/tilfoej" element={<AddWinePage />} />
          <Route path="/spoerg" element={<AskPage />} />
          <Route path="/indstillinger" element={<SettingsPage />} />
        </Routes>
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>🍷<span>{da.nav.cellar}</span></NavLink>
        <NavLink to="/tilfoej">📷<span>{da.nav.add}</span></NavLink>
        <NavLink to="/spoerg">💬<span>{da.nav.ask}</span></NavLink>
        <NavLink to="/indstillinger">⚙️<span>{da.nav.settings}</span></NavLink>
      </nav>
    </HashRouter>
  );
}
