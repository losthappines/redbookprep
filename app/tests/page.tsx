import { redirect } from 'next/navigation';

export default function TestsRedirectPage() {
  redirect('/study?tab=mock-tests');
}
