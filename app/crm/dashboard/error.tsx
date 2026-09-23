"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-white px-6 py-10 text-center">
      <p className="font-medium text-zinc-900">Не удалось загрузить данные календаря.</p>
      <p className="mt-2 text-sm text-zinc-600">Попробуйте обновить страницу.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
      >
        Обновить
      </button>
    </div>
  );
}
