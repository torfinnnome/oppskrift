import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center">
      <h2 className="text-4xl font-bold mb-4">404 - Page Not Found</h2>
      <p className="text-lg text-muted-foreground mb-8">The page you are looking for does not exist.</p>
      <Link href="/" className="text-primary hover:underline">
        Go back to Homepage
      </Link>
    </div>
  );
}
