import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ChatSection from './components/sections/ChatSection';
import LoginSection from './components/sections/LoginSection';
import RoomsSection from './components/sections/RoomsSection';

function getToken() {
  return localStorage.getItem('chat_token') || '';
}

function AuthenticatedRedirect() {
  return <Navigate to={getToken() ? '/rooms' : '/login'} replace />;
}

function PublicOnlyRoute({ element }) {
  return getToken() ? <Navigate to="/rooms" replace /> : element;
}

function ProtectedRoute({ element }) {
  return getToken() ? element : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthenticatedRedirect />} />
        <Route path="/login" element={<PublicOnlyRoute element={<LoginSection />} />} />
        <Route path="/signin" element={<PublicOnlyRoute element={<LoginSection />} />} />
        <Route path="/rooms" element={<ProtectedRoute element={<RoomsSection />} />} />
        <Route path="/rooms/:code" element={<ProtectedRoute element={<RoomsSection />} />} />
        <Route path="/chat/:code" element={<ProtectedRoute element={<ChatSection />} />} />
        <Route path="*" element={<AuthenticatedRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

