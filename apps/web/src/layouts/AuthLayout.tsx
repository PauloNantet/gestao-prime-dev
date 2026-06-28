import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 to-blue-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Gestão <span className="text-amber-400">Prime</span>
          </h1>
          <p className="text-blue-200 mt-2 text-sm">
            Plataforma de gestão multi-empresa
          </p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
