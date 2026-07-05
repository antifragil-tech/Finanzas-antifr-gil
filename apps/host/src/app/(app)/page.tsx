import { redirect } from 'next/navigation';

// La home del OS es el Panel operativo. La home legacy del holding se eliminó
// en la cirugía de runtime del MVP (2026-07-05).
export default function HomePage() {
  redirect('/dashboard');
}
