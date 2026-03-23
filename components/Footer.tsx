
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-slate-800 py-8 bg-slate-900">
      <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <p className="text-slate-500 text-sm">
          &copy; {new Date().getFullYear()} Gemini AI Workspace. Built for the future.
        </p>
        <div className="flex gap-6 text-slate-500 text-sm">
          <a href="#" className="hover:text-blue-400 transition-colors">Privacy</a>
          <a href="#" className="hover:text-blue-400 transition-colors">Terms</a>
          <a href="#" className="hover:text-blue-400 transition-colors">Support</a>
        </div>
      </div>
    </footer>
  );
};
