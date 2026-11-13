import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { CompanyProvider } from './contexts/CompanyContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { useCompany } from './hooks/useCompany'
import './App.css'

const LoginPage = lazy(() => import('./pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage').then((module) => ({ default: module.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })))
const ProfilePage = lazy(() => import('./pages/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })))
const CompaniesPage = lazy(() => import('./pages/companies/CompaniesPage').then((module) => ({ default: module.CompaniesPage })))
const CompanySettingsPage = lazy(() => import('./pages/companies/CompanySettingsPage').then((module) => ({ default: module.CompanySettingsPage })))
const SalesPage = lazy(() => import('./pages/sales/SalesPage').then((module) => ({ default: module.SalesPage })))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))

function LegacyDashboardRedirect() {
  const { activeCompany, loading } = useCompany()
  if (loading) return <div className="loading-screen">Carregando empresa…</div>
  return <Navigate to={activeCompany ? `/empresas/${activeCompany.companyId}` : '/empresas'} replace />
}

function LegacySalesRedirect() {
  const { activeCompany, loading } = useCompany()
  if (loading) return <div className="loading-screen">Carregando empresa…</div>
  return <Navigate to={activeCompany ? `/empresas/${activeCompany.companyId}/vendas` : '/empresas'} replace />
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ThemeProvider>
        <AuthProvider>
          <CompanyProvider>
            <Suspense fallback={<div className="loading-screen">Carregando o ComissGest…</div>}>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/cadastro" element={<RegisterPage />} />
                <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
                <Route path="/empresas" element={<ProtectedRoute><CompaniesPage /></ProtectedRoute>} />
                <Route path="/empresas/:companyId" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                <Route path="/empresas/:companyId/configuracoes" element={<ProtectedRoute><CompanySettingsPage /></ProtectedRoute>} />
                <Route path="/empresas/:companyId/vendas" element={<ProtectedRoute><SalesPage /></ProtectedRoute>} />
                <Route path="/vendas" element={<ProtectedRoute><LegacySalesRedirect /></ProtectedRoute>} />
                <Route path="/dashboard" element={<ProtectedRoute><LegacyDashboardRedirect /></ProtectedRoute>} />
                <Route path="/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </CompanyProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
