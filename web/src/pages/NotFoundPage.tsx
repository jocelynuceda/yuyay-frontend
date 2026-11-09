import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-6 py-16 text-center">
      <p className="font-semibold text-primary">404</p>
      <h1 className="text-3xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="inline-block font-semibold text-primary underline">
        Volver al inicio
      </Link>
    </main>
  )
}
