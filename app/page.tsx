import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16">
      <main className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          rental-os
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          Платформа для арендного бизнеса. Сейчас доступен раздел объектов.
        </p>
        <Link
          href="/crm/properties"
          className="mt-6 inline-flex rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Открыть объекты
        </Link>
      </main>
    </div>
  );
}
