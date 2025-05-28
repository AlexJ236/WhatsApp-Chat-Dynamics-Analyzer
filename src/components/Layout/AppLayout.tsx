import React from 'react';
import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="app-container">
      <Header />
      <main>
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default AppLayout;