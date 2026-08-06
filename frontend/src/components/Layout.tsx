import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  backTo?: string;
}

export default function Layout({ children, title, backTo }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-slate-800/50">
        <Link to="/" className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
          FaceAttend
        </Link>
        {backTo && (
          <Link to={backTo} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">
            ← Back
          </Link>
        )}
      </header>
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl animate-fade-in">
          {title && (
            <h1 className="text-3xl font-bold text-center mb-8">{title}</h1>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
