import { Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Contatos from './pages/Contatos';
import Inbox from './pages/Inbox';
import Campanhas from './pages/Campanhas';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/contatos" element={<Contatos />} />
      <Route path="/inbox" element={<Inbox />} />
      <Route path="/campanhas" element={<Campanhas />} />
    </Routes>
  );
}