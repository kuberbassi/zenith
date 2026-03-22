import { redirect } from 'next/navigation'

export default function ProtectedRoot() {
  redirect('/dashboard')
}
