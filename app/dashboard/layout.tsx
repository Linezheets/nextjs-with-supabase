import { CartProvider } from '@/components/CartDrawer';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
