// Route group layout for protected (app) routes.
// Middleware auth guard is added here in step 13.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
